-- =============================================================================
-- K3 ERP — Migration 021
-- Compressor installation bracket pricing (decision #9):
--   ≤ 6 HP        =  70 KD
--   6.5 – 10 HP   =  80 KD
--   10.5 – 15 HP  = 100 KD
--   15.5 – 20 HP  = 125 KD
--   +10% if K3 supplies the compressor
--
-- Stored as configurable rows so HR can adjust without code changes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.compressor_install_brackets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hp_min          numeric(8,2) NOT NULL,        -- inclusive
  hp_max          numeric(8,2) NOT NULL,        -- inclusive
  base_price      numeric(12,3) NOT NULL CHECK (base_price >= 0),
  k3_supplied_surcharge_pct numeric(5,2) NOT NULL DEFAULT 10 CHECK (k3_supplied_surcharge_pct >= 0),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (hp_max >= hp_min)
);

CREATE INDEX IF NOT EXISTS idx_cib_range ON public.compressor_install_brackets (hp_min, hp_max);

DROP TRIGGER IF EXISTS trg_cib_updated_at ON public.compressor_install_brackets;
CREATE TRIGGER trg_cib_updated_at
  BEFORE UPDATE ON public.compressor_install_brackets
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.compressor_install_brackets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cib_select ON public.compressor_install_brackets;
CREATE POLICY cib_select ON public.compressor_install_brackets FOR SELECT TO authenticated
  USING (public.fn_has_screen_permission('compressor_brackets', 'view') OR public.fn_has_screen_permission('service_pricing', 'view'));

DROP POLICY IF EXISTS cib_insert ON public.compressor_install_brackets;
CREATE POLICY cib_insert ON public.compressor_install_brackets FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_screen_permission('compressor_brackets', 'add') OR public.fn_is_super_admin());

DROP POLICY IF EXISTS cib_update ON public.compressor_install_brackets;
CREATE POLICY cib_update ON public.compressor_install_brackets FOR UPDATE TO authenticated
  USING (public.fn_has_screen_permission('compressor_brackets', 'edit') OR public.fn_is_super_admin())
  WITH CHECK (public.fn_has_screen_permission('compressor_brackets', 'edit') OR public.fn_is_super_admin());

DROP POLICY IF EXISTS cib_delete ON public.compressor_install_brackets;
CREATE POLICY cib_delete ON public.compressor_install_brackets FOR DELETE TO authenticated
  USING (public.fn_has_screen_permission('compressor_brackets', 'delete') OR public.fn_is_super_admin());

-- Seed the four brackets per decision #9
INSERT INTO public.compressor_install_brackets (hp_min, hp_max, base_price, k3_supplied_surcharge_pct) VALUES
  (0,    6,  70.000,  10),
  (6.5,  10, 80.000,  10),
  (10.5, 15, 100.000, 10),
  (15.5, 20, 125.000, 10)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Lookup function — given an HP and a "K3 supplies" flag, returns the price.
-- The pricing engine (compute_line_pricing) doesn't currently special-case
-- compressor installs (they're regular service lines today). This function
-- exists so the line picker can surface the correct bracket price for the
-- "Compressor install bracket" service when it's selected; the picker passes
-- the resolved price as a custom-line override.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_compressor_bracket_price(p_hp numeric, p_k3_supplied boolean DEFAULT false)
RETURNS TABLE (bracket_id uuid, base_price numeric, surcharge_pct numeric, total_price numeric)
LANGUAGE sql STABLE AS $$
  SELECT
    b.id,
    b.base_price,
    CASE WHEN p_k3_supplied THEN b.k3_supplied_surcharge_pct ELSE 0 END AS surcharge_pct,
    round(b.base_price * (1 + (CASE WHEN p_k3_supplied THEN b.k3_supplied_surcharge_pct ELSE 0 END) / 100.0), 3)
      AS total_price
  FROM public.compressor_install_brackets b
  WHERE b.is_active = true
    AND p_hp BETWEEN b.hp_min AND b.hp_max
  ORDER BY b.hp_min DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.fn_compressor_bracket_price(numeric, boolean) TO authenticated;
