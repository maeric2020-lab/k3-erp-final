-- =============================================================================
-- K3 ERP — Migration 023
-- Phase 5 — Permissions & Audit
--
-- This migration adds:
--   1. fn_apply_template_to_user()   — bulk-grants template items to a user
--   2. fn_user_permission_grid()      — efficient screen × action lookup for UI
--   3. Phase 5 screen seeds (users, permission_templates, audit_log)
--
-- It does NOT redefine RLS for audit_log — that already exists from migration 004.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- fn_apply_template_to_user(p_user_id, p_template_id, p_replace boolean)
-- Inserts (or upserts) all granted items from the template into
-- user_screen_permissions. If p_replace is true, first deletes ALL existing
-- permissions for that user (used when admin clicks "Replace with template");
-- otherwise the function MERGES (adds missing grants without removing others).
-- Items with granted=false are SKIPPED — granting requires explicit positive
-- intent.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_apply_template_to_user(
  p_user_id     uuid,
  p_template_id uuid,
  p_replace     boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor   uuid := auth.uid();
  v_count   integer := 0;
BEGIN
  -- Only super-admins or users with users:edit can apply templates.
  IF NOT (public.fn_is_super_admin() OR public.fn_has_screen_permission('users', 'edit')) THEN
    RAISE EXCEPTION 'Insufficient permissions to apply template'
      USING ERRCODE = '42501';
  END IF;
  -- The target user must exist.
  IF NOT EXISTS (SELECT 1 FROM public.users_profile WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Target user not found: %', p_user_id;
  END IF;

  IF p_replace THEN
    DELETE FROM public.user_screen_permissions WHERE user_id = p_user_id;
  END IF;

  INSERT INTO public.user_screen_permissions (user_id, screen_code, action, created_by)
  SELECT p_user_id, pti.screen_code, pti.action, v_actor
    FROM public.permission_template_items pti
    JOIN public.permission_templates pt ON pt.id = pti.template_id
   WHERE pti.template_id = p_template_id
     AND pti.granted = true
     AND pt.is_active = true
  ON CONFLICT (user_id, screen_code, action) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Audit
  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, after_data)
  VALUES (
    v_actor,
    CASE WHEN p_replace THEN 'apply_template_replace' ELSE 'apply_template_merge' END,
    'users_profile',
    p_user_id,
    jsonb_build_object('template_id', p_template_id, 'inserted', v_count)
  );

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_apply_template_to_user(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_apply_template_to_user(uuid, uuid, boolean) TO authenticated;

-- -----------------------------------------------------------------------------
-- fn_user_permission_grid(p_user_id)
-- Returns one row per (screen × default_action) pair, marked granted=true if
-- the user has an explicit grant. The UI uses this to render the permission
-- editor; it doesn't need to fetch screens + permissions separately.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_user_permission_grid(p_user_id uuid)
RETURNS TABLE (
  screen_code text,
  module      text,
  label_ar    text,
  label_en    text,
  display_order integer,
  action      text,
  granted     boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- Caller must be super-admin or have users:view
  WITH guard AS (
    SELECT 1 WHERE public.fn_is_super_admin() OR public.fn_has_screen_permission('users', 'view')
  )
  SELECT
    s.code AS screen_code,
    s.module,
    s.label_ar,
    s.label_en,
    s.display_order,
    a AS action,
    EXISTS (
      SELECT 1 FROM public.user_screen_permissions usp
      WHERE usp.user_id = p_user_id
        AND usp.screen_code = s.code
        AND usp.action = a
    ) AS granted
  FROM public.screens s
  CROSS JOIN LATERAL unnest(s.default_actions) AS a
  WHERE EXISTS (SELECT 1 FROM guard)
  ORDER BY s.module, s.display_order, s.code, a;
$$;

REVOKE ALL ON FUNCTION public.fn_user_permission_grid(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_user_permission_grid(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- fn_set_user_active(p_user_id, p_active)
-- Helper for the UI to toggle is_active. Disallows demoting yourself or
-- deactivating yourself (that's a foot-gun); also disallows deactivating the
-- last super-admin.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_set_user_active(
  p_user_id uuid,
  p_active  boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_target_super boolean;
  v_super_count integer;
BEGIN
  IF NOT (public.fn_is_super_admin() OR public.fn_has_screen_permission('users', 'edit')) THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = v_actor AND p_active = false THEN
    RAISE EXCEPTION 'You cannot deactivate yourself';
  END IF;
  -- Last super-admin guard
  SELECT is_super_admin INTO v_target_super FROM public.users_profile WHERE id = p_user_id;
  IF v_target_super AND p_active = false THEN
    SELECT count(*) INTO v_super_count FROM public.users_profile
     WHERE is_super_admin = true AND is_active = true AND is_archived = false;
    IF v_super_count <= 1 THEN
      RAISE EXCEPTION 'Cannot deactivate the last active super-admin';
    END IF;
  END IF;

  UPDATE public.users_profile
     SET is_active = p_active,
         updated_at = now(),
         updated_by = v_actor
   WHERE id = p_user_id;

  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, after_data)
  VALUES (v_actor,
          CASE WHEN p_active THEN 'activate_user' ELSE 'deactivate_user' END,
          'users_profile', p_user_id,
          jsonb_build_object('is_active', p_active));
END;
$$;

REVOKE ALL ON FUNCTION public.fn_set_user_active(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_set_user_active(uuid, boolean) TO authenticated;

-- -----------------------------------------------------------------------------
-- Phase 5 screen seeds
-- -----------------------------------------------------------------------------
INSERT INTO public.screens (code, module, label_ar, label_en, default_actions, display_order) VALUES
  ('users',                'admin', 'المستخدمون',         'Users',                 ARRAY['view','add','edit','delete'],     10),
  ('permission_templates', 'admin', 'قوالب الصلاحيات',     'Permission templates',  ARRAY['view','add','edit','delete'],     11),
  ('audit_log',            'admin', 'سجل التدقيق',         'Audit log',             ARRAY['view','export'],                  20)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Audit log: relax RLS so users with audit_log:view can read it
-- (existing policy was super_admin-only).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_log_select_admin ON public.audit_log;
CREATE POLICY audit_log_select_admin ON public.audit_log FOR SELECT TO authenticated
  USING (public.fn_is_super_admin() OR public.fn_has_screen_permission('audit_log', 'view'));

-- Inserts already happen via triggers (SECURITY DEFINER paths); no INSERT policy needed.
