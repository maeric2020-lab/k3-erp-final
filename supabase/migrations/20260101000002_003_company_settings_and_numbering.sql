-- =============================================================================
-- K3 ERP — Migration 003
-- Company settings (single row), numbering sequences, system settings
-- =============================================================================

-- -----------------------------------------------------------------------------
-- company_settings  (single row, id always = 1)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_settings (
  id                     integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  legal_name_ar          text,
  legal_name_en          text,
  short_name             text,
  logo_path              text,                              -- Storage path within 'logos' bucket
  letterhead_path        text,                              -- Storage path within 'letterheads' bucket (contracts only)
  address_ar             text,
  address_en             text,
  phone_primary          text,
  phone_secondary        text,
  email                  citext,
  website                text,
  civil_id_no            text,
  commercial_reg_no      text,
  tax_no                 text,
  default_currency       text NOT NULL DEFAULT 'KWD',
  currency_decimals      integer NOT NULL DEFAULT 3,         -- KWD = 3 decimal places
  default_language       text NOT NULL DEFAULT 'ar' CHECK (default_language IN ('ar', 'en')),
  -- Global toggles
  allow_other_problem    boolean NOT NULL DEFAULT false,     -- "Other" free-text on maintenance report
  allow_off_catalog_machine boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  updated_by             uuid REFERENCES public.users_profile(id)
);

DROP TRIGGER IF EXISTS trg_company_settings_updated_at ON public.company_settings;
CREATE TRIGGER trg_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

COMMENT ON TABLE  public.company_settings IS 'Single-row global configuration. The CHECK enforces id = 1.';
COMMENT ON COLUMN public.company_settings.allow_other_problem IS 'When false, technicians cannot use the "Other" free-text option on maintenance reports.';

-- -----------------------------------------------------------------------------
-- numbering_sequences  (DB-managed counters for REQ/JOB/INV/QUO/CONT/PAY)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.numbering_sequences (
  id              text PRIMARY KEY,                          -- 'REQ', 'JOB', 'INV', 'QUO', 'CONT', 'PAY', 'CUST'
  prefix          text NOT NULL,
  year_resets     boolean NOT NULL DEFAULT true,
  current_year    integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  current_value   bigint  NOT NULL DEFAULT 0,
  pad_width       integer NOT NULL DEFAULT 5,                -- 00001
  separator       text    NOT NULL DEFAULT '-',
  format_template text,                                       -- if NULL, default format used
  description     text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.numbering_sequences IS
  'Atomic counters for business document numbers. Use fn_next_doc_no() to fetch next value.';

-- -----------------------------------------------------------------------------
-- fn_next_doc_no(sequence_id) — atomically increments and returns formatted number
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_next_doc_no(p_sequence_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row   public.numbering_sequences%ROWTYPE;
  v_year  integer := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  v_next  bigint;
BEGIN
  -- Lock the row to prevent concurrent gaps
  SELECT * INTO v_row FROM public.numbering_sequences WHERE id = p_sequence_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Numbering sequence not found: %', p_sequence_id USING ERRCODE = 'P0002';
  END IF;

  -- Year reset
  IF v_row.year_resets AND v_row.current_year <> v_year THEN
    UPDATE public.numbering_sequences
       SET current_year  = v_year,
           current_value = 1,
           updated_at    = now()
     WHERE id = p_sequence_id;
    v_next := 1;
  ELSE
    UPDATE public.numbering_sequences
       SET current_value = current_value + 1,
           updated_at    = now()
     WHERE id = p_sequence_id
     RETURNING current_value INTO v_next;
  END IF;

  -- Format: PREFIX-YYYY-00001  (e.g. REQ-2026-00001)
  RETURN format('%s%s%s%s%s',
    v_row.prefix,
    v_row.separator,
    v_year,
    v_row.separator,
    LPAD(v_next::text, v_row.pad_width, '0')
  );
END;
$$;

COMMENT ON FUNCTION public.fn_next_doc_no IS
  'Atomically increments the named sequence and returns a formatted business number (e.g. REQ-2026-00001). Locks the row so no two callers can produce duplicates.';
