-- Read-only follow-up for PROJECT_AUDIT.md. Run in the project's Supabase SQL editor.
-- This script inspects security settings; it does not modify data or permissions.

-- RLS state for application tables.
SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('products', 'orders', 'offer', 'site_settings')
ORDER BY table_name, ordinal_position;

SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('products', 'orders', 'offer', 'site_settings');

-- Policies, including the commands and roles each policy covers.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('products', 'orders', 'offer', 'site_settings')
ORDER BY tablename, policyname;

-- Direct grants: review these together with policies, rather than in isolation.
SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('products', 'orders', 'offer', 'site_settings')
  AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

-- Every overload of the order RPC, its owner, execution mode, and effective access.
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings,
       p.proacl AS explicit_acl,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_can_execute,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('create_order_with_stock', 'create_order_with_stock_v2', 'set_order_status_v2');

-- Existing stock/status triggers must be reconciled with the proposed transaction.
SELECT c.relname AS table_name, t.tgname AS trigger_name, pg_get_triggerdef(t.oid) AS definition,
       pg_get_functiondef(t.tgfoid) AS trigger_function
FROM pg_trigger t
JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('products','orders') AND NOT t.tgisinternal;

SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename IN ('products','orders','checkout_idempotency')
ORDER BY tablename,indexname;
