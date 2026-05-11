-- =============================================================================
-- K3 ERP — Migration 008
-- Customers and customer sites
-- =============================================================================

-- -----------------------------------------------------------------------------
-- customers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,                 -- auto: CUST-00001
  name_ar         text NOT NULL,
  name_en         text,
  customer_type   text NOT NULL DEFAULT 'individual'
                  CHECK (customer_type IN ('individual','company','government')),
  civil_id        text,
  email           citext,
  phone_primary   text,
  phone_secondary text,
  notes           text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES public.users_profile(id),
  updated_by      uuid REFERENCES public.users_profile(id)
);

CREATE INDEX IF NOT EXISTS idx_customers_name_ar     ON public.customers (name_ar);
CREATE INDEX IF NOT EXISTS idx_customers_name_en     ON public.customers (name_en);
CREATE INDEX IF NOT EXISTS idx_customers_phone       ON public.customers (phone_primary);
CREATE INDEX IF NOT EXISTS idx_customers_is_active   ON public.customers (is_active) WHERE is_active = true;

-- Trigram index for fuzzy search on Arabic + English names
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_customers_name_ar_trgm ON public.customers USING gin (name_ar gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_name_en_trgm ON public.customers USING gin (name_en gin_trgm_ops);

DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Auto-assign customer code on insert if not provided
CREATE OR REPLACE FUNCTION public.fn_customers_assign_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.fn_next_doc_no('CUST');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customers_assign_code ON public.customers;
CREATE TRIGGER trg_customers_assign_code
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.fn_customers_assign_code();

-- -----------------------------------------------------------------------------
-- customer_sites — Kuwait address structure
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_sites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  site_name       text,                                  -- e.g. "Salmiya Branch", optional
  governorate     text,                                  -- محافظة (e.g. مدينة الكويت)
  area            text,                                  -- منطقة
  block           text,                                  -- قطعة
  street          text,                                  -- شارع
  avenue          text,                                  -- جادة
  building        text,                                  -- منزل / building no
  full_address    text,                                  -- denormalized for printing
  latitude        numeric(10,7),
  longitude       numeric(10,7),
  is_primary      boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES public.users_profile(id),
  updated_by      uuid REFERENCES public.users_profile(id)
);

CREATE INDEX IF NOT EXISTS idx_customer_sites_customer ON public.customer_sites (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_sites_active   ON public.customer_sites (is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_customer_sites_updated_at ON public.customer_sites;
CREATE TRIGGER trg_customer_sites_updated_at
  BEFORE UPDATE ON public.customer_sites
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Maintain "only one primary site per customer" invariant
CREATE OR REPLACE FUNCTION public.fn_customer_sites_enforce_primary()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.customer_sites
       SET is_primary = false
     WHERE customer_id = NEW.customer_id
       AND id <> NEW.id
       AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_sites_enforce_primary ON public.customer_sites;
CREATE TRIGGER trg_customer_sites_enforce_primary
  AFTER INSERT OR UPDATE OF is_primary ON public.customer_sites
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION public.fn_customer_sites_enforce_primary();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_sites  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customers_select ON public.customers;
CREATE POLICY customers_select ON public.customers FOR SELECT TO authenticated
  USING (public.fn_has_screen_permission('customers', 'view'));

DROP POLICY IF EXISTS customers_insert ON public.customers;
CREATE POLICY customers_insert ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_screen_permission('customers', 'add'));

DROP POLICY IF EXISTS customers_update ON public.customers;
CREATE POLICY customers_update ON public.customers FOR UPDATE TO authenticated
  USING (public.fn_has_screen_permission('customers', 'edit'))
  WITH CHECK (public.fn_has_screen_permission('customers', 'edit'));

DROP POLICY IF EXISTS customers_delete ON public.customers;
CREATE POLICY customers_delete ON public.customers FOR DELETE TO authenticated
  USING (public.fn_has_screen_permission('customers', 'delete'));

DROP POLICY IF EXISTS customer_sites_select ON public.customer_sites;
CREATE POLICY customer_sites_select ON public.customer_sites FOR SELECT TO authenticated
  USING (public.fn_has_screen_permission('customer_sites', 'view') OR public.fn_has_screen_permission('customers', 'view'));

DROP POLICY IF EXISTS customer_sites_insert ON public.customer_sites;
CREATE POLICY customer_sites_insert ON public.customer_sites FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_screen_permission('customer_sites', 'add') OR public.fn_has_screen_permission('customers', 'edit'));

DROP POLICY IF EXISTS customer_sites_update ON public.customer_sites;
CREATE POLICY customer_sites_update ON public.customer_sites FOR UPDATE TO authenticated
  USING (public.fn_has_screen_permission('customer_sites', 'edit') OR public.fn_has_screen_permission('customers', 'edit'))
  WITH CHECK (public.fn_has_screen_permission('customer_sites', 'edit') OR public.fn_has_screen_permission('customers', 'edit'));

DROP POLICY IF EXISTS customer_sites_delete ON public.customer_sites;
CREATE POLICY customer_sites_delete ON public.customer_sites FOR DELETE TO authenticated
  USING (public.fn_has_screen_permission('customer_sites', 'delete') OR public.fn_has_screen_permission('customers', 'delete'));
