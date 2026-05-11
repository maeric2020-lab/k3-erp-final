-- =============================================================================
-- K3 ERP — Migration 010
-- Services catalog: service_categories, service_types, services_master
-- =============================================================================

-- -----------------------------------------------------------------------------
-- service_categories  ("Category Section": maintenance services, ...)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,
  name_ar      text NOT NULL,
  name_en      text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES public.users_profile(id),
  updated_by   uuid REFERENCES public.users_profile(id)
);

DROP TRIGGER IF EXISTS trg_service_categories_updated_at ON public.service_categories;
CREATE TRIGGER trg_service_categories_updated_at
  BEFORE UPDATE ON public.service_categories
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- -----------------------------------------------------------------------------
-- service_types  ("Service Type": General Servieces, BELT REPLACING, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE RESTRICT,
  code            text NOT NULL UNIQUE,
  name_ar         text NOT NULL,
  name_en         text NOT NULL,
  display_order   integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES public.users_profile(id),
  updated_by      uuid REFERENCES public.users_profile(id)
);

CREATE INDEX IF NOT EXISTS idx_service_types_category ON public.service_types (category_id);

DROP TRIGGER IF EXISTS trg_service_types_updated_at ON public.service_types;
CREATE TRIGGER trg_service_types_updated_at
  BEFORE UPDATE ON public.service_types
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- -----------------------------------------------------------------------------
-- spare_part_categories  (referenced by services_master.default_part_category_id)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spare_part_categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,
  name_ar      text NOT NULL,
  name_en      text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES public.users_profile(id),
  updated_by   uuid REFERENCES public.users_profile(id)
);

DROP TRIGGER IF EXISTS trg_spare_part_categories_updated_at ON public.spare_part_categories;
CREATE TRIGGER trg_spare_part_categories_updated_at
  BEFORE UPDATE ON public.spare_part_categories
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- -----------------------------------------------------------------------------
-- services_master
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.services_master (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code                text NOT NULL UNIQUE,                 -- auto: SRV-00001
  service_type_id             uuid NOT NULL REFERENCES public.service_types(id) ON DELETE RESTRICT,
  name_ar                     text NOT NULL,
  name_en                     text NOT NULL,
  technical_code              text,                                 -- e.g. ZR81KCE — kept SEPARATE from name
  unit                        text NOT NULL DEFAULT 'service'
                              CHECK (unit IN ('service','piece','meter','kg','hour','set')),
  capacity_hp                 numeric(8,2),                         -- if applicable
  requires_part               boolean NOT NULL DEFAULT false,
  default_part_category_id    uuid REFERENCES public.spare_part_categories(id) ON DELETE SET NULL,
  notes                       text,
  is_active                   boolean NOT NULL DEFAULT true,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  created_by                  uuid REFERENCES public.users_profile(id),
  updated_by                  uuid REFERENCES public.users_profile(id)
);

CREATE INDEX IF NOT EXISTS idx_services_master_type     ON public.services_master (service_type_id);
CREATE INDEX IF NOT EXISTS idx_services_master_active   ON public.services_master (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_services_master_name_ar  ON public.services_master USING gin (name_ar gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_services_master_name_en  ON public.services_master USING gin (name_en gin_trgm_ops);

DROP TRIGGER IF EXISTS trg_services_master_updated_at ON public.services_master;
CREATE TRIGGER trg_services_master_updated_at
  BEFORE UPDATE ON public.services_master
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Auto-assign service code on insert
CREATE OR REPLACE FUNCTION public.fn_services_assign_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.service_code IS NULL OR NEW.service_code = '' THEN
    NEW.service_code := public.fn_next_doc_no('SRV');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_services_assign_code ON public.services_master;
CREATE TRIGGER trg_services_assign_code
  BEFORE INSERT ON public.services_master
  FOR EACH ROW EXECUTE FUNCTION public.fn_services_assign_code();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.service_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spare_part_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services_master        ENABLE ROW LEVEL SECURITY;

-- service_categories
DROP POLICY IF EXISTS sc_select ON public.service_categories;
CREATE POLICY sc_select ON public.service_categories FOR SELECT TO authenticated
  USING (public.fn_is_active_user());

DROP POLICY IF EXISTS sc_write ON public.service_categories;
CREATE POLICY sc_write ON public.service_categories FOR ALL TO authenticated
  USING (public.fn_is_super_admin() OR public.fn_has_screen_permission('service_categories', 'edit'))
  WITH CHECK (public.fn_is_super_admin() OR public.fn_has_screen_permission('service_categories', 'edit'));

-- service_types
DROP POLICY IF EXISTS st_select ON public.service_types;
CREATE POLICY st_select ON public.service_types FOR SELECT TO authenticated
  USING (public.fn_is_active_user());

DROP POLICY IF EXISTS st_write ON public.service_types;
CREATE POLICY st_write ON public.service_types FOR ALL TO authenticated
  USING (public.fn_is_super_admin() OR public.fn_has_screen_permission('service_types', 'edit'))
  WITH CHECK (public.fn_is_super_admin() OR public.fn_has_screen_permission('service_types', 'edit'));

-- spare_part_categories
DROP POLICY IF EXISTS spc_select ON public.spare_part_categories;
CREATE POLICY spc_select ON public.spare_part_categories FOR SELECT TO authenticated
  USING (public.fn_is_active_user());

DROP POLICY IF EXISTS spc_write ON public.spare_part_categories;
CREATE POLICY spc_write ON public.spare_part_categories FOR ALL TO authenticated
  USING (public.fn_is_super_admin() OR public.fn_has_screen_permission('spare_part_categories', 'edit'))
  WITH CHECK (public.fn_is_super_admin() OR public.fn_has_screen_permission('spare_part_categories', 'edit'));

-- services_master
DROP POLICY IF EXISTS sm_select ON public.services_master;
CREATE POLICY sm_select ON public.services_master FOR SELECT TO authenticated
  USING (public.fn_has_screen_permission('services_master', 'view'));

DROP POLICY IF EXISTS sm_insert ON public.services_master;
CREATE POLICY sm_insert ON public.services_master FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_screen_permission('services_master', 'add'));

DROP POLICY IF EXISTS sm_update ON public.services_master;
CREATE POLICY sm_update ON public.services_master FOR UPDATE TO authenticated
  USING (public.fn_has_screen_permission('services_master', 'edit'))
  WITH CHECK (public.fn_has_screen_permission('services_master', 'edit'));

DROP POLICY IF EXISTS sm_delete ON public.services_master;
CREATE POLICY sm_delete ON public.services_master FOR DELETE TO authenticated
  USING (public.fn_has_screen_permission('services_master', 'delete'));
