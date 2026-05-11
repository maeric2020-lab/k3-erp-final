-- =============================================================================
-- K3 ERP — Migration 015
-- Customer machines (machine instances installed at a customer site) and the
-- minimal `contracts` table needed by Phase 3 (jobs/invoices reference them).
--
-- The full contract document workflow (wizard, letterhead PDF, clause editor)
-- comes in Phase 4. This migration defines the backing table only, so jobs in
-- Phase 3 can link to a contract via FK.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- customer_machines  — a specific machine installed at a customer site
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_machines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  site_id           uuid REFERENCES public.customer_sites(id) ON DELETE SET NULL,
  -- The catalog entry this machine is an instance of. Optional because
  -- "off-catalog" machines may be allowed (company_settings.allow_off_catalog_machine).
  machine_master_id uuid REFERENCES public.machines_master(id) ON DELETE SET NULL,
  -- Always-stored snapshot fields (denormalized so historical jobs survive
  -- catalog edits)
  category_id       uuid NOT NULL REFERENCES public.machine_categories(id) ON DELETE RESTRICT,
  brand_id          uuid REFERENCES public.machine_brands(id) ON DELETE SET NULL,
  refrigerant_id    uuid REFERENCES public.refrigerant_types(id) ON DELETE SET NULL,
  outdoor_model     text,
  indoor_model      text,
  capacity_hp       numeric(8,2),
  capacity_tr       numeric(8,2),
  btu_h             integer,
  serial_number     text,
  installation_date date,
  notes             text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES public.users_profile(id),
  updated_by        uuid REFERENCES public.users_profile(id)
);

CREATE INDEX IF NOT EXISTS idx_cm_customer  ON public.customer_machines (customer_id);
CREATE INDEX IF NOT EXISTS idx_cm_site      ON public.customer_machines (site_id);
CREATE INDEX IF NOT EXISTS idx_cm_master    ON public.customer_machines (machine_master_id);
CREATE INDEX IF NOT EXISTS idx_cm_category  ON public.customer_machines (category_id);
CREATE INDEX IF NOT EXISTS idx_cm_active    ON public.customer_machines (is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_cm_updated_at ON public.customer_machines;
CREATE TRIGGER trg_cm_updated_at
  BEFORE UPDATE ON public.customer_machines
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- -----------------------------------------------------------------------------
-- contracts  — minimal columns; full wizard in Phase 4
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contracts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_no         text NOT NULL UNIQUE,                   -- format e.g. (123/25) CW
  customer_id         uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  site_id             uuid REFERENCES public.customer_sites(id) ON DELETE SET NULL,
  contract_type       text NOT NULL CHECK (contract_type IN ('CO','CW','CWC','UG')),
  is_4_year           boolean NOT NULL DEFAULT false,
  start_date          date NOT NULL,
  end_date            date NOT NULL,
  status              text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','active','expired','cancelled','terminated'
  )),
  total_amount        numeric(14,3) NOT NULL DEFAULT 0,
  notes               text,
  letterhead_path     text,                                   -- generated PDF in storage
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES public.users_profile(id),
  updated_by          uuid REFERENCES public.users_profile(id),
  CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_contracts_customer ON public.contracts (customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_site     ON public.contracts (site_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status   ON public.contracts (status);
CREATE INDEX IF NOT EXISTS idx_contracts_type     ON public.contracts (contract_type, is_4_year);
CREATE INDEX IF NOT EXISTS idx_contracts_dates    ON public.contracts (start_date, end_date);

DROP TRIGGER IF EXISTS trg_contracts_updated_at ON public.contracts;
CREATE TRIGGER trg_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- -----------------------------------------------------------------------------
-- contract_machines  — which customer_machines are covered by which contract
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_machines (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id              uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  customer_machine_id      uuid NOT NULL REFERENCES public.customer_machines(id) ON DELETE RESTRICT,
  -- Snapshot of the per-unit price at contract creation time, picked from
  -- contract_pricing using the machine's (category, brand, refrigerant, models, hp).
  unit_price_at_signing    numeric(12,3) NOT NULL DEFAULT 0 CHECK (unit_price_at_signing >= 0),
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, customer_machine_id)
);

CREATE INDEX IF NOT EXISTS idx_contract_machines_contract ON public.contract_machines (contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_machines_machine  ON public.contract_machines (customer_machine_id);

DROP TRIGGER IF EXISTS trg_contract_machines_updated_at ON public.contract_machines;
CREATE TRIGGER trg_contract_machines_updated_at
  BEFORE UPDATE ON public.contract_machines
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.customer_machines  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_machines  ENABLE ROW LEVEL SECURITY;

-- customer_machines: gated by customers screen perms (machines belong to customers)
DROP POLICY IF EXISTS cm_select ON public.customer_machines;
CREATE POLICY cm_select ON public.customer_machines FOR SELECT TO authenticated
  USING (public.fn_has_screen_permission('customer_machines', 'view') OR public.fn_has_screen_permission('customers', 'view'));

DROP POLICY IF EXISTS cm_insert ON public.customer_machines;
CREATE POLICY cm_insert ON public.customer_machines FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_screen_permission('customer_machines', 'add') OR public.fn_has_screen_permission('customers', 'edit'));

DROP POLICY IF EXISTS cm_update ON public.customer_machines;
CREATE POLICY cm_update ON public.customer_machines FOR UPDATE TO authenticated
  USING (public.fn_has_screen_permission('customer_machines', 'edit') OR public.fn_has_screen_permission('customers', 'edit'))
  WITH CHECK (public.fn_has_screen_permission('customer_machines', 'edit') OR public.fn_has_screen_permission('customers', 'edit'));

DROP POLICY IF EXISTS cm_delete ON public.customer_machines;
CREATE POLICY cm_delete ON public.customer_machines FOR DELETE TO authenticated
  USING (public.fn_has_screen_permission('customer_machines', 'delete') OR public.fn_has_screen_permission('customers', 'delete'));

-- contracts
DROP POLICY IF EXISTS ct_select ON public.contracts;
CREATE POLICY ct_select ON public.contracts FOR SELECT TO authenticated
  USING (public.fn_has_screen_permission('contracts', 'view'));

DROP POLICY IF EXISTS ct_insert ON public.contracts;
CREATE POLICY ct_insert ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_screen_permission('contracts', 'add'));

DROP POLICY IF EXISTS ct_update ON public.contracts;
CREATE POLICY ct_update ON public.contracts FOR UPDATE TO authenticated
  USING (public.fn_has_screen_permission('contracts', 'edit'))
  WITH CHECK (public.fn_has_screen_permission('contracts', 'edit'));

DROP POLICY IF EXISTS ct_delete ON public.contracts;
CREATE POLICY ct_delete ON public.contracts FOR DELETE TO authenticated
  USING (public.fn_has_screen_permission('contracts', 'delete'));

-- contract_machines: piggy-backs on contracts perms
DROP POLICY IF EXISTS ctm_all ON public.contract_machines;
CREATE POLICY ctm_all ON public.contract_machines FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_machines.contract_id
            AND public.fn_has_screen_permission('contracts', 'view'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_machines.contract_id
            AND public.fn_has_screen_permission('contracts', 'edit'))
  );
