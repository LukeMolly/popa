-- Township Rollers Membership Platform
-- Row Level Security (RLS) hardening migration
-- PREPARED ONLY: review/test in Supabase before applying to Production.
--
-- Authentication note:
-- The application currently uses its own member/admin sessions over a direct
-- PostgreSQL connection rather than Supabase Auth. These policies therefore
-- support an explicit transaction-local application context:
--   SET LOCAL app.member_id = 'TRFC-...';
--   SET LOCAL app.admin_role = 'membership'; -- or executive
-- The Supabase anon/authenticated roles receive no broad access to private
-- membership tables. A database owner/service role may bypass RLS by design.
--
-- IMPORTANT: do not FORCE ROW LEVEL SECURITY while the application connection
-- still relies on an owner/bypassrls role. Migrate the application to a
-- restricted database role + transaction-local context before using FORCE RLS.

BEGIN;

-- Helpers are deliberately based only on transaction-local settings. Do not
-- accept member/admin identity from browser-controlled request fields.
CREATE OR REPLACE FUNCTION public.trfc_member_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.member_id', true), '');
$$;

CREATE OR REPLACE FUNCTION public.trfc_admin_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.admin_role', true), '');
$$;

CREATE OR REPLACE FUNCTION public.trfc_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(public.trfc_admin_role() IN ('executive','membership'), false);
$$;

REVOKE ALL ON FUNCTION public.trfc_member_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_admin_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_is_admin() FROM PUBLIC;

-- The restricted application role must be able to evaluate policy helpers.
GRANT EXECUTE ON FUNCTION public.trfc_member_id() TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_admin_role() TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_is_admin() TO trfc_app;

-- Bootstrap functions are the narrow bridge used before an RLS identity is known.
-- They expose only the records needed to validate a login/session; application
-- code still performs the existing scrypt/PBKDF2 verification.
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_member_login(p_identifier text, p_is_phone boolean)
RETURNS TABLE(id text, password_salt text, password_hash text, password_must_change boolean, email_verified_at text, phone_verified_at text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
  SELECT m.id,m.password_salt,m.password_hash,m.password_must_change,m.email_verified_at::text,m.phone_verified_at::text
  FROM public.members m
  WHERE (p_is_phone AND m.phone=p_identifier)
     OR (NOT p_is_phone AND lower(m.email)=lower(p_identifier))
  LIMIT 1;
$;

CREATE OR REPLACE FUNCTION public.trfc_bootstrap_member_session(p_token_hash text, p_now text)
RETURNS TABLE(id text, email text, first_name text, last_name text, password_must_change boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
  SELECT m.id,m.email,m.first_name,m.last_name,m.password_must_change
  FROM public.member_sessions s JOIN public.members m ON m.id=s.member_id
  WHERE s.token_hash=p_token_hash AND s.expires_at>p_now
  LIMIT 1;
$;

CREATE OR REPLACE FUNCTION public.trfc_bootstrap_admin_login(p_email text)
RETURNS TABLE(email text, name text, role text, pin_salt text, pin_hash text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
  SELECT a.email,a.name,a.role,a.pin_salt,a.pin_hash FROM public.admin_users a
  WHERE lower(a.email)=lower(p_email) AND a.active=1 LIMIT 1;
$;

CREATE OR REPLACE FUNCTION public.trfc_bootstrap_admin_session(p_token_hash text, p_now text)
RETURNS TABLE(email text, name text, role text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
  SELECT a.email,a.name,a.role FROM public.admin_sessions s
  JOIN public.admin_users a ON a.email=s.email
  WHERE s.token_hash=p_token_hash AND s.expires_at>p_now AND a.active=1 LIMIT 1;
$;

REVOKE ALL ON FUNCTION public.trfc_bootstrap_member_login(text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_member_session(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_admin_login(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_admin_session(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_member_login(text,boolean) TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_member_session(text,text) TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_admin_login(text) TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_admin_session(text,text) TO trfc_app;

-- Bootstrap write helpers keep pre-authentication security tables behind a
-- deliberately small interface instead of granting broad RLS exceptions.
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_create_member_session(p_token_hash text,p_member_id text,p_expires_at text,p_created_at text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $
 INSERT INTO public.member_sessions(token_hash,member_id,expires_at,created_at) VALUES(p_token_hash,p_member_id,p_expires_at,p_created_at);
$;
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_delete_member_session(p_token_hash text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $ DELETE FROM public.member_sessions WHERE token_hash=p_token_hash; $;
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_set_member_attempt(p_key text,p_failed integer,p_locked text,p_updated text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $
 INSERT INTO public.member_login_attempts(email,failed_count,locked_until,updated_at) VALUES(p_key,p_failed,p_locked,p_updated)
 ON CONFLICT(email) DO UPDATE SET failed_count=excluded.failed_count,locked_until=excluded.locked_until,updated_at=excluded.updated_at;
$;
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_clear_member_attempt(p_key text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $ DELETE FROM public.member_login_attempts WHERE email=p_key; $;
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_create_admin_session(p_token_hash text,p_email text,p_expires_at text,p_created_at text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $
 INSERT INTO public.admin_sessions(token_hash,email,expires_at,created_at) VALUES(p_token_hash,p_email,p_expires_at,p_created_at);
$;
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_delete_admin_sessions(p_email text,p_now text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $ DELETE FROM public.admin_sessions WHERE email=p_email OR expires_at<=p_now; $;
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_delete_admin_session(p_token_hash text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $ DELETE FROM public.admin_sessions WHERE token_hash=p_token_hash; $;
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_set_admin_attempt(p_email text,p_failed integer,p_locked text,p_updated text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $
 INSERT INTO public.admin_login_attempts(email,failed_count,locked_until,updated_at) VALUES(p_email,p_failed,p_locked,p_updated)
 ON CONFLICT(email) DO UPDATE SET failed_count=excluded.failed_count,locked_until=excluded.locked_until,updated_at=excluded.updated_at;
$;
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_clear_admin_attempt(p_email text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $ DELETE FROM public.admin_login_attempts WHERE email=p_email; $;

REVOKE ALL ON FUNCTION public.trfc_bootstrap_create_member_session(text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_delete_member_session(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_set_member_attempt(text,integer,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_clear_member_attempt(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_create_admin_session(text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_delete_admin_sessions(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_delete_admin_session(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_set_admin_attempt(text,integer,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_clear_admin_attempt(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_create_member_session(text,text,text,text) TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_delete_member_session(text) TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_set_member_attempt(text,integer,text,text) TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_clear_member_attempt(text) TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_create_admin_session(text,text,text,text) TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_delete_admin_sessions(text,text) TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_delete_admin_session(text) TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_set_admin_attempt(text,integer,text,text) TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_clear_admin_attempt(text) TO trfc_app;

-- Public registration is intentionally a single SECURITY DEFINER operation.
-- It creates only a pending member and its submitted registration payment;
-- callers cannot choose an active status or review state.
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_register_member(
 p_id text,p_first text,p_last text,p_phone text,p_email text,p_expires text,p_token text,p_created text,
 p_id_number text,p_dob text,p_birth_place text,p_location text,p_gender text,p_password_salt text,p_password_hash text,
 p_payment_id text,p_amount numeric,p_receipt_key text,p_receipt_name text,p_receipt_type text,p_reference text,p_payment_method text,p_payment_detail text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $
BEGIN
 INSERT INTO public.members(id,first_name,last_name,phone,email,status,expires_at,token,created_at,id_number,date_of_birth,place_of_birth,membership_location,gender,password_salt,password_hash,password_must_change)
 VALUES(p_id,p_first,p_last,NULLIF(p_phone,''),p_email,'pending',p_expires,p_token,p_created,p_id_number,p_dob,p_birth_place,p_location,p_gender,p_password_salt,p_password_hash,FALSE);
 INSERT INTO public.payments(id,member_id,amount,receipt_key,receipt_name,receipt_type,reference,status,note,created_at,reviewed_at,reviewed_by,payment_method,payment_method_detail)
 VALUES(p_payment_id,p_id,p_amount,p_receipt_key,p_receipt_name,p_receipt_type,p_reference,'submitted','Registration payment',p_created,'','',p_payment_method,p_payment_detail);
END; $;

CREATE OR REPLACE FUNCTION public.trfc_bootstrap_registration_duplicate(p_email text,p_phone text,p_id_number text)
RETURNS TABLE(id text,email text,phone text,id_number text)
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $
 SELECT m.id,m.email,m.phone,m.id_number FROM public.members m
 WHERE (p_email<>'' AND m.email<>'' AND lower(m.email)=lower(p_email))
    OR (p_phone<>'' AND m.phone<>'' AND m.phone=p_phone)
    OR upper(m.id_number)=upper(p_id_number) LIMIT 1;
$;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_register_member(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,numeric,text,text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_registration_duplicate(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_register_member(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,numeric,text,text,text,text,text,text) TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_registration_duplicate(text,text,text) TO trfc_app;




-- Login-attempt bootstrap reads used before an authenticated context exists.
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_member_attempt(p_key text)
RETURNS TABLE(failed_count integer,locked_until text)
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $
 SELECT a.failed_count,a.locked_until FROM public.member_login_attempts a WHERE a.email=p_key LIMIT 1
$;
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_admin_attempt(p_email text)
RETURNS TABLE(failed_count integer,locked_until text)
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $
 SELECT a.failed_count,a.locked_until FROM public.admin_login_attempts a WHERE a.email=p_email LIMIT 1
$;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_member_attempt(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_admin_attempt(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_member_attempt(text) TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_admin_attempt(text) TO trfc_app;

-- System-only expiry bootstrap. The application role may execute the expiry
-- transition, but the function only targets already-due active memberships.
CREATE OR REPLACE FUNCTION public.trfc_system_expire_due_memberships(p_today text)
RETURNS TABLE(id text,email text,first_name text,last_name text,expires_at text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $
BEGIN
 RETURN QUERY
 WITH due AS (
   UPDATE public.members m SET status='expired'
   WHERE m.status='active' AND m.expires_at<>'' AND m.expires_at<p_today
   RETURNING m.id,m.email,m.first_name,m.last_name,m.expires_at
 )
 SELECT d.id,d.email,d.first_name,d.last_name,d.expires_at FROM due d;
END;
$;
REVOKE ALL ON FUNCTION public.trfc_system_expire_due_memberships(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trfc_system_expire_due_memberships(text) TO trfc_app;

-- Narrow password-recovery bootstrap functions. They intentionally return only
-- the fields needed by the recovery workflow and keep the public response generic.
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_recovery_member(p_member_id text,p_email text)
RETURNS TABLE(id text,first_name text,last_name text,email text)
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $
 SELECT m.id,m.first_name,m.last_name,m.email FROM public.members m
 WHERE m.id=p_member_id AND lower(m.email)=lower(p_email) LIMIT 1
$;
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_recovery_recent(p_member_id text)
RETURNS TABLE(id text,requested_at text)
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $
 SELECT r.id,r.requested_at FROM public.password_recovery_requests r
 WHERE r.member_id=p_member_id AND r.status='pending'
 ORDER BY r.requested_at DESC LIMIT 1
$;
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_recovery_create(p_id text,p_member_id text,p_email text,p_requested text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $
 INSERT INTO public.password_recovery_requests(id,member_id,email,status,requested_at,resolved_at,resolved_by)
 VALUES(p_id,p_member_id,p_email,'pending',p_requested,'','')
$;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_recovery_member(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_recovery_recent(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_recovery_create(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_recovery_member(text,text) TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_recovery_recent(text) TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_recovery_create(text,text,text,text) TO trfc_app;

-- Narrow OTP bootstrap functions. The application role can operate OTP records
-- without receiving general table access through RLS.
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_phone_otp_count(p_phone text,p_since text)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $
 SELECT count(*) FROM public.phone_otp_codes WHERE phone=p_phone AND created_at>=p_since
$;
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_phone_otp_create(p_id text,p_phone text,p_hash text,p_expires text,p_created text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $
 INSERT INTO public.phone_otp_codes(id,phone,code_hash,expires_at,used_at,created_at)
 VALUES(p_id,p_phone,p_hash,p_expires,'',p_created)
$;
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_phone_otp_latest(p_phone text)
RETURNS TABLE(id text,code_hash text,expires_at text) LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $
 SELECT o.id,o.code_hash,o.expires_at FROM public.phone_otp_codes o
 WHERE o.phone=p_phone AND o.used_at='' ORDER BY o.created_at DESC LIMIT 1
$;
CREATE OR REPLACE FUNCTION public.trfc_bootstrap_phone_otp_use(p_id text,p_used text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $
 UPDATE public.phone_otp_codes SET used_at=p_used WHERE id=p_id AND used_at=''
$;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_phone_otp_count(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_phone_otp_create(text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_phone_otp_latest(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trfc_bootstrap_phone_otp_use(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_phone_otp_count(text,text) TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_phone_otp_create(text,text,text,text,text) TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_phone_otp_latest(text) TO trfc_app;
GRANT EXECUTE ON FUNCTION public.trfc_bootstrap_phone_otp_use(text,text) TO trfc_app;

-- Index every ownership/join predicate used by policies and common member views.
CREATE INDEX IF NOT EXISTS idx_payments_member_created
  ON public.payments (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promos_member
  ON public.promos (member_id) WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_member_notifications_member_updated
  ON public.member_notifications (member_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_messages_notification
  ON public.member_notification_messages (notification_id);
CREATE INDEX IF NOT EXISTS idx_member_sessions_member
  ON public.member_sessions (member_id);
CREATE INDEX IF NOT EXISTS idx_member_sessions_expiry
  ON public.member_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_password_recovery_member_status
  ON public.password_recovery_requests (member_id, status);
CREATE INDEX IF NOT EXISTS idx_email_verification_member_expiry
  ON public.email_verification_tokens (member_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_email
  ON public.admin_sessions (email);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry
  ON public.admin_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_members_token
  ON public.members (token);
CREATE INDEX IF NOT EXISTS idx_members_id_status
  ON public.members (id, status);

-- Enable RLS on all application tables.
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_notification_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_delivery_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_recovery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_otp_codes ENABLE ROW LEVEL SECURITY;

-- Re-running this migration should replace policies cleanly.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN (
        'members','promos','updates','payments','fixtures','standings',
        'club_updates','member_notifications','member_notification_messages',
        'players','club_settings','audit_logs','email_verification_tokens',
        'email_delivery_log','password_recovery_requests','admin_users',
        'admin_sessions','admin_login_attempts','member_sessions',
        'member_login_attempts','phone_otp_codes'
      )
      AND policyname LIKE 'trfc_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- MEMBER DATA ---------------------------------------------------------------
-- Members may see their own membership record. Admins may manage all records.
CREATE POLICY trfc_members_select ON public.members
  FOR SELECT USING (id = public.trfc_member_id() OR public.trfc_is_admin());
CREATE POLICY trfc_members_update ON public.members
  FOR UPDATE
  USING (id = public.trfc_member_id() OR public.trfc_is_admin())
  WITH CHECK (id = public.trfc_member_id() OR public.trfc_is_admin());
CREATE POLICY trfc_members_insert_admin ON public.members
  FOR INSERT WITH CHECK (public.trfc_is_admin());
CREATE POLICY trfc_members_delete_admin ON public.members
  FOR DELETE USING (public.trfc_admin_role() = 'executive');

CREATE POLICY trfc_payments_select ON public.payments
  FOR SELECT USING (member_id = public.trfc_member_id() OR public.trfc_is_admin());
CREATE POLICY trfc_payments_insert ON public.payments
  FOR INSERT WITH CHECK (member_id = public.trfc_member_id() OR public.trfc_is_admin());
CREATE POLICY trfc_payments_update_admin ON public.payments
  FOR UPDATE USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());
CREATE POLICY trfc_payments_delete_admin ON public.payments
  FOR DELETE USING (public.trfc_admin_role() = 'executive');

CREATE POLICY trfc_promos_select ON public.promos
  FOR SELECT USING (member_id = public.trfc_member_id() OR public.trfc_is_admin());
CREATE POLICY trfc_promos_admin_write ON public.promos
  FOR ALL USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());

CREATE POLICY trfc_notifications_select ON public.member_notifications
  FOR SELECT USING (member_id = public.trfc_member_id() OR public.trfc_is_admin());
CREATE POLICY trfc_notifications_insert ON public.member_notifications
  FOR INSERT WITH CHECK (member_id = public.trfc_member_id() OR public.trfc_is_admin());
CREATE POLICY trfc_notifications_update ON public.member_notifications
  FOR UPDATE
  USING (member_id = public.trfc_member_id() OR public.trfc_is_admin())
  WITH CHECK (member_id = public.trfc_member_id() OR public.trfc_is_admin());
CREATE POLICY trfc_notifications_delete_admin ON public.member_notifications
  FOR DELETE USING (public.trfc_admin_role() = 'executive');

CREATE POLICY trfc_notification_messages_select ON public.member_notification_messages
  FOR SELECT USING (
    public.trfc_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.member_notifications n
      WHERE n.id = notification_id AND n.member_id = public.trfc_member_id()
    )
  );
CREATE POLICY trfc_notification_messages_insert ON public.member_notification_messages
  FOR INSERT WITH CHECK (
    public.trfc_is_admin()
    OR (
      sender_role = 'member'
      AND EXISTS (
        SELECT 1 FROM public.member_notifications n
        WHERE n.id = notification_id AND n.member_id = public.trfc_member_id()
      )
    )
  );
CREATE POLICY trfc_notification_messages_admin_write ON public.member_notification_messages
  FOR UPDATE USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());
CREATE POLICY trfc_notification_messages_admin_delete ON public.member_notification_messages
  FOR DELETE USING (public.trfc_admin_role() = 'executive');

CREATE POLICY trfc_recovery_select ON public.password_recovery_requests
  FOR SELECT USING (member_id = public.trfc_member_id() OR public.trfc_is_admin());
CREATE POLICY trfc_recovery_insert ON public.password_recovery_requests
  FOR INSERT WITH CHECK (member_id = public.trfc_member_id() OR public.trfc_is_admin());
CREATE POLICY trfc_recovery_admin_update ON public.password_recovery_requests
  FOR UPDATE USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());
CREATE POLICY trfc_recovery_admin_delete ON public.password_recovery_requests
  FOR DELETE USING (public.trfc_admin_role() = 'executive');

-- SESSION / VERIFICATION TABLES ---------------------------------------------
-- These are server-side security tables. Members can only see/remove their own
-- member sessions when the trusted application context has already identified
-- them. Token/OTP tables are not exposed to ordinary members.
CREATE POLICY trfc_member_sessions_select ON public.member_sessions
  FOR SELECT USING (member_id = public.trfc_member_id() OR public.trfc_is_admin());
CREATE POLICY trfc_member_sessions_insert ON public.member_sessions
  FOR INSERT WITH CHECK (member_id = public.trfc_member_id() OR public.trfc_is_admin());
CREATE POLICY trfc_member_sessions_delete ON public.member_sessions
  FOR DELETE USING (member_id = public.trfc_member_id() OR public.trfc_is_admin());

CREATE POLICY trfc_email_tokens_admin ON public.email_verification_tokens
  FOR ALL USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());
CREATE POLICY trfc_phone_otp_admin ON public.phone_otp_codes
  FOR ALL USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());
CREATE POLICY trfc_member_login_attempts_admin ON public.member_login_attempts
  FOR ALL USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());

-- ADMIN / AUDIT TABLES -------------------------------------------------------
CREATE POLICY trfc_admin_users_read ON public.admin_users
  FOR SELECT USING (public.trfc_is_admin());
CREATE POLICY trfc_admin_users_write ON public.admin_users
  FOR ALL USING (public.trfc_admin_role() = 'executive')
  WITH CHECK (public.trfc_admin_role() = 'executive');

CREATE POLICY trfc_admin_sessions ON public.admin_sessions
  FOR ALL USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());
CREATE POLICY trfc_admin_login_attempts ON public.admin_login_attempts
  FOR ALL USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());

CREATE POLICY trfc_audit_read ON public.audit_logs
  FOR SELECT USING (public.trfc_is_admin());
CREATE POLICY trfc_audit_insert ON public.audit_logs
  FOR INSERT WITH CHECK (public.trfc_is_admin());
-- Audit rows intentionally have no UPDATE/DELETE policy.

CREATE POLICY trfc_email_delivery_admin ON public.email_delivery_log
  FOR ALL USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());

-- CLUB / PUBLIC-FACING DATA --------------------------------------------------
-- These tables are safe for read-only member access in the application context.
-- No anonymous Supabase REST access is granted by these policies.
CREATE POLICY trfc_updates_read ON public.updates
  FOR SELECT USING (true);
CREATE POLICY trfc_updates_admin_write ON public.updates
  FOR ALL USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());

CREATE POLICY trfc_fixtures_read ON public.fixtures
  FOR SELECT USING (true);
CREATE POLICY trfc_fixtures_admin_write ON public.fixtures
  FOR ALL USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());

CREATE POLICY trfc_standings_read ON public.standings
  FOR SELECT USING (true);
CREATE POLICY trfc_standings_admin_write ON public.standings
  FOR ALL USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());

CREATE POLICY trfc_club_updates_read ON public.club_updates
  FOR SELECT USING (true);
CREATE POLICY trfc_club_updates_admin_write ON public.club_updates
  FOR ALL USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());

CREATE POLICY trfc_players_read ON public.players
  FOR SELECT USING (true);
CREATE POLICY trfc_players_admin_write ON public.players
  FOR ALL USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());

CREATE POLICY trfc_settings_read ON public.club_settings
  FOR SELECT USING (true);
CREATE POLICY trfc_settings_admin_write ON public.club_settings
  FOR ALL USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());

COMMIT;

-- Verification queries to run after applying:
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
--
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies WHERE schemaname='public' AND policyname LIKE 'trfc_%'
-- ORDER BY tablename, policyname;
--
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE schemaname='public' AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;
