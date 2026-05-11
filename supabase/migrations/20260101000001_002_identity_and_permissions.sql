-- =============================================================================
-- K3 ERP — Migration 002
-- Identity & permissions: users_profile, screens, user_screen_permissions
-- =============================================================================

-- -----------------------------------------------------------------------------
-- users_profile  (1-to-1 with auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users_profile (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name_ar    text,
  full_name_en    text,
  phone           text,
  email           citext NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  is_archived     boolean NOT NULL DEFAULT false,
  is_super_admin  boolean NOT NULL DEFAULT false,
  technician_id   uuid,                                  -- FK added in later migration once technicians table exists
  language_pref   text NOT NULL DEFAULT 'ar' CHECK (language_pref IN ('ar', 'en')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES public.users_profile(id),
  updated_by      uuid REFERENCES public.users_profile(id)
);

CREATE INDEX IF NOT EXISTS idx_users_profile_email      ON public.users_profile (email);
CREATE INDEX IF NOT EXISTS idx_users_profile_is_active  ON public.users_profile (is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_users_profile_updated_at ON public.users_profile;
CREATE TRIGGER trg_users_profile_updated_at
  BEFORE UPDATE ON public.users_profile
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

COMMENT ON TABLE  public.users_profile IS 'Application-level profile linked 1:1 to auth.users.';
COMMENT ON COLUMN public.users_profile.is_super_admin IS 'True only for the seed Admin and explicitly elevated users.';

-- -----------------------------------------------------------------------------
-- screens  (catalog, populated by seed migration; read-only for users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.screens (
  code              text PRIMARY KEY,
  module            text NOT NULL,
  label_ar          text NOT NULL,
  label_en          text NOT NULL,
  default_actions   text[] NOT NULL DEFAULT ARRAY['view'],
  display_order     integer NOT NULL DEFAULT 0,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_screens_module         ON public.screens (module, display_order);

DROP TRIGGER IF EXISTS trg_screens_updated_at ON public.screens;
CREATE TRIGGER trg_screens_updated_at
  BEFORE UPDATE ON public.screens
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

COMMENT ON TABLE public.screens IS 'Catalog of all UI screens. Permissions are granted per (user, screen, action).';

-- -----------------------------------------------------------------------------
-- user_screen_permissions  (per-user × screen × action grants)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_screen_permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  screen_code text NOT NULL REFERENCES public.screens(code) ON DELETE CASCADE,
  action      text NOT NULL CHECK (action IN ('view','add','edit','delete','print','export','approve','assign','import')),
  granted     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES public.users_profile(id),
  updated_by  uuid REFERENCES public.users_profile(id),
  UNIQUE (user_id, screen_code, action)
);

CREATE INDEX IF NOT EXISTS idx_user_screen_perms_user        ON public.user_screen_permissions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_screen_perms_screen      ON public.user_screen_permissions (screen_code);

DROP TRIGGER IF EXISTS trg_user_screen_perms_updated_at ON public.user_screen_permissions;
CREATE TRIGGER trg_user_screen_perms_updated_at
  BEFORE UPDATE ON public.user_screen_permissions
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- -----------------------------------------------------------------------------
-- permission_templates  (Admin saves permission bundles, e.g. "Technician")
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permission_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES public.users_profile(id),
  updated_by  uuid REFERENCES public.users_profile(id)
);

CREATE TABLE IF NOT EXISTS public.permission_template_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid NOT NULL REFERENCES public.permission_templates(id) ON DELETE CASCADE,
  screen_code   text NOT NULL REFERENCES public.screens(code) ON DELETE CASCADE,
  action        text NOT NULL,
  granted       boolean NOT NULL DEFAULT true,
  UNIQUE (template_id, screen_code, action)
);

DROP TRIGGER IF EXISTS trg_permission_templates_updated_at ON public.permission_templates;
CREATE TRIGGER trg_permission_templates_updated_at
  BEFORE UPDATE ON public.permission_templates
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- -----------------------------------------------------------------------------
-- HELPER FUNCTIONS used by RLS policies everywhere
-- -----------------------------------------------------------------------------

-- fn_current_user_id() — wraps auth.uid() for clarity
CREATE OR REPLACE FUNCTION public.fn_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid();
$$;

-- fn_is_super_admin()
CREATE OR REPLACE FUNCTION public.fn_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.users_profile WHERE id = auth.uid()),
    false
  );
$$;

-- fn_is_active_user()
CREATE OR REPLACE FUNCTION public.fn_is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT is_active AND NOT is_archived FROM public.users_profile WHERE id = auth.uid()),
    false
  );
$$;

-- fn_has_screen_permission(screen, action)
CREATE OR REPLACE FUNCTION public.fn_has_screen_permission(p_screen_code text, p_action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    public.fn_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_screen_permissions p
      WHERE p.user_id     = auth.uid()
        AND p.screen_code = p_screen_code
        AND p.action      = p_action
        AND p.granted     = true
    );
$$;

COMMENT ON FUNCTION public.fn_has_screen_permission IS 'Returns true if current user is super_admin OR has explicit grant for (screen, action).';
