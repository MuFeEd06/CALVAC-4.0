-- Apply and verify against a preview database before deploying the matching API.
-- Existing application tables are required. This transaction never replaces them.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE missing_columns text;
BEGIN
  IF to_regclass('public.products') IS NULL OR to_regclass('public.orders') IS NULL THEN
    RAISE EXCEPTION 'Existing products and orders tables are required; inspect the schema first';
  END IF;
  SELECT string_agg(required.table_name || '.' || required.column_name, ', ')
  INTO missing_columns
  FROM (VALUES
    ('products','id'), ('products','name'), ('products','brand'), ('products','price'),
    ('products','original_price'), ('products','image'), ('products','tag'), ('products','size_unit'),
    ('products','sizes'), ('products','colors'), ('products','stock'),
    ('orders','id'), ('orders','name'), ('orders','phone'), ('orders','line1'), ('orders','line2'),
    ('orders','city'), ('orders','state'), ('orders','pin'), ('orders','landmark'), ('orders','total'), ('orders','status')
  ) AS required(table_name,column_name)
  LEFT JOIN information_schema.columns actual ON actual.table_schema='public'
    AND actual.table_name=required.table_name AND actual.column_name=required.column_name
  WHERE actual.column_name IS NULL;
  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'Required columns are missing: %. Reconcile the schema before migration', missing_columns;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name IN ('products','orders') AND column_name='id' AND data_type NOT IN ('smallint','integer','bigint')) THEN
    RAISE EXCEPTION 'Product and order IDs must be integers; inspect the schema first';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND ((table_name = 'products' AND column_name IN ('stock', 'colors')) OR (table_name = 'orders' AND column_name = 'items'))
      AND data_type NOT IN ('json', 'jsonb', 'text')
  ) THEN
    RAISE EXCEPTION 'stock, colors, and items must contain JSON; review legacy column types before migration';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='products' AND column_name='sizes' AND data_type NOT IN ('ARRAY','json','jsonb','text')) THEN
    RAISE EXCEPTION 'Product sizes must contain an array; inspect the schema first';
  END IF;
END $$;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS out_of_stock boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS total_stock integer;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS on_sale boolean GENERATED ALWAYS AS (original_price > price) STORED;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_v2 boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS inventory_restored boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE public.orders ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.orders ALTER COLUMN updated_at SET DEFAULT now();

-- Match existing varchar limits to values already accepted by the API.
DO $$ DECLARE field record; BEGIN
  FOR field IN SELECT wanted.table_name,wanted.column_name,wanted.max_length
    FROM (VALUES ('orders','line1',200),('orders','line2',200),('orders','city',100),
      ('orders','state',100),('orders','landmark',200),('products','image',500))
      AS wanted(table_name,column_name,max_length)
    JOIN information_schema.columns actual ON actual.table_schema='public'
      AND actual.table_name=wanted.table_name AND actual.column_name=wanted.column_name
    WHERE actual.data_type='character varying' AND actual.character_maximum_length < wanted.max_length
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE varchar(%s)',field.table_name,field.column_name,field.max_length);
  END LOOP;
END $$;

-- Preserve the live database's relational order history in the new snapshot field.
-- Original order_items records, order totals, statuses and customer details remain intact.
DO $$ BEGIN
  IF to_regclass('public.order_items') IS NOT NULL THEN
    UPDATE public.orders o SET items = history.items
    FROM (
      SELECT oi.order_id, jsonb_agg(jsonb_build_object(
        'product_id', oi.product_id, 'name', oi.name, 'brand', oi.brand,
        'size', trim(regexp_replace(oi.size, '^(UK|EURO?|EUR)[[:space:]]+', '', 'i')),
        'size_unit', CASE WHEN oi.size ~* '^(EU|EURO|EUR)' THEN 'EU' ELSE 'UK' END,
        'color', coalesce(oi.color,''), 'qty', oi.qty, 'price', oi.price, 'image', oi.image
      ) ORDER BY oi.id) AS items
      FROM public.order_items oi GROUP BY oi.order_id
    ) history
    WHERE o.id=history.order_id AND o.checkout_v2=false AND (o.items IS NULL OR o.items::jsonb='[]'::jsonb);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS products_public_id_idx ON public.products (id) WHERE active = true;
CREATE INDEX IF NOT EXISTS products_public_brand_idx ON public.products (lower(brand), id) WHERE active = true;
CREATE INDEX IF NOT EXISTS products_public_tag_idx ON public.products (tag, id) WHERE active = true;
CREATE INDEX IF NOT EXISTS orders_status_id_idx ON public.orders (status, id DESC);

CREATE TABLE IF NOT EXISTS public.checkout_idempotency (
  key text PRIMARY KEY,
  payload_hash text NOT NULL,
  order_id bigint NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.checkout_idempotency ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkout_idempotency FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.checkout_idempotency TO service_role;

CREATE OR REPLACE FUNCTION public.create_order_with_stock_v2(p_items jsonb, p_customer jsonb, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  fingerprint text;
  previous public.checkout_idempotency%ROWTYPE;
  product public.products%ROWTYPE;
  item jsonb;
  color jsonb;
  colors jsonb;
  sizes jsonb;
  v_stock jsonb;
  stock_key text;
  candidate text;
  size_label text;
  color_name text;
  quantity integer;
  unit_price numeric;
  total_price numeric := 0;
  snapshots jsonb := '[]'::jsonb;
  public_items jsonb;
  seen text[] := ARRAY[]::text[];
  item_key text;
  created_id bigint;
  response jsonb;
BEGIN
  IF p_idempotency_key !~ '^[A-Za-z0-9_-]{16,128}$' OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Invalid idempotency key';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 20
    OR jsonb_typeof(p_customer) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid order'; END IF;
  IF coalesce(p_customer->>'phone', '') !~ '^(\+91-?)?[6-9][0-9]{9}$'
    OR coalesce(p_customer->>'pin', '') !~ '^[1-9][0-9]{5}$' THEN RAISE EXCEPTION 'Invalid customer details'; END IF;
  FOREACH candidate IN ARRAY ARRAY['name','line1','city','state'] LOOP
    IF length(trim(coalesce(p_customer->>candidate, ''))) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid customer details'; END IF;
  END LOOP;
  fingerprint := encode(sha256(convert_to(jsonb_build_object('items', p_items, 'customer', p_customer)::text, 'UTF8')), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  SELECT * INTO previous FROM public.checkout_idempotency WHERE key = p_idempotency_key;
  IF FOUND THEN
    IF previous.payload_hash <> fingerprint THEN RAISE SQLSTATE 'PT409' USING MESSAGE = 'Idempotency key was already used for another order'; END IF;
    RETURN previous.response;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF coalesce(item->>'productId', '') !~ '^[1-9][0-9]{0,15}$'
      OR jsonb_typeof(item->'quantity') IS DISTINCT FROM 'number'
      OR coalesce(item->>'quantity', '') !~ '^(10|[1-9])$' THEN RAISE EXCEPTION 'Invalid cart item'; END IF;
  END LOOP;
  -- Lock every referenced product in a stable order before changing any inventory.
  PERFORM 1 FROM public.products p WHERE p.id IN (SELECT (value->>'productId')::bigint FROM jsonb_array_elements(p_items)) ORDER BY p.id FOR UPDATE;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO product FROM public.products WHERE id = (item->>'productId')::bigint;
    IF NOT FOUND OR product.active IS DISTINCT FROM true OR product.out_of_stock IS TRUE THEN RAISE EXCEPTION 'Product is unavailable'; END IF;
    quantity := (item->>'quantity')::integer;
    size_label := item->>'size'; color_name := coalesce(item->>'color', '');
    IF item->>'sizeUnit' IS DISTINCT FROM coalesce(product.size_unit, 'UK') THEN RAISE EXCEPTION 'Invalid product size'; END IF;
    sizes := coalesce(nullif(to_jsonb(product)->'sizes', 'null'::jsonb), '[]'::jsonb);
    IF jsonb_typeof(sizes)='string' THEN sizes := (sizes #>> '{}')::jsonb; END IF;
    IF jsonb_typeof(sizes) IS DISTINCT FROM 'array' OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(sizes)
      WHERE trim(regexp_replace(value, '^(UK|EURO?|EUR)[[:space:]]+', '', 'i')) = coalesce(size_label, '')) THEN RAISE EXCEPTION 'Invalid product size'; END IF;
    item_key := product.id || '|' || (item->>'sizeUnit') || '|' || size_label || '|' || color_name;
    IF item_key = ANY(seen) THEN RAISE EXCEPTION 'Duplicate cart item'; END IF;
    seen := array_append(seen, item_key);
    colors := coalesce(nullif(to_jsonb(product)->'colors', 'null'::jsonb), '[]'::jsonb);
    IF jsonb_typeof(colors)='string' THEN colors := (colors #>> '{}')::jsonb; END IF;
    color := NULL;
    IF jsonb_typeof(colors) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Product configuration is unavailable'; END IF;
    IF jsonb_array_length(colors) > 0 THEN
      SELECT value INTO color FROM jsonb_array_elements(colors) WHERE value->>'name' = color_name LIMIT 1;
      IF color IS NULL THEN RAISE EXCEPTION 'Invalid product color'; END IF;
    ELSIF color_name <> '' THEN RAISE EXCEPTION 'Invalid product color'; END IF;
    unit_price := round(coalesce(nullif(color->>'price', '')::numeric, product.price::numeric), 2);
    IF unit_price IS NULL OR unit_price <= 0 OR unit_price > 1000000 THEN RAISE EXCEPTION 'Invalid product price'; END IF;

    v_stock := coalesce(nullif(to_jsonb(product)->'stock', 'null'::jsonb), '{}'::jsonb);
    IF jsonb_typeof(v_stock)='string' THEN v_stock := (v_stock #>> '{}')::jsonb; END IF;
    IF jsonb_typeof(v_stock) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Product configuration is unavailable'; END IF;
    stock_key := NULL;
    FOREACH candidate IN ARRAY ARRAY[
      coalesce(nullif(color_name,''),'default') || '|' || size_label, 'default|' || size_label,
      coalesce(nullif(color_name,''),'default') || '|' || product.size_unit || ' ' || size_label,
      'default|' || product.size_unit || ' ' || size_label,
      CASE WHEN product.size_unit = 'EU' THEN coalesce(nullif(color_name,''),'default') || '|EURO ' || size_label END,
      CASE WHEN product.size_unit = 'EU' THEN 'default|EURO ' || size_label END,
      coalesce(nullif(color_name,''),'default')
    ] LOOP
      IF v_stock ? candidate THEN stock_key := candidate; EXIT; END IF;
    END LOOP;
    IF stock_key IS NOT NULL THEN
      IF coalesce(v_stock->>stock_key, '') !~ '^[0-9]{1,6}$' THEN RAISE EXCEPTION 'Product configuration is unavailable'; END IF;
      IF (v_stock->>stock_key)::integer < quantity THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
      v_stock := jsonb_set(v_stock, ARRAY[stock_key], to_jsonb((v_stock->>stock_key)::integer - quantity));
    END IF;
    IF product.total_stock IS NOT NULL AND product.total_stock < quantity THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
    UPDATE public.products SET stock = v_stock, total_stock = CASE WHEN total_stock IS NULL THEN NULL ELSE total_stock - quantity END WHERE id = product.id;
    total_price := total_price + unit_price * quantity;
    snapshots := snapshots || jsonb_build_array(jsonb_build_object(
      'product_id', product.id, 'name', product.name, 'brand', product.brand, 'qty', quantity,
      'size', size_label, 'size_unit', product.size_unit, 'color', color_name,
      'price', unit_price, 'unit_price_paise', (unit_price * 100)::bigint,
      'line_total_paise', (unit_price * quantity * 100)::bigint,
      'image', coalesce(nullif(color->>'image',''), product.image),
      '_stock_key', stock_key, '_uses_total_stock', product.total_stock IS NOT NULL
    ));
  END LOOP;
  INSERT INTO public.orders (name, phone, line1, line2, city, state, pin, landmark, total, status, items, checkout_v2)
  VALUES (p_customer->>'name', p_customer->>'phone', p_customer->>'line1', coalesce(p_customer->>'line2',''),
    p_customer->>'city', p_customer->>'state', p_customer->>'pin', coalesce(p_customer->>'landmark',''), total_price, 'Pending', snapshots, true)
  RETURNING id INTO created_id;
  SELECT jsonb_agg(value - '_stock_key' - '_uses_total_stock') INTO public_items FROM jsonb_array_elements(snapshots);
  response := jsonb_build_object('id', created_id, 'total', total_price, 'status', 'Pending', 'items', public_items);
  INSERT INTO public.checkout_idempotency(key, payload_hash, order_id, response) VALUES (p_idempotency_key, fingerprint, created_id, response);
  RETURN response;
END $$;

CREATE OR REPLACE FUNCTION public.set_order_status_v2(p_order_id bigint, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_order public.orders%ROWTYPE;
  product public.products%ROWTYPE;
  item jsonb;
  v_stock jsonb;
  stock_key text;
BEGIN
  SELECT * INTO current_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF current_order.status = p_status THEN RETURN jsonb_build_object('id', p_order_id, 'status', p_status); END IF;
  IF NOT ((current_order.status = 'Pending' AND p_status IN ('Confirmed','Cancelled'))
    OR (current_order.status = 'Confirmed' AND p_status IN ('Shipped','Cancelled'))
    OR (current_order.status = 'Shipped' AND p_status = 'Delivered')) THEN RAISE EXCEPTION 'Invalid order status transition'; END IF;
  IF p_status = 'Cancelled' AND NOT current_order.inventory_restored THEN
    IF NOT current_order.checkout_v2 THEN RAISE EXCEPTION 'This order needs a manual inventory review before cancellation'; END IF;
    PERFORM 1 FROM public.products p WHERE p.id IN (SELECT (value->>'product_id')::bigint FROM jsonb_array_elements(current_order.items::jsonb)) ORDER BY p.id FOR UPDATE;
    FOR item IN SELECT value FROM jsonb_array_elements(current_order.items::jsonb) LOOP
      SELECT * INTO product FROM public.products WHERE id = (item->>'product_id')::bigint;
      IF NOT FOUND THEN RAISE EXCEPTION 'This order needs a manual inventory review before cancellation'; END IF;
      v_stock := coalesce(nullif(to_jsonb(product)->'stock', 'null'::jsonb), '{}'::jsonb); stock_key := item->>'_stock_key';
      IF jsonb_typeof(v_stock)='string' THEN v_stock := (v_stock #>> '{}')::jsonb; END IF;
      IF stock_key IS NOT NULL THEN
        IF NOT v_stock ? stock_key OR coalesce(v_stock->>stock_key, '') !~ '^[0-9]{1,6}$' THEN RAISE EXCEPTION 'This order needs a manual inventory review before cancellation'; END IF;
        v_stock := jsonb_set(v_stock, ARRAY[stock_key], to_jsonb((v_stock->>stock_key)::integer + (item->>'qty')::integer));
      END IF;
      UPDATE public.products SET stock = v_stock,
        total_stock = CASE WHEN (item->>'_uses_total_stock')::boolean AND total_stock IS NOT NULL THEN total_stock + (item->>'qty')::integer ELSE total_stock END
      WHERE id = product.id;
    END LOOP;
  END IF;
  UPDATE public.orders SET status = p_status, inventory_restored = inventory_restored OR p_status = 'Cancelled', updated_at=now() WHERE id = p_order_id;
  RETURN jsonb_build_object('id', p_order_id, 'status', p_status);
END $$;

REVOKE ALL ON FUNCTION public.create_order_with_stock_v2(jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_order_status_v2(bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_stock_v2(jsonb,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_order_status_v2(bigint,text) TO service_role;

-- Close direct access to legacy privileged checkout functions as well.
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='create_order_with_stock' LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
  END LOOP;
END $$;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
-- A restrictive policy preserves existing permissive product policies while hiding inactive rows.
DROP POLICY IF EXISTS calvac_active_products_only ON public.products;
CREATE POLICY calvac_active_products_only ON public.products AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (active = true);
DROP POLICY IF EXISTS calvac_public_products ON public.products;
CREATE POLICY calvac_public_products ON public.products FOR SELECT TO anon, authenticated USING (active = true);
DROP POLICY IF EXISTS calvac_private_orders ON public.orders;
CREATE POLICY calvac_private_orders ON public.orders AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS calvac_no_product_insert ON public.products;
CREATE POLICY calvac_no_product_insert ON public.products AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS calvac_no_product_update ON public.products;
CREATE POLICY calvac_no_product_update ON public.products AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS calvac_no_product_delete ON public.products;
CREATE POLICY calvac_no_product_delete ON public.products AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);
REVOKE ALL ON public.orders FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.products FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products, public.orders TO service_role;

-- These tables contain public storefront configuration. All writes go through the
-- authenticated admin API, including when old permissive policies are present.
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['site_settings','offer','settings'] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('DROP POLICY IF EXISTS calvac_public_configuration ON public.%I', table_name);
      EXECUTE format('CREATE POLICY calvac_public_configuration ON public.%I FOR SELECT TO anon, authenticated USING (true)', table_name);
      EXECUTE format('DROP POLICY IF EXISTS calvac_no_configuration_insert ON public.%I', table_name);
      EXECUTE format('CREATE POLICY calvac_no_configuration_insert ON public.%I AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false)', table_name);
      EXECUTE format('DROP POLICY IF EXISTS calvac_no_configuration_update ON public.%I', table_name);
      EXECUTE format('CREATE POLICY calvac_no_configuration_update ON public.%I AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false)', table_name);
      EXECUTE format('DROP POLICY IF EXISTS calvac_no_configuration_delete ON public.%I', table_name);
      EXECUTE format('CREATE POLICY calvac_no_configuration_delete ON public.%I AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false)', table_name);
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM PUBLIC, anon, authenticated', table_name);
      EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', table_name);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', table_name);
    END IF;
  END LOOP;
END $$;

DO $$ BEGIN
  IF to_regclass('public.order_items') IS NOT NULL THEN
    ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS calvac_private_order_items ON public.order_items;
    CREATE POLICY calvac_private_order_items ON public.order_items AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
    REVOKE ALL ON public.order_items FROM PUBLIC, anon, authenticated;
    GRANT ALL ON public.order_items TO service_role;
    CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items(order_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS checkout_idempotency_order_id_idx ON public.checkout_idempotency(order_id);

NOTIFY pgrst, 'reload schema';
COMMIT;
