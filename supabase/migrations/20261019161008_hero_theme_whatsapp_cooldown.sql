-- Five-minute duplicate guard for concurrent WhatsApp orders; no historical orders are deleted.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS whatsapp_fingerprint text;
CREATE INDEX IF NOT EXISTS orders_whatsapp_recent_idx ON public.orders((right(regexp_replace(phone,'[^0-9]','','g'),10)),created_at DESC) WHERE payment_method='whatsapp' AND checkout_v2 AND status<>'Cancelled';

CREATE OR REPLACE FUNCTION public.create_order_with_stock_v4(p_items jsonb,p_customer jsonb,p_idempotency_key text,p_payment_method text,p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE canonical jsonb; fingerprint text; recent public.orders%ROWTYPE; result jsonb; remaining integer;
BEGIN
  IF p_payment_method IS DISTINCT FROM 'whatsapp' THEN
    RETURN public.create_order_with_stock_v3(p_items,p_customer,p_idempotency_key,p_payment_method,p_user_id);
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 20
    OR jsonb_typeof(p_customer) IS DISTINCT FROM 'object' OR coalesce(p_customer->>'phone','') !~ '^(\+91-?)?[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'Invalid order';
  END IF;
  SELECT jsonb_agg(jsonb_build_object('productId',(item->>'productId')::bigint,'size',item->>'size','sizeUnit',item->>'sizeUnit',
    'color',coalesce(item->>'color',''),'quantity',(item->>'quantity')::integer) ORDER BY (item->>'productId')::bigint,item->>'sizeUnit',item->>'size',coalesce(item->>'color',''))
    INTO canonical FROM jsonb_array_elements(p_items) item;
  fingerprint:=md5(jsonb_build_object('phone',right(regexp_replace(p_customer->>'phone','[^0-9]','','g'),10),'items',canonical)::text);
  -- Serializes matching requests even when they carry different idempotency keys.
  PERFORM pg_advisory_xact_lock(hashtextextended('whatsapp:'||fingerprint,0));
  IF EXISTS(SELECT 1 FROM public.checkout_idempotency WHERE key=p_idempotency_key) THEN
    RETURN public.create_order_with_stock_v3(p_items,p_customer,p_idempotency_key,p_payment_method,p_user_id);
  END IF;
  SELECT o.* INTO recent FROM public.orders o
    WHERE o.payment_method='whatsapp' AND o.checkout_v2 AND o.status<>'Cancelled'
    AND right(regexp_replace(o.phone,'[^0-9]','','g'),10)=right(regexp_replace(p_customer->>'phone','[^0-9]','','g'),10)
    AND o.created_at>clock_timestamp()-interval '5 minutes'
    AND (o.whatsapp_fingerprint=fingerprint OR (o.whatsapp_fingerprint IS NULL AND canonical=(
      SELECT jsonb_agg(jsonb_build_object('productId',(item->>'product_id')::bigint,'size',item->>'size','sizeUnit',item->>'size_unit',
        'color',coalesce(item->>'color',''),'quantity',(item->>'qty')::integer)
        ORDER BY (item->>'product_id')::bigint,item->>'size_unit',item->>'size',coalesce(item->>'color','')) FROM jsonb_array_elements(o.items) item)))
    ORDER BY o.created_at DESC LIMIT 1;
  IF FOUND THEN
    remaining:=greatest(1,ceil(extract(epoch FROM recent.created_at+interval '5 minutes'-clock_timestamp()))::integer);
    RETURN jsonb_build_object('duplicate',true,'retry_after',remaining);
  END IF;
  result:=public.create_order_with_stock_v3(p_items,p_customer,p_idempotency_key,p_payment_method,p_user_id);
  UPDATE public.orders SET whatsapp_fingerprint=fingerprint WHERE id=(result->>'id')::bigint;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.create_order_with_stock_v4(jsonb,jsonb,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_stock_v4(jsonb,jsonb,text,text,uuid) TO service_role;

-- Requested new default; preserve saved scroll-animation controls and other store settings.
UPDATE public.site_settings SET data=(coalesce(data,'{}'::jsonb)-'primary_color') || jsonb_build_object(
  'hero_type','particles','theme_settings',jsonb_build_object(
    'primaryColor','#151514','secondaryColor','#62615E','accentColor','#151514','backgroundColor','#EBE9E5',
    'surfaceColor','#F8F7F4','textColor','#151514','mutedTextColor','#62615E','borderColor','#CCCAC4','buttonStyle','pill','themeMode','light'));
NOTIFY pgrst,'reload schema';
COMMIT;
