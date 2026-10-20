-- Account saves already use api/account.py with server-side validation.
-- Deny direct Data API writes that bypass those validation and size limits.
-- Owner-only SELECT and the service role's existing access are preserved.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';
REVOKE INSERT, UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS calvac_profile_insert ON public.profiles;
DROP POLICY IF EXISTS calvac_profile_update ON public.profiles;
COMMIT;
