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
  FOR SELECT USING (public.trfc_member_id() IS NOT NULL OR public.trfc_is_admin());
CREATE POLICY trfc_updates_admin_write ON public.updates
  FOR ALL USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());

CREATE POLICY trfc_fixtures_read ON public.fixtures
  FOR SELECT USING (public.trfc_member_id() IS NOT NULL OR public.trfc_is_admin());
CREATE POLICY trfc_fixtures_admin_write ON public.fixtures
  FOR ALL USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());

CREATE POLICY trfc_standings_read ON public.standings
  FOR SELECT USING (public.trfc_member_id() IS NOT NULL OR public.trfc_is_admin());
CREATE POLICY trfc_standings_admin_write ON public.standings
  FOR ALL USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());

CREATE POLICY trfc_club_updates_read ON public.club_updates
  FOR SELECT USING (public.trfc_member_id() IS NOT NULL OR public.trfc_is_admin());
CREATE POLICY trfc_club_updates_admin_write ON public.club_updates
  FOR ALL USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());

CREATE POLICY trfc_players_read ON public.players
  FOR SELECT USING (public.trfc_member_id() IS NOT NULL OR public.trfc_is_admin());
CREATE POLICY trfc_players_admin_write ON public.players
  FOR ALL USING (public.trfc_is_admin()) WITH CHECK (public.trfc_is_admin());

CREATE POLICY trfc_settings_read ON public.club_settings
  FOR SELECT USING (public.trfc_member_id() IS NOT NULL OR public.trfc_is_admin());
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
