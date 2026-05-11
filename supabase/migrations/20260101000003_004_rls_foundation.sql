-- =============================================================================
-- K3 ERP — Migration 004
-- Row Level Security policies for foundation tables
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enable RLS on every foundation table
-- -----------------------------------------------------------------------------
ALTER TABLE public.users_profile               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screens                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_screen_permissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_template_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numbering_sequences         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log                   ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- users_profile policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS users_profile_select_self_or_admin ON public.users_profile;
CREATE POLICY users_profile_select_self_or_admin
  ON public.users_profile FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.fn_is_super_admin()
    OR public.fn_has_screen_permission('users', 'view')
  );

DROP POLICY IF EXISTS users_profile_update_self ON public.users_profile;
CREATE POLICY users_profile_update_self
  ON public.users_profile FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- A user updating themselves CANNOT toggle is_super_admin or is_active
    AND (SELECT is_super_admin FROM public.users_profile WHERE id = auth.uid()) IS NOT DISTINCT FROM is_super_admin
    AND (SELECT is_active      FROM public.users_profile WHERE id = auth.uid()) IS NOT DISTINCT FROM is_active
  );

DROP POLICY IF EXISTS users_profile_admin_all ON public.users_profile;
CREATE POLICY users_profile_admin_all
  ON public.users_profile FOR ALL
  TO authenticated
  USING (public.fn_is_super_admin() OR public.fn_has_screen_permission('users', 'edit'))
  WITH CHECK (public.fn_is_super_admin() OR public.fn_has_screen_permission('users', 'edit'));

-- -----------------------------------------------------------------------------
-- screens policies (read by all active users; write by super_admin only)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS screens_select_authenticated ON public.screens;
CREATE POLICY screens_select_authenticated
  ON public.screens FOR SELECT
  TO authenticated
  USING (public.fn_is_active_user());

DROP POLICY IF EXISTS screens_super_admin_write ON public.screens;
CREATE POLICY screens_super_admin_write
  ON public.screens FOR ALL
  TO authenticated
  USING (public.fn_is_super_admin())
  WITH CHECK (public.fn_is_super_admin());

-- -----------------------------------------------------------------------------
-- user_screen_permissions policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS user_screen_perms_select ON public.user_screen_permissions;
CREATE POLICY user_screen_perms_select
  ON public.user_screen_permissions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.fn_is_super_admin()
    OR public.fn_has_screen_permission('users_permissions', 'view')
  );

DROP POLICY IF EXISTS user_screen_perms_admin_write ON public.user_screen_permissions;
CREATE POLICY user_screen_perms_admin_write
  ON public.user_screen_permissions FOR ALL
  TO authenticated
  USING (public.fn_is_super_admin() OR public.fn_has_screen_permission('users_permissions', 'edit'))
  WITH CHECK (public.fn_is_super_admin() OR public.fn_has_screen_permission('users_permissions', 'edit'));

-- -----------------------------------------------------------------------------
-- permission_templates  policies (admin only)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS permission_templates_admin ON public.permission_templates;
CREATE POLICY permission_templates_admin
  ON public.permission_templates FOR ALL
  TO authenticated
  USING (public.fn_is_super_admin() OR public.fn_has_screen_permission('roles_templates', 'view'))
  WITH CHECK (public.fn_is_super_admin() OR public.fn_has_screen_permission('roles_templates', 'edit'));

DROP POLICY IF EXISTS permission_template_items_admin ON public.permission_template_items;
CREATE POLICY permission_template_items_admin
  ON public.permission_template_items FOR ALL
  TO authenticated
  USING (public.fn_is_super_admin() OR public.fn_has_screen_permission('roles_templates', 'view'))
  WITH CHECK (public.fn_is_super_admin() OR public.fn_has_screen_permission('roles_templates', 'edit'));

-- -----------------------------------------------------------------------------
-- company_settings — read by all active users; edit gated by screen permission
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS company_settings_select ON public.company_settings;
CREATE POLICY company_settings_select
  ON public.company_settings FOR SELECT
  TO authenticated
  USING (public.fn_is_active_user());

DROP POLICY IF EXISTS company_settings_update ON public.company_settings;
CREATE POLICY company_settings_update
  ON public.company_settings FOR UPDATE
  TO authenticated
  USING (public.fn_is_super_admin() OR public.fn_has_screen_permission('company_settings', 'edit'))
  WITH CHECK (public.fn_is_super_admin() OR public.fn_has_screen_permission('company_settings', 'edit'));

-- INSERT only allowed by super_admin (only ever 1 row, seeded by bootstrap)
DROP POLICY IF EXISTS company_settings_insert_super ON public.company_settings;
CREATE POLICY company_settings_insert_super
  ON public.company_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.fn_is_super_admin());

-- -----------------------------------------------------------------------------
-- numbering_sequences — read by all; write by super_admin only
-- (writes happen exclusively through fn_next_doc_no with SECURITY DEFINER)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS numbering_sequences_select ON public.numbering_sequences;
CREATE POLICY numbering_sequences_select
  ON public.numbering_sequences FOR SELECT
  TO authenticated
  USING (public.fn_is_active_user());

DROP POLICY IF EXISTS numbering_sequences_admin ON public.numbering_sequences;
CREATE POLICY numbering_sequences_admin
  ON public.numbering_sequences FOR ALL
  TO authenticated
  USING (public.fn_is_super_admin() OR public.fn_has_screen_permission('numbering_sequences', 'edit'))
  WITH CHECK (public.fn_is_super_admin() OR public.fn_has_screen_permission('numbering_sequences', 'edit'));

-- -----------------------------------------------------------------------------
-- audit_log — super_admin only; inserts done by triggers (security definer)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_log_super_admin ON public.audit_log;
CREATE POLICY audit_log_super_admin
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.fn_is_super_admin() OR public.fn_has_screen_permission('audit_log', 'view'));

-- No INSERT/UPDATE/DELETE policies → denied for normal callers.
-- Triggers using SECURITY DEFINER will bypass RLS for inserts.
