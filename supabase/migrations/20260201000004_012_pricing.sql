-- =============================================================================
-- K3 ERP — Migration 012
-- Service pricing master + Contract pricing master
--
-- These two tables ARE the pricing source-of-truth for the entire system.
-- The compute_line_pricing() function (Phase 3) reads exclusively from here.
-- No code path is allowed to compute or hardcode prices anywhere else.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- service_pricing
-- Mirrors the structure of: قائمة_انواع_خدمات_الصيانة_واسعارها.xlsx
--
-- A row exists per (service, machine_category) combination. Some services are
-- universal across categories — those rows have machine_category_id = NULL.
--
-- "Include" in the source Excel is encoded as the *_covered = TRUE flag with
-- the corresponding *_price set to 0. The import pipeline performs this
-- translation; downstream code never deals with the string "Include".
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_pricing (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id          uuid NOT NULL REFERENCES public.services_master(id) ON DELETE CASCADE,
  machine_category_id uuid REFERENCES public.machine_categories(id) ON DELETE CASCADE,
  -- Six price points (one per request type)
  cost_price          numeric(12,3) NOT NULL DEFAULT 0  CHECK (cost_price    >= 0),
  cash_price          numeric(12,3) NOT NULL DEFAULT 0  CHECK (cash_price    >= 0),
  co_price            numeric(12,3) NOT NULL DEFAULT 0  CHECK (co_price      >= 0),
  cw_price            numeric(12,3) NOT NULL DEFAULT 0  CHECK (cw_price      >= 0),
  cwc_price           numeric(12,3) NOT NULL DEFAULT 0  CHECK (cwc_price     >= 0),
  ug_price            numeric(12,3) NOT NULL DEFAULT 0  CHECK (ug_price      >= 0),
  -- Coverage flags
  cash_covered        boolean NOT NULL DEFAULT false,
  co_covered          boolean NOT NULL DEFAULT false,
  cw_covered          boolean NOT NULL DEFAULT false,
  cwc_covered         boolean NOT NULL DEFAULT false,
  ug_covered          boolean NOT NULL DEFAULT true,    -- UG is always covered (decision #1)
  -- Bookkeeping
  notes               text,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES public.users_profile(id),
  updated_by          uuid REFERENCES public.users_profile(id),
  -- A service can have at most one pricing row per machine category (NULL = universal)
  UNIQUE NULLS NOT DISTINCT (service_id, machine_category_id)
);

CREATE INDEX IF NOT EXISTS idx_service_pricing_service   ON public.service_pricing (service_id);
CREATE INDEX IF NOT EXISTS idx_service_pricing_category  ON public.service_pricing (machine_category_id);
CREATE INDEX IF NOT EXISTS idx_service_pricing_active    ON public.service_pricing (is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_service_pricing_updated_at ON public.service_pricing;
CREATE TRIGGER trg_service_pricing_updated_at
  BEFORE UPDATE ON public.service_pricing
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Enforce the "covered = TRUE implies price = 0" invariant. Either the import
-- normalises ("Include" → covered=true, price=0) or admins set both. The
-- check below prevents a non-zero price coexisting with covered=true, since
-- compute_line_pricing would silently zero it and confuse audits.
ALTER TABLE public.service_pricing
  DROP CONSTRAINT IF EXISTS service_pricing_coverage_consistency;
ALTER TABLE public.service_pricing
  ADD CONSTRAINT service_pricing_coverage_consistency CHECK (
    (NOT cash_covered OR cash_price = 0)
    AND (NOT co_covered  OR co_price  = 0)
    AND (NOT cw_covered  OR cw_price  = 0)
    AND (NOT cwc_covered OR cwc_price = 0)
    AND (NOT ug_covered  OR ug_price  = 0)
  );

-- -----------------------------------------------------------------------------
-- contract_pricing
-- Mirrors the structure of: قائمة_تسعيير_العقود.xlsx
--
-- A row exists per (machine_category, brand, refrigerant, outdoor_model,
-- indoor_model, capacity_hp). Six unit-price columns cover the four
-- contract types × two durations (1-year / 4-year "Golden").
--
-- UG is excluded from this table because UG contracts are fully covered
-- by manufacturer warranty (decision #1) — no per-unit contract price applies.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_pricing (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_category_id uuid NOT NULL REFERENCES public.machine_categories(id) ON DELETE RESTRICT,
  brand_id            uuid REFERENCES public.machine_brands(id) ON DELETE SET NULL,
  refrigerant_id      uuid REFERENCES public.refrigerant_types(id) ON DELETE SET NULL,
  outdoor_model       text,
  indoor_model        text,
  capacity_hp         numeric(8,2),
  capacity_tr         numeric(8,2),
  btu_h               integer,
  cfm                 integer,
  kw                  numeric(8,2),
  -- Six unit prices: one per (contract_type × is_4_year)
  co_unit_price       numeric(12,3) NOT NULL DEFAULT 0 CHECK (co_unit_price   >= 0),
  cw_unit_price       numeric(12,3) NOT NULL DEFAULT 0 CHECK (cw_unit_price   >= 0),
  cwc_unit_price      numeric(12,3) NOT NULL DEFAULT 0 CHECK (cwc_unit_price  >= 0),
  cog_unit_price      numeric(12,3) NOT NULL DEFAULT 0 CHECK (cog_unit_price  >= 0),
  cwg_unit_price      numeric(12,3) NOT NULL DEFAULT 0 CHECK (cwg_unit_price  >= 0),
  cwcg_unit_price     numeric(12,3) NOT NULL DEFAULT 0 CHECK (cwcg_unit_price >= 0),
  notes               text,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES public.users_profile(id),
  updated_by          uuid REFERENCES public.users_profile(id),
  UNIQUE NULLS NOT DISTINCT (
    machine_category_id, brand_id, refrigerant_id, outdoor_model, indoor_model, capacity_hp
  )
);

CREATE INDEX IF NOT EXISTS idx_contract_pricing_cat       ON public.contract_pricing (machine_category_id);
CREATE INDEX IF NOT EXISTS idx_contract_pricing_brand     ON public.contract_pricing (brand_id);
CREATE INDEX IF NOT EXISTS idx_contract_pricing_capacity  ON public.contract_pricing (capacity_hp);
CREATE INDEX IF NOT EXISTS idx_contract_pricing_outdoor   ON public.contract_pricing (outdoor_model);
CREATE INDEX IF NOT EXISTS idx_contract_pricing_active    ON public.contract_pricing (is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_contract_pricing_updated_at ON public.contract_pricing;
CREATE TRIGGER trg_contract_pricing_updated_at
  BEFORE UPDATE ON public.contract_pricing
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.service_pricing  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS svp_select ON public.service_pricing;
CREATE POLICY svp_select ON public.service_pricing FOR SELECT TO authenticated
  USING (public.fn_has_screen_permission('service_pricing', 'view'));

DROP POLICY IF EXISTS svp_insert ON public.service_pricing;
CREATE POLICY svp_insert ON public.service_pricing FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_screen_permission('service_pricing', 'add'));

DROP POLICY IF EXISTS svp_update ON public.service_pricing;
CREATE POLICY svp_update ON public.service_pricing FOR UPDATE TO authenticated
  USING (public.fn_has_screen_permission('service_pricing', 'edit'))
  WITH CHECK (public.fn_has_screen_permission('service_pricing', 'edit'));

DROP POLICY IF EXISTS svp_delete ON public.service_pricing;
CREATE POLICY svp_delete ON public.service_pricing FOR DELETE TO authenticated
  USING (public.fn_has_screen_permission('service_pricing', 'delete'));

DROP POLICY IF EXISTS cp_select ON public.contract_pricing;
CREATE POLICY cp_select ON public.contract_pricing FOR SELECT TO authenticated
  USING (public.fn_has_screen_permission('contract_pricing', 'view'));

DROP POLICY IF EXISTS cp_insert ON public.contract_pricing;
CREATE POLICY cp_insert ON public.contract_pricing FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_screen_permission('contract_pricing', 'add'));

DROP POLICY IF EXISTS cp_update ON public.contract_pricing;
CREATE POLICY cp_update ON public.contract_pricing FOR UPDATE TO authenticated
  USING (public.fn_has_screen_permission('contract_pricing', 'edit'))
  WITH CHECK (public.fn_has_screen_permission('contract_pricing', 'edit'));

DROP POLICY IF EXISTS cp_delete ON public.contract_pricing;
CREATE POLICY cp_delete ON public.contract_pricing FOR DELETE TO authenticated
  USING (public.fn_has_screen_permission('contract_pricing', 'delete'));
