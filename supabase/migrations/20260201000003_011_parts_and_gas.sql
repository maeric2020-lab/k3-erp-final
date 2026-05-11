-- =============================================================================
-- K3 ERP — Migration 011
-- Spare parts master + gas types master
-- =============================================================================

-- -----------------------------------------------------------------------------
-- spare_parts_master
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spare_parts_master (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_code         text NOT NULL UNIQUE,                       -- auto: PRT-00001
  category_id       uuid NOT NULL REFERENCES public.spare_part_categories(id) ON DELETE RESTRICT,
  part_type         text,                                       -- compressor, motor, capacitor, ...
  name_ar           text NOT NULL,
  name_en           text NOT NULL,
  brand_id          uuid REFERENCES public.machine_brands(id) ON DELETE SET NULL,
  model             text,
  manufacturer      text,
  country_origin    text,
  compatible_categories  uuid[] NOT NULL DEFAULT '{}',           -- array of machine_categories.id
  unit              text NOT NULL DEFAULT 'piece'
                    CHECK (unit IN ('piece','meter','kg','set','liter')),
  cost_price        numeric(12,3) NOT NULL DEFAULT 0,
  selling_price     numeric(12,3) NOT NULL DEFAULT 0,
  notes             text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES public.users_profile(id),
  updated_by        uuid REFERENCES public.users_profile(id),
  CHECK (cost_price >= 0),
  CHECK (selling_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_parts_category   ON public.spare_parts_master (category_id);
CREATE INDEX IF NOT EXISTS idx_parts_brand      ON public.spare_parts_master (brand_id);
CREATE INDEX IF NOT EXISTS idx_parts_active     ON public.spare_parts_master (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_parts_name_ar    ON public.spare_parts_master USING gin (name_ar gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_parts_name_en    ON public.spare_parts_master USING gin (name_en gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_parts_compat     ON public.spare_parts_master USING gin (compatible_categories);

DROP TRIGGER IF EXISTS trg_parts_updated_at ON public.spare_parts_master;
CREATE TRIGGER trg_parts_updated_at
  BEFORE UPDATE ON public.spare_parts_master
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE OR REPLACE FUNCTION public.fn_parts_assign_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.part_code IS NULL OR NEW.part_code = '' THEN
    NEW.part_code := public.fn_next_doc_no('PRT');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_parts_assign_code ON public.spare_parts_master;
CREATE TRIGGER trg_parts_assign_code
  BEFORE INSERT ON public.spare_parts_master
  FOR EACH ROW EXECUTE FUNCTION public.fn_parts_assign_code();

-- -----------------------------------------------------------------------------
-- gas_types_master  (R22, R410A, R407C with KG pricing)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gas_types_master (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refrigerant_id        uuid NOT NULL UNIQUE REFERENCES public.refrigerant_types(id) ON DELETE CASCADE,
  unit                  text NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg')),
  cost_price_per_kg     numeric(12,3) NOT NULL DEFAULT 0 CHECK (cost_price_per_kg >= 0),
  selling_price_per_kg  numeric(12,3) NOT NULL DEFAULT 0 CHECK (selling_price_per_kg >= 0),
  notes                 text,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES public.users_profile(id),
  updated_by            uuid REFERENCES public.users_profile(id)
);

DROP TRIGGER IF EXISTS trg_gas_updated_at ON public.gas_types_master;
CREATE TRIGGER trg_gas_updated_at
  BEFORE UPDATE ON public.gas_types_master
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.spare_parts_master  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gas_types_master    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sp_select ON public.spare_parts_master;
CREATE POLICY sp_select ON public.spare_parts_master FOR SELECT TO authenticated
  USING (public.fn_has_screen_permission('spare_parts_master', 'view'));

DROP POLICY IF EXISTS sp_insert ON public.spare_parts_master;
CREATE POLICY sp_insert ON public.spare_parts_master FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_screen_permission('spare_parts_master', 'add'));

DROP POLICY IF EXISTS sp_update ON public.spare_parts_master;
CREATE POLICY sp_update ON public.spare_parts_master FOR UPDATE TO authenticated
  USING (public.fn_has_screen_permission('spare_parts_master', 'edit'))
  WITH CHECK (public.fn_has_screen_permission('spare_parts_master', 'edit'));

DROP POLICY IF EXISTS sp_delete ON public.spare_parts_master;
CREATE POLICY sp_delete ON public.spare_parts_master FOR DELETE TO authenticated
  USING (public.fn_has_screen_permission('spare_parts_master', 'delete'));

DROP POLICY IF EXISTS gt_select ON public.gas_types_master;
CREATE POLICY gt_select ON public.gas_types_master FOR SELECT TO authenticated
  USING (public.fn_has_screen_permission('gas_types_master', 'view'));

DROP POLICY IF EXISTS gt_write ON public.gas_types_master;
CREATE POLICY gt_write ON public.gas_types_master FOR ALL TO authenticated
  USING (public.fn_is_super_admin() OR public.fn_has_screen_permission('gas_types_master', 'edit'))
  WITH CHECK (public.fn_is_super_admin() OR public.fn_has_screen_permission('gas_types_master', 'edit'));
