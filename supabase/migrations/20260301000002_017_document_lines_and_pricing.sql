-- =============================================================================
-- K3 ERP — Migration 017
-- Polymorphic document_lines (jobs / quotations / invoices / contracts) and
-- the compute_line_pricing() function that is the SOLE source of pricing.
--
-- Architectural rule: NO code path computes prices anywhere except by calling
-- this function (or by reading the persisted line.unit_price afterwards).
-- The function reads from service_pricing, contract_pricing, gas_types_master,
-- and the parts catalog — never from anywhere else.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- document_lines
-- A single line on any pricing-bearing document. Exactly one of the *_id
-- pointers is filled in (job_id, quotation_id, invoice_id, contract_id).
-- An invoice line may also reference a job_id when the invoice was generated
-- from a job — that's a valid "both filled" combination.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_lines (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Polymorphic owner. Exactly one is required EXCEPT that invoice + job can
  -- coexist (invoices generated from jobs).
  job_id                 uuid REFERENCES public.jobs(id)         ON DELETE CASCADE,
  quotation_id           uuid,                                  -- FK in 018
  invoice_id             uuid,                                  -- FK in 018
  contract_id            uuid REFERENCES public.contracts(id)    ON DELETE CASCADE,
  -- What is being charged
  line_type              text NOT NULL CHECK (line_type IN ('service','part','gas','contract_unit','custom')),
  service_id             uuid REFERENCES public.services_master(id)      ON DELETE SET NULL,
  part_id                uuid REFERENCES public.spare_parts_master(id)   ON DELETE SET NULL,
  gas_id                 uuid REFERENCES public.gas_types_master(id)     ON DELETE SET NULL,
  customer_machine_id    uuid REFERENCES public.customer_machines(id)    ON DELETE SET NULL,
  machine_master_id      uuid REFERENCES public.machines_master(id)      ON DELETE SET NULL,
  -- Display (snapshotted at line creation so historical docs survive catalog edits)
  description_ar         text NOT NULL,
  description_en         text,
  unit                   text NOT NULL,
  quantity               numeric(14,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  -- Pricing — set EXCLUSIVELY by compute_line_pricing()
  request_type           text CHECK (request_type IN ('CASH','CO','CW','CWC','UG')),
  unit_price             numeric(12,3) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  cost_price             numeric(12,3) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  is_covered             boolean NOT NULL DEFAULT false,
  line_total             numeric(14,3) GENERATED ALWAYS AS (round(quantity * unit_price, 3)) STORED,
  -- Audit/source
  pricing_source         text,                                  -- e.g. 'service_pricing:abc-123', 'contract_pricing:xyz', 'gas:R410A'
  pricing_computed_at    timestamptz,
  notes                  text,
  display_order          integer NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES public.users_profile(id),
  updated_by             uuid REFERENCES public.users_profile(id),

  CHECK (
    -- At least one parent pointer
    job_id IS NOT NULL OR quotation_id IS NOT NULL OR invoice_id IS NOT NULL OR contract_id IS NOT NULL
  ),
  CHECK (
    -- contract_id and (job_id|quotation_id|invoice_id) cannot mix
    contract_id IS NULL OR (job_id IS NULL AND quotation_id IS NULL AND invoice_id IS NULL)
  ),
  CHECK (
    -- quotation lines stand alone
    quotation_id IS NULL OR (job_id IS NULL AND invoice_id IS NULL AND contract_id IS NULL)
  ),
  CHECK (
    -- line_type implies which "what" pointer is set
    (line_type = 'service'       AND service_id IS NOT NULL) OR
    (line_type = 'part'          AND part_id    IS NOT NULL) OR
    (line_type = 'gas'           AND gas_id     IS NOT NULL) OR
    (line_type = 'contract_unit' AND customer_machine_id IS NOT NULL) OR
    (line_type = 'custom')
  )
);

CREATE INDEX IF NOT EXISTS idx_dl_job        ON public.document_lines (job_id)        WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dl_quotation  ON public.document_lines (quotation_id)  WHERE quotation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dl_invoice    ON public.document_lines (invoice_id)    WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dl_contract   ON public.document_lines (contract_id)   WHERE contract_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dl_service    ON public.document_lines (service_id)    WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dl_part       ON public.document_lines (part_id)       WHERE part_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_dl_updated_at ON public.document_lines;
CREATE TRIGGER trg_dl_updated_at
  BEFORE UPDATE ON public.document_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- -----------------------------------------------------------------------------
-- compute_line_pricing()
-- The single source of pricing truth. Given a line specification (line_type +
-- pointers + machine context + request_type), returns the computed unit_price,
-- cost_price, is_covered, and pricing_source string.
--
-- This function is callable from the app (via a thin repository wrapper), from
-- the line picker (to preview the price before insert), and from triggers if
-- needed. NO other code may compute prices.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.compute_line_pricing(text, uuid, uuid, uuid, uuid, uuid, text, numeric);

CREATE OR REPLACE FUNCTION public.compute_line_pricing(
  p_line_type     text,
  p_service_id    uuid,
  p_part_id       uuid,
  p_gas_id        uuid,
  p_customer_machine_id uuid,
  p_machine_master_id   uuid,
  p_request_type  text,                  -- CASH | CO | CW | CWC | UG | NULL (for contract)
  p_quantity      numeric DEFAULT 1
)
RETURNS TABLE (
  unit_price      numeric,
  cost_price      numeric,
  is_covered      boolean,
  pricing_source  text,
  description_ar  text,
  description_en  text,
  unit            text
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
DECLARE
  v_unit_price     numeric := 0;
  v_cost_price     numeric := 0;
  v_is_covered     boolean := false;
  v_pricing_source text := '';
  v_desc_ar        text;
  v_desc_en        text;
  v_unit           text;
  v_machine_cat_id uuid;
  v_machine_brand_id uuid;
  v_machine_refr_id uuid;
  v_machine_outdoor text;
  v_machine_indoor  text;
  v_machine_hp     numeric;
  v_pricing_row    public.service_pricing%ROWTYPE;
  v_contract_row   public.contract_pricing%ROWTYPE;
BEGIN
  IF p_line_type NOT IN ('service','part','gas','contract_unit','custom') THEN
    RAISE EXCEPTION 'Unknown line_type: %', p_line_type;
  END IF;

  -- Resolve machine context (category, brand, refrigerant, models, hp)
  IF p_customer_machine_id IS NOT NULL THEN
    SELECT category_id, brand_id, refrigerant_id, outdoor_model, indoor_model, capacity_hp
      INTO v_machine_cat_id, v_machine_brand_id, v_machine_refr_id, v_machine_outdoor, v_machine_indoor, v_machine_hp
      FROM public.customer_machines WHERE id = p_customer_machine_id;
  ELSIF p_machine_master_id IS NOT NULL THEN
    SELECT category_id, brand_id, refrigerant_id, outdoor_model, indoor_model, capacity_hp
      INTO v_machine_cat_id, v_machine_brand_id, v_machine_refr_id, v_machine_outdoor, v_machine_indoor, v_machine_hp
      FROM public.machines_master WHERE id = p_machine_master_id;
  END IF;

  -- ----------------------------------------------------------------------- --
  -- SERVICE LINE                                                            --
  -- ----------------------------------------------------------------------- --
  IF p_line_type = 'service' THEN
    IF p_service_id IS NULL THEN
      RAISE EXCEPTION 'service_id required for service line';
    END IF;
    IF p_request_type IS NULL THEN
      RAISE EXCEPTION 'request_type required for service line';
    END IF;

    -- Look for category-specific pricing first, then universal (NULL)
    SELECT * INTO v_pricing_row FROM public.service_pricing
     WHERE service_id = p_service_id
       AND machine_category_id = v_machine_cat_id
       AND is_active = true
     LIMIT 1;
    IF NOT FOUND THEN
      SELECT * INTO v_pricing_row FROM public.service_pricing
       WHERE service_id = p_service_id
         AND machine_category_id IS NULL
         AND is_active = true
       LIMIT 1;
    END IF;

    SELECT name_ar, name_en, unit
      INTO v_desc_ar, v_desc_en, v_unit
      FROM public.services_master WHERE id = p_service_id;

    IF NOT FOUND OR v_pricing_row.id IS NULL THEN
      -- No pricing row → cost only, not covered, price 0 (will fail downstream
      -- validation if the request is a billable type and price = 0)
      v_unit_price := 0;
      v_cost_price := 0;
      v_is_covered := false;
      v_pricing_source := 'service:no_pricing';
    ELSE
      v_cost_price := v_pricing_row.cost_price;
      CASE p_request_type
        WHEN 'CASH' THEN v_unit_price := v_pricing_row.cash_price; v_is_covered := v_pricing_row.cash_covered;
        WHEN 'CO'   THEN v_unit_price := v_pricing_row.co_price;   v_is_covered := v_pricing_row.co_covered;
        WHEN 'CW'   THEN v_unit_price := v_pricing_row.cw_price;   v_is_covered := v_pricing_row.cw_covered;
        WHEN 'CWC'  THEN v_unit_price := v_pricing_row.cwc_price;  v_is_covered := v_pricing_row.cwc_covered;
        WHEN 'UG'   THEN v_unit_price := v_pricing_row.ug_price;   v_is_covered := v_pricing_row.ug_covered;
      END CASE;
      v_pricing_source := 'service_pricing:' || v_pricing_row.id::text;
    END IF;

    RETURN QUERY SELECT v_unit_price, v_cost_price, v_is_covered, v_pricing_source, v_desc_ar, v_desc_en, v_unit;
    RETURN;
  END IF;

  -- ----------------------------------------------------------------------- --
  -- PART LINE                                                               --
  -- ----------------------------------------------------------------------- --
  IF p_line_type = 'part' THEN
    IF p_part_id IS NULL THEN
      RAISE EXCEPTION 'part_id required for part line';
    END IF;
    SELECT name_ar, name_en, unit, cost_price, selling_price
      INTO v_desc_ar, v_desc_en, v_unit, v_cost_price, v_unit_price
      FROM public.spare_parts_master WHERE id = p_part_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Part not found: %', p_part_id;
    END IF;
    -- Parts are not covered by contracts (parts are CWC/CWCG specific — handled
    -- via service_pricing rows that include the part). When a part is added
    -- directly to a CW contract job, it's billable.
    v_is_covered := false;
    v_pricing_source := 'spare_parts_master:' || p_part_id::text;
    RETURN QUERY SELECT v_unit_price, v_cost_price, v_is_covered, v_pricing_source, v_desc_ar, v_desc_en, v_unit;
    RETURN;
  END IF;

  -- ----------------------------------------------------------------------- --
  -- GAS LINE                                                                --
  -- ----------------------------------------------------------------------- --
  IF p_line_type = 'gas' THEN
    IF p_gas_id IS NULL THEN
      RAISE EXCEPTION 'gas_id required for gas line';
    END IF;
    SELECT g.cost_price_per_kg, g.selling_price_per_kg, ('Gas - ' || r.name), ('Gas - ' || r.name)
      INTO v_cost_price, v_unit_price, v_desc_ar, v_desc_en
      FROM public.gas_types_master g
      JOIN public.refrigerant_types r ON r.id = g.refrigerant_id
     WHERE g.id = p_gas_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Gas not found: %', p_gas_id;
    END IF;
    v_unit := 'kg';
    v_is_covered := false;
    v_pricing_source := 'gas_types_master:' || p_gas_id::text;
    RETURN QUERY SELECT v_unit_price, v_cost_price, v_is_covered, v_pricing_source, v_desc_ar, v_desc_en, v_unit;
    RETURN;
  END IF;

  -- ----------------------------------------------------------------------- --
  -- CONTRACT_UNIT LINE  (used when building a contract — one line per machine)
  -- ----------------------------------------------------------------------- --
  IF p_line_type = 'contract_unit' THEN
    IF v_machine_cat_id IS NULL THEN
      RAISE EXCEPTION 'machine context required for contract_unit line';
    END IF;
    IF p_request_type IS NULL OR p_request_type = 'CASH' OR p_request_type = 'UG' THEN
      RAISE EXCEPTION 'request_type CO/CW/CWC required for contract_unit (got %)', p_request_type;
    END IF;

    -- Find best-matching contract_pricing row (specific → fallback)
    SELECT * INTO v_contract_row FROM public.contract_pricing
     WHERE machine_category_id = v_machine_cat_id
       AND brand_id = v_machine_brand_id
       AND refrigerant_id IS NOT DISTINCT FROM v_machine_refr_id
       AND outdoor_model = v_machine_outdoor
       AND indoor_model  = v_machine_indoor
       AND capacity_hp IS NOT DISTINCT FROM v_machine_hp
       AND is_active = true
     LIMIT 1;
    IF NOT FOUND THEN
      -- Loosen on outdoor/indoor model
      SELECT * INTO v_contract_row FROM public.contract_pricing
       WHERE machine_category_id = v_machine_cat_id
         AND brand_id IS NOT DISTINCT FROM v_machine_brand_id
         AND refrigerant_id IS NOT DISTINCT FROM v_machine_refr_id
         AND capacity_hp IS NOT DISTINCT FROM v_machine_hp
         AND is_active = true
       ORDER BY (outdoor_model = v_machine_outdoor)::int DESC,
                (indoor_model  = v_machine_indoor)::int DESC
       LIMIT 1;
    END IF;
    IF NOT FOUND THEN
      v_unit_price := 0;
      v_pricing_source := 'contract_pricing:no_match';
    ELSE
      -- request_type encodes both contract type and 4-year flag externally;
      -- here we map directly to the unit price column. Callers pass:
      --   CO, CW, CWC, COG, CWG, CWCG (the 'G' suffix for 4-year/Golden)
      CASE p_request_type
        WHEN 'CO'   THEN v_unit_price := v_contract_row.co_unit_price;
        WHEN 'CW'   THEN v_unit_price := v_contract_row.cw_unit_price;
        WHEN 'CWC'  THEN v_unit_price := v_contract_row.cwc_unit_price;
        WHEN 'COG'  THEN v_unit_price := v_contract_row.cog_unit_price;
        WHEN 'CWG'  THEN v_unit_price := v_contract_row.cwg_unit_price;
        WHEN 'CWCG' THEN v_unit_price := v_contract_row.cwcg_unit_price;
        ELSE
          RAISE EXCEPTION 'invalid contract request_type %', p_request_type;
      END CASE;
      v_pricing_source := 'contract_pricing:' || v_contract_row.id::text;
    END IF;

    -- Description from the customer_machine's catalog snapshot
    SELECT
      'Annual maintenance — ' || coalesce(mc.name_ar, '') || ' ' || coalesce(b.name, '') || ' ' || coalesce(cm.outdoor_model, ''),
      'Annual maintenance — ' || coalesce(mc.name_en, '') || ' ' || coalesce(b.name, '') || ' ' || coalesce(cm.outdoor_model, '')
      INTO v_desc_ar, v_desc_en
      FROM public.customer_machines cm
      JOIN public.machine_categories mc ON mc.id = cm.category_id
      LEFT JOIN public.machine_brands b ON b.id = cm.brand_id
     WHERE cm.id = p_customer_machine_id;
    v_unit := 'unit';
    v_cost_price := 0;
    v_is_covered := false;
    RETURN QUERY SELECT v_unit_price, v_cost_price, v_is_covered, v_pricing_source, v_desc_ar, v_desc_en, v_unit;
    RETURN;
  END IF;

  -- ----------------------------------------------------------------------- --
  -- CUSTOM LINE — admin-only manual price entry, requires explicit override   --
  -- ----------------------------------------------------------------------- --
  IF p_line_type = 'custom' THEN
    -- Custom lines have NO computed price here. The caller MUST set the price
    -- via a separate admin-override path. This function returns zeros so that
    -- forgetting to override leaves a 0 line (visible in audits).
    v_unit_price := 0;
    v_cost_price := 0;
    v_is_covered := false;
    v_pricing_source := 'custom:manual';
    v_desc_ar := 'Custom';
    v_desc_en := 'Custom';
    v_unit := 'unit';
    RETURN QUERY SELECT v_unit_price, v_cost_price, v_is_covered, v_pricing_source, v_desc_ar, v_desc_en, v_unit;
    RETURN;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_line_pricing(text, uuid, uuid, uuid, uuid, uuid, text, numeric) TO authenticated;

-- -----------------------------------------------------------------------------
-- RLS for document_lines: piggy-backs on parent permission
-- -----------------------------------------------------------------------------
ALTER TABLE public.document_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dl_select ON public.document_lines;
CREATE POLICY dl_select ON public.document_lines FOR SELECT TO authenticated
  USING (
    (job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = document_lines.job_id
        AND (j.technician_id = auth.uid() OR public.fn_has_screen_permission('jobs', 'view'))))
    OR (contract_id IS NOT NULL AND public.fn_has_screen_permission('contracts', 'view'))
    OR public.fn_is_super_admin()
  );

DROP POLICY IF EXISTS dl_insert ON public.document_lines;
CREATE POLICY dl_insert ON public.document_lines FOR INSERT TO authenticated
  WITH CHECK (
    (job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = document_lines.job_id
        AND (j.technician_id = auth.uid() OR public.fn_has_screen_permission('jobs', 'edit'))))
    OR (contract_id IS NOT NULL AND public.fn_has_screen_permission('contracts', 'edit'))
    OR public.fn_is_super_admin()
  );

DROP POLICY IF EXISTS dl_update ON public.document_lines;
CREATE POLICY dl_update ON public.document_lines FOR UPDATE TO authenticated
  USING (
    (job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = document_lines.job_id
        AND (j.technician_id = auth.uid() OR public.fn_has_screen_permission('jobs', 'edit'))))
    OR (contract_id IS NOT NULL AND public.fn_has_screen_permission('contracts', 'edit'))
    OR public.fn_is_super_admin()
  )
  WITH CHECK (
    (job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = document_lines.job_id
        AND (j.technician_id = auth.uid() OR public.fn_has_screen_permission('jobs', 'edit'))))
    OR (contract_id IS NOT NULL AND public.fn_has_screen_permission('contracts', 'edit'))
    OR public.fn_is_super_admin()
  );

DROP POLICY IF EXISTS dl_delete ON public.document_lines;
CREATE POLICY dl_delete ON public.document_lines FOR DELETE TO authenticated
  USING (
    (job_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = document_lines.job_id
        AND (j.technician_id = auth.uid() OR public.fn_has_screen_permission('jobs', 'edit'))))
    OR public.fn_is_super_admin()
  );

-- -----------------------------------------------------------------------------
-- Helper: recalculate jobs.total_amount whenever its lines change
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_jobs_recalc_total()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_job_id uuid;
  v_total  numeric;
BEGIN
  v_job_id := COALESCE(NEW.job_id, OLD.job_id);
  IF v_job_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT COALESCE(SUM(line_total), 0) INTO v_total
    FROM public.document_lines WHERE job_id = v_job_id;
  UPDATE public.jobs SET total_amount = v_total WHERE id = v_job_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_dl_recalc_job_total ON public.document_lines;
CREATE TRIGGER trg_dl_recalc_job_total
  AFTER INSERT OR UPDATE OR DELETE ON public.document_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_jobs_recalc_total();

-- Seed the JOB and REQ numbering sequences
INSERT INTO public.numbering_sequences (id, prefix, year_resets, current_year, current_value, pad_width, separator, description)
VALUES
  ('REQ', 'REQ', false, EXTRACT(YEAR FROM now())::int, 0, 5, '-', 'Maintenance request numbers'),
  ('JOB', 'JOB', false, EXTRACT(YEAR FROM now())::int, 0, 5, '-', 'Job numbers')
ON CONFLICT (id) DO NOTHING;
