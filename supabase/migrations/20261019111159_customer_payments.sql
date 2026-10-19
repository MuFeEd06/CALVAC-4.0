-- Requires checkout_hardening. Apply to production only after explicit approval.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', address jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
CREATE POLICY calvac_profile_read ON public.profiles FOR SELECT TO authenticated USING ((select auth.uid())=id);
CREATE POLICY calvac_profile_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK ((select auth.uid())=id);
CREATE POLICY calvac_profile_update ON public.profiles FOR UPDATE TO authenticated USING ((select auth.uid())=id) WITH CHECK ((select auth.uid())=id);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_expires_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_order_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_payment_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_claim_token uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_claim_at timestamptz;
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON public.orders(user_id,id DESC) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_razorpay_id_idx ON public.orders(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_razorpay_payment_idx ON public.orders(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_payment_expiry_idx ON public.orders(payment_expires_at,id)
  WHERE payment_method='razorpay' AND status='Pending' AND payment_status IN ('pending','failed');

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  key text PRIMARY KEY,hits integer NOT NULL,reset_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS api_rate_limits_expiry_idx ON public.api_rate_limits(reset_at);
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_rate_limits FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.api_rate_limits TO service_role;
CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(p_key text,p_limit integer,p_window integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE counter public.api_rate_limits%ROWTYPE; BEGIN
  IF length(p_key) NOT BETWEEN 1 AND 200 OR p_limit NOT BETWEEN 1 AND 10000 OR p_window NOT BETWEEN 1 AND 86400 THEN
    RAISE EXCEPTION 'Invalid rate limit'; END IF;
  INSERT INTO public.api_rate_limits(key,hits,reset_at) VALUES(p_key,1,now()+make_interval(secs=>p_window))
    ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN api_rate_limits.reset_at<=now() THEN 1 ELSE api_rate_limits.hits+1 END,
      reset_at=CASE WHEN api_rate_limits.reset_at<=now() THEN now()+make_interval(secs=>p_window) ELSE api_rate_limits.reset_at END
    RETURNING * INTO counter;
  IF mod(hashtextextended(p_key,0),50)=0 THEN
    DELETE FROM public.api_rate_limits WHERE key IN(SELECT key FROM public.api_rate_limits WHERE reset_at<now()-interval '1 day' LIMIT 100);
  END IF;
  RETURN jsonb_build_object('allowed',counter.hits<=p_limit,'retry_after',greatest(1,ceil(extract(epoch FROM counter.reset_at-now()))::integer));
END $$;

CREATE TABLE IF NOT EXISTS public.payment_events (
-- Private payment-event ledger; only the verified API can write it.
  event_id text PRIMARY KEY, event_type text NOT NULL, provider_order_id text, payment_id text,
  amount bigint, currency text, processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_events FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.payment_events TO service_role;

CREATE OR REPLACE FUNCTION public.create_order_with_stock_v3(
  p_items jsonb,p_customer jsonb,p_idempotency_key text,p_payment_method text,p_user_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; current_order public.orders%ROWTYPE; configured jsonb; BEGIN
  IF p_payment_method NOT IN ('whatsapp','cod','razorpay') OR p_payment_method IS NULL THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
  IF p_payment_method='razorpay' AND p_user_id IS NULL THEN RAISE EXCEPTION 'Sign in required for online payment'; END IF;
  SELECT data->'payment_methods' INTO configured FROM public.site_settings ORDER BY id LIMIT 1;
  IF coalesce(configured->p_payment_method,to_jsonb(p_payment_method IN ('whatsapp','cod'))) IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'This payment method is currently unavailable';
  END IF;
  -- Method and verified account are part of the persisted idempotency fingerprint.
  result := public.create_order_with_stock_v2(p_items,p_customer || jsonb_build_object(
    '_checkout_user',p_user_id,'_payment_method',p_payment_method),p_idempotency_key);
  SELECT * INTO current_order FROM public.orders WHERE id=(result->>'id')::bigint FOR UPDATE;
  IF current_order.payment_method='legacy' THEN
    UPDATE public.orders SET user_id=p_user_id,payment_method=p_payment_method,
      payment_status=CASE p_payment_method WHEN 'cod' THEN 'cod_pending' WHEN 'whatsapp' THEN 'whatsapp_pending' ELSE 'pending' END,
      payment_expires_at=CASE WHEN p_payment_method='razorpay' THEN now()+interval '45 minutes' ELSE NULL END
    WHERE id=current_order.id RETURNING * INTO current_order;
  END IF;
  RETURN result || jsonb_build_object('status',current_order.status,'payment_method',current_order.payment_method,
    'payment_status',current_order.payment_status,'payment_expires_at',current_order.payment_expires_at);
END $$;

CREATE OR REPLACE FUNCTION public.set_order_status_v3(p_order_id bigint,p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_order public.orders%ROWTYPE; result jsonb; BEGIN
  SELECT * INTO current_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF current_order.payment_method='razorpay' AND current_order.payment_status<>'paid'
    AND p_status IN ('Confirmed','Shipped','Delivered') THEN RAISE EXCEPTION 'Online payment is not confirmed'; END IF;
  result := public.set_order_status_v2(p_order_id,p_status);
  IF p_status='Cancelled' AND current_order.payment_method='razorpay' THEN
    UPDATE public.orders SET payment_status=CASE WHEN payment_status IN ('paid','refund_required') THEN 'refund_required'
      WHEN payment_status='refunded' THEN 'refunded' ELSE 'cancelled' END WHERE id=p_order_id;
  END IF;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.expire_unpaid_orders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE expired_ids bigint[]; order_id bigint; BEGIN
  SELECT array_agg(id) INTO expired_ids FROM (SELECT id FROM public.orders
    WHERE payment_method='razorpay' AND payment_status IN ('pending','failed') AND status='Pending' AND payment_expires_at<now()
    ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED) expired;
  IF expired_ids IS NULL THEN RETURN 0; END IF;
  -- Pre-lock all affected products once in stable order, across the whole batch.
  PERFORM 1 FROM public.products p WHERE p.id IN (
    SELECT (item->>'product_id')::bigint FROM public.orders o CROSS JOIN LATERAL jsonb_array_elements(o.items::jsonb) item WHERE o.id=ANY(expired_ids)
  ) ORDER BY p.id FOR UPDATE;
  FOREACH order_id IN ARRAY expired_ids LOOP PERFORM public.set_order_status_v3(order_id,'Cancelled'); END LOOP;
  RETURN array_length(expired_ids,1);
END $$;

CREATE OR REPLACE FUNCTION public.claim_razorpay_order(p_order_id bigint,p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_order public.orders%ROWTYPE; token uuid; BEGIN
  SELECT * INTO current_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR current_order.user_id IS DISTINCT FROM p_user_id OR p_user_id IS NULL THEN RAISE EXCEPTION 'Order does not match this account'; END IF;
  IF current_order.payment_method<>'razorpay' OR current_order.status<>'Pending' OR current_order.payment_status NOT IN ('pending','failed') THEN
    RAISE EXCEPTION 'This order is not eligible for payment'; END IF;
  IF current_order.payment_expires_at<now() THEN RAISE EXCEPTION 'This payment reservation has expired'; END IF;
  IF current_order.razorpay_order_id IS NOT NULL THEN
    RETURN jsonb_build_object('action','existing','provider_order_id',current_order.razorpay_order_id,'amount',round(current_order.total::numeric*100)::bigint);
  END IF;
  IF current_order.payment_claim_at>now()-interval '90 seconds' THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Payment is already being prepared. Please retry shortly'; END IF;
  token := gen_random_uuid();
  UPDATE public.orders SET payment_claim_token=token,payment_claim_at=now() WHERE id=p_order_id;
  RETURN jsonb_build_object('action','create','token',token,'amount',round(current_order.total::numeric*100)::bigint);
END $$;

CREATE OR REPLACE FUNCTION public.bind_razorpay_order(p_order_id bigint,p_user_id uuid,p_token uuid,p_provider_order_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_order public.orders%ROWTYPE; BEGIN
  SELECT * INTO current_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR p_user_id IS NULL OR current_order.user_id IS DISTINCT FROM p_user_id OR current_order.payment_claim_token IS DISTINCT FROM p_token THEN
    RAISE EXCEPTION 'Order does not match this account'; END IF;
  IF current_order.status<>'Pending' OR current_order.payment_expires_at<now() THEN RAISE EXCEPTION 'This payment reservation has expired'; END IF;
  IF p_provider_order_id !~ '^order_[A-Za-z0-9]+$' THEN RAISE EXCEPTION 'Invalid provider order'; END IF;
  UPDATE public.orders SET razorpay_order_id=p_provider_order_id,payment_claim_token=NULL,payment_claim_at=NULL WHERE id=p_order_id;
  RETURN jsonb_build_object('provider_order_id',p_provider_order_id,'amount',round(current_order.total::numeric*100)::bigint);
END $$;

CREATE OR REPLACE FUNCTION public.process_razorpay_event(p_event_id text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE event_type text; entity jsonb; provider_id text; payment_id text; amount bigint; currency text;
  current_order public.orders%ROWTYPE; BEGIN
  IF p_event_id IS NULL OR length(p_event_id) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid payment event'; END IF;
  -- One transaction serializes duplicate events; failed work leaves no deduplication marker.
  PERFORM pg_advisory_xact_lock(hashtextextended('razorpay:' || p_event_id,0));
  IF EXISTS(SELECT 1 FROM public.payment_events WHERE event_id=p_event_id) THEN RETURN jsonb_build_object('received',true,'duplicate',true); END IF;
  event_type := p_payload->>'event';
  IF event_type IN ('payment.captured','payment.failed','payment.authorized') THEN
    entity := p_payload#>'{payload,payment,entity}';
    provider_id := entity->>'order_id'; payment_id := entity->>'id';
  ELSIF event_type='order.paid' THEN
    entity := p_payload#>'{payload,order,entity}'; provider_id := entity->>'id';
  ELSE RETURN jsonb_build_object('received',true,'ignored',true); END IF;
  SELECT * INTO current_order FROM public.orders WHERE razorpay_order_id=provider_id FOR UPDATE;
  IF NOT FOUND THEN
    IF entity#>>'{notes,store}'='calvac-footwear' THEN
      RAISE SQLSTATE 'PT409' USING MESSAGE='Payment order binding is pending';
    END IF;
    RETURN jsonb_build_object('received',true,'ignored',true);
  END IF;
  IF current_order.payment_method<>'razorpay' THEN RAISE EXCEPTION 'Invalid payment event'; END IF;
  currency := entity->>'currency';
  IF event_type='order.paid' THEN amount := (entity->>'amount_paid')::bigint;
  ELSE amount := (entity->>'amount')::bigint; END IF;
  IF currency IS DISTINCT FROM 'INR' OR amount IS DISTINCT FROM round(current_order.total::numeric*100)::bigint THEN
    RAISE EXCEPTION 'Payment amount or currency mismatch'; END IF;
  IF event_type IN ('payment.captured','order.paid') THEN
    IF (event_type='payment.captured' AND entity->>'status' IS DISTINCT FROM 'captured')
      OR (event_type='order.paid' AND entity->>'status' IS DISTINCT FROM 'paid') THEN RAISE EXCEPTION 'Invalid payment event'; END IF;
    UPDATE public.orders SET payment_status=CASE WHEN status='Cancelled' THEN 'refund_required' ELSE 'paid' END,
      status=CASE WHEN status='Pending' THEN 'Confirmed' ELSE status END,
      razorpay_payment_id=coalesce(payment_id,razorpay_payment_id),updated_at=now() WHERE id=current_order.id;
  ELSIF event_type='payment.failed' AND current_order.payment_status IN ('pending','failed') AND current_order.status='Pending' THEN
    UPDATE public.orders SET payment_status='failed',updated_at=now() WHERE id=current_order.id;
  END IF;
  INSERT INTO public.payment_events(event_id,event_type,provider_order_id,payment_id,amount,currency)
    VALUES(p_event_id,event_type,provider_id,payment_id,amount,currency);
  RETURN jsonb_build_object('received',true);
END $$;

CREATE OR REPLACE FUNCTION public.cancel_own_unpaid_order(p_order_id bigint,p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_order public.orders%ROWTYPE; BEGIN
  SELECT * INTO current_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR p_user_id IS NULL OR current_order.user_id IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Order does not match this account'; END IF;
  IF current_order.status<>'Pending' OR current_order.payment_method<>'razorpay' OR current_order.payment_status NOT IN ('pending','failed') THEN
    RAISE EXCEPTION 'This order is not eligible for cancellation'; END IF;
  RETURN public.set_order_status_v3(p_order_id,'Cancelled');
END $$;

-- These functions are internal to the verified Python API, never browser RPCs.
REVOKE ALL ON FUNCTION public.create_order_with_stock_v3(jsonb,jsonb,text,text,uuid),
  public.set_order_status_v3(bigint,text),public.expire_unpaid_orders(),public.claim_razorpay_order(bigint,uuid),
  public.bind_razorpay_order(bigint,uuid,uuid,text),public.process_razorpay_event(text,jsonb),public.cancel_own_unpaid_order(bigint,uuid),public.consume_api_rate_limit(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_stock_v3(jsonb,jsonb,text,text,uuid),
  public.set_order_status_v3(bigint,text),public.expire_unpaid_orders(),public.claim_razorpay_order(bigint,uuid),
  public.bind_razorpay_order(bigint,uuid,uuid,text),public.process_razorpay_event(text,jsonb),public.cancel_own_unpaid_order(bigint,uuid),public.consume_api_rate_limit(text,integer,integer) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
