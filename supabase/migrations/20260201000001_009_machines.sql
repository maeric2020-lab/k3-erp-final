-- =============================================================================
-- K3 ERP — Migration 009
-- Machine catalog: categories, brands, refrigerants, machines master
-- =============================================================================

-- -----------------------------------------------------------------------------
-- machine_categories
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.machine_categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,                    -- 'SPLT', 'PKG', 'CHILLER', 'VRV', 'FCU', 'AHU'
  name_ar      text NOT NULL,
  name_en      text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES public.users_profile(id),
  updated_by   uuid REFERENCES public.users_profile(id)
);

DROP TRIGGER IF EXISTS trg_machine_categories_updated_at ON public.machine_categories;
CREATE TRIGGER trg_machine_categories_updated_at
  BEFORE UPDATE ON public.machine_categories
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- -----------------------------------------------------------------------------
-- machine_brands
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.machine_brands (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL UNIQUE,
  country_origin text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES public.users_profile(id),
  updated_by   uuid REFERENCES public.users_profile(id)
);

DROP TRIGGER IF EXISTS trg_machine_brands_updated_at ON public.machine_brands;
CREATE TRIGGER trg_machine_brands_updated_at
  BEFORE UPDATE ON public.machine_brands
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- -----------------------------------------------------------------------------
-- refrigerant_types
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.refrigerant_types (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,                    -- 'R22', 'R410A', 'R407C', 'R32', 'R134A'
  name         text NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Seed common refrigerants (matches your contract pricing Excel)
INSERT INTO public.refrigerant_types (code, name) VALUES
  ('R22',   'R22'),
  ('R410A', 'R410A'),
  ('R407C', 'R407C'),
  ('R32',   'R32'),
  ('R134A', 'R134A')
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- machines_master — catalog of machine models the company services
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.machines_master (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id       uuid NOT NULL REFERENCES public.machine_categories(id) ON DELETE RESTRICT,
  brand_id          uuid REFERENCES public.machine_brands(id) ON DELETE SET NULL,
  refrigerant_id    uuid REFERENCES public.refrigerant_types(id) ON DELETE SET NULL,
  outdoor_model     text,
  indoor_model      text,
  capacity_hp       numeric(8,2),
  capacity_tr       numeric(8,2),
  btu_h             integer,
  cfm               integer,
  kw                numeric(8,2),
  country_origin    text,
  notes             text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES public.users_profile(id),
  updated_by        uuid REFERENCES public.users_profile(id),
  -- Business uniqueness: a model is uniquely identified by (category, brand, outdoor, indoor, refrigerant)
  UNIQUE (category_id, brand_id, outdoor_model, indoor_model, refrigerant_id)
);

CREATE INDEX IF NOT EXISTS idx_machines_master_category   ON public.machines_master (category_id);
CREATE INDEX IF NOT EXISTS idx_machines_master_brand      ON public.machines_master (brand_id);
CREATE INDEX IF NOT EXISTS idx_machines_master_outdoor    ON public.machines_master (outdoor_model);
CREATE INDEX IF NOT EXISTS idx_machines_master_indoor     ON public.machines_master (indoor_model);
CREATE INDEX IF NOT EXISTS idx_machines_master_capacity   ON public.machines_master (capacity_hp);
CREATE INDEX IF NOT EXISTS idx_machines_master_active     ON public.machines_master (is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_machines_master_updated_at ON public.machines_master;
CREATE TRIGGER trg_machines_master_updated_at
  BEFORE UPDATE ON public.machines_master
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.machine_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_brands     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refrigerant_types  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines_master    ENABLE ROW LEVEL SECURITY;

-- machine_categories
DROP POLICY IF EXISTS mc_select ON public.machine_categories;
CREATE POLICY mc_select ON public.machine_categories FOR SELECT TO authenticated
  USING (public.fn_is_active_user());

DROP POLICY IF EXISTS mc_insert ON public.machine_categories;
CREATE POLICY mc_insert ON public.machine_categories FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_screen_permission('machine_categories', 'add'));

DROP POLICY IF EXISTS mc_update ON public.machine_categories;
CREATE POLICY mc_update ON public.machine_categories FOR UPDATE TO authenticated
  USING (public.fn_has_screen_permission('machine_categories', 'edit'))
  WITH CHECK (public.fn_has_screen_permission('machine_categories', 'edit'));

DROP POLICY IF EXISTS mc_delete ON public.machine_categories;
CREATE POLICY mc_delete ON public.machine_categories FOR DELETE TO authenticated
  USING (public.fn_has_screen_permission('machine_categories', 'delete'));

-- machine_brands
DROP POLICY IF EXISTS mb_select ON public.machine_brands;
CREATE POLICY mb_select ON public.machine_brands FOR SELECT TO authenticated
  USING (public.fn_is_active_user());

DROP POLICY IF EXISTS mb_insert ON public.machine_brands;
CREATE POLICY mb_insert ON public.machine_brands FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_screen_permission('machine_brands', 'add'));

DROP POLICY IF EXISTS mb_update ON public.machine_brands;
CREATE POLICY mb_update ON public.machine_brands FOR UPDATE TO authenticated
  USING (public.fn_has_screen_permission('machine_brands', 'edit'))
  WITH CHECK (public.fn_has_screen_permission('machine_brands', 'edit'));

DROP POLICY IF EXISTS mb_delete ON public.machine_brands;
CREATE POLICY mb_delete ON public.machine_brands FOR DELETE TO authenticated
  USING (public.fn_has_screen_permission('machine_brands', 'delete'));

-- refrigerant_types — read by all active users; write by super_admin or with machines_master:edit
DROP POLICY IF EXISTS rt_select ON public.refrigerant_types;
CREATE POLICY rt_select ON public.refrigerant_types FOR SELECT TO authenticated
  USING (public.fn_is_active_user());

DROP POLICY IF EXISTS rt_admin ON public.refrigerant_types;
CREATE POLICY rt_admin ON public.refrigerant_types FOR ALL TO authenticated
  USING (public.fn_is_super_admin() OR public.fn_has_screen_permission('machines_master', 'edit'))
  WITH CHECK (public.fn_is_super_admin() OR public.fn_has_screen_permission('machines_master', 'edit'));

-- machines_master
DROP POLICY IF EXISTS mm_select ON public.machines_master;
CREATE POLICY mm_select ON public.machines_master FOR SELECT TO authenticated
  USING (public.fn_has_screen_permission('machines_master', 'view'));

DROP POLICY IF EXISTS mm_insert ON public.machines_master;
CREATE POLICY mm_insert ON public.machines_master FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_screen_permission('machines_master', 'add'));

DROP POLICY IF EXISTS mm_update ON public.machines_master;
CREATE POLICY mm_update ON public.machines_master FOR UPDATE TO authenticated
  USING (public.fn_has_screen_permission('machines_master', 'edit'))
  WITH CHECK (public.fn_has_screen_permission('machines_master', 'edit'));

DROP POLICY IF EXISTS mm_delete ON public.machines_master;
CREATE POLICY mm_delete ON public.machines_master FOR DELETE TO authenticated
  USING (public.fn_has_screen_permission('machines_master', 'delete'));
