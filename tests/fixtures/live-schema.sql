-- Metadata-only fixture captured from the connected Supabase project on 2026-10-19.
-- No customer records or credentials are included.
CREATE TABLE public."products" (
  "id" serial NOT NULL,
  "name" character varying(200) NOT NULL,
  "brand" character varying(100) NOT NULL,
  "price" integer NOT NULL,
  "image" character varying(300),
  "tag" character varying(50),
  "sizes" text,
  "colors" text,
  "stock" text DEFAULT '{}'::text,
  "specs" text DEFAULT ''::text,
  "original_price" integer DEFAULT 0,
  "category" character varying(50) DEFAULT ''::character varying,
  "size_unit" text DEFAULT 'UK'::text NOT NULL
);
CREATE TABLE public."settings" (
  "key" character varying(100) NOT NULL,
  "value" text
);
CREATE TABLE public."orders" (
  "id" serial NOT NULL,
  "name" character varying(100) NOT NULL,
  "phone" character varying(20) NOT NULL,
  "line1" character varying(120) NOT NULL,
  "line2" character varying(120),
  "city" character varying(60) NOT NULL,
  "state" character varying(60) NOT NULL,
  "pin" character varying(12) NOT NULL,
  "landmark" character varying(100),
  "total" double precision NOT NULL,
  "status" character varying(20) NOT NULL,
  "notes" text,
  "created_at" timestamp without time zone,
  "updated_at" timestamp without time zone
);
CREATE TABLE public."order_items" (
  "id" serial NOT NULL,
  "order_id" integer NOT NULL,
  "product_id" integer NOT NULL,
  "name" character varying(150) NOT NULL,
  "brand" character varying(80) NOT NULL,
  "size" character varying(20) NOT NULL,
  "color" character varying(60),
  "qty" integer NOT NULL,
  "price" double precision NOT NULL,
  "image" character varying(300)
);
CREATE TABLE public."offer" (
  "id" serial NOT NULL,
  "active" boolean DEFAULT false,
  "text" text DEFAULT ''::text,
  "bg_color" text DEFAULT '#FF6B35'::text,
  "text_color" text DEFAULT '#ffffff'::text,
  "show_logo" boolean DEFAULT true
);
CREATE TABLE public."site_settings" (
  "id" serial NOT NULL,
  "primary_color" text DEFAULT '#2B9FD8'::text,
  "data" jsonb DEFAULT '{}'::jsonb
);
ALTER TABLE public."products" ADD CONSTRAINT "products_pkey" PRIMARY KEY (id);
ALTER TABLE public."settings" ADD CONSTRAINT "settings_pkey" PRIMARY KEY (key);
ALTER TABLE public."orders" ADD CONSTRAINT "orders_pkey" PRIMARY KEY (id);
ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE public."site_settings" ADD CONSTRAINT "site_settings_pkey" PRIMARY KEY (id);
ALTER TABLE public."offer" ADD CONSTRAINT "offer_pkey" PRIMARY KEY (id);
ALTER TABLE public."products" ADD CONSTRAINT "products_size_unit_check" CHECK ((size_unit = ANY (ARRAY['UK'::text, 'EU'::text])));
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
