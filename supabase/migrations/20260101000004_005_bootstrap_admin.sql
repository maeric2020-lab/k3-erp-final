-- =============================================================================
-- K3 ERP — Migration 005
-- Bootstrap first Admin (only when no users exist) + auth user sync trigger
-- =============================================================================

-- -----------------------------------------------------------------------------
-- bootstrap_admin(email, full_name_ar, full_name_en)
--
-- Promotes an EXISTING auth.users entry into the first super_admin and seeds
-- numbering_sequences + company_settings rows.
--
-- Why not create the auth user from SQL? Supabase Auth does not expose an
-- in-database user-creation API; auth.users is managed by GoTrue. Therefore
-- the /setup screen creates the auth user via supabase.auth.signUp(), then
-- calls this RPC to promote them.
--
-- Guard: refuses to run if ANY users_profile row already has is_super_admin=true.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bootstrap_admin(
  p_email         text,
  p_full_name_ar  text,
  p_full_name_en  text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_already_admin uuid;
BEGIN
  -- Refuse if a super_admin already exists (one-shot bootstrap)
  SELECT id INTO v_already_admin
    FROM public.users_profile
    WHERE is_super_admin = true
    LIMIT 1;

  IF v_already_admin IS NOT NULL THEN
    RAISE EXCEPTION 'Bootstrap already completed. Super admin exists.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Find the auth.users row by email
  SELECT id INTO v_user_id FROM auth.users WHERE email = lower(p_email);

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user not found for email: %. Sign up first via Supabase Auth.', p_email
      USING ERRCODE = 'P0002';
  END IF;

  -- Insert (or upgrade) profile
  INSERT INTO public.users_profile (
    id, email, full_name_ar, full_name_en, is_active, is_archived, is_super_admin
  ) VALUES (
    v_user_id, lower(p_email), p_full_name_ar, p_full_name_en, true, false, true
  )
  ON CONFLICT (id) DO UPDATE SET
    is_super_admin = true,
    is_active      = true,
    is_archived    = false,
    full_name_ar   = COALESCE(EXCLUDED.full_name_ar, public.users_profile.full_name_ar),
    full_name_en   = COALESCE(EXCLUDED.full_name_en, public.users_profile.full_name_en),
    updated_at     = now();

  -- Seed company_settings if absent
  INSERT INTO public.company_settings (id, legal_name_ar, legal_name_en)
  VALUES (1, 'شركة كي ثري للتجارة العامة والمقاولات', 'K. Three Co. for Gen. Trad. & Cont.')
  ON CONFLICT (id) DO NOTHING;

  -- Seed numbering sequences if absent
  INSERT INTO public.numbering_sequences (id, prefix, year_resets, current_year, current_value, pad_width, description) VALUES
    ('CUST', 'CUST', false, EXTRACT(YEAR FROM CURRENT_DATE)::int, 0, 5, 'Customer code (no year reset)'),
    ('REQ',  'REQ',  true,  EXTRACT(YEAR FROM CURRENT_DATE)::int, 0, 5, 'Maintenance request number'),
    ('JOB',  'JOB',  true,  EXTRACT(YEAR FROM CURRENT_DATE)::int, 0, 5, 'Job number'),
    ('QUO',  'QUO',  true,  EXTRACT(YEAR FROM CURRENT_DATE)::int, 0, 5, 'Quotation number'),
    ('INV',  'INV',  true,  EXTRACT(YEAR FROM CURRENT_DATE)::int, 0, 5, 'Invoice number'),
    ('PAY',  'PAY',  true,  EXTRACT(YEAR FROM CURRENT_DATE)::int, 0, 5, 'Payment number'),
    ('SRV',  'SRV',  false, EXTRACT(YEAR FROM CURRENT_DATE)::int, 0, 5, 'Service master code'),
    ('PRT',  'PRT',  false, EXTRACT(YEAR FROM CURRENT_DATE)::int, 0, 5, 'Spare part master code')
  ON CONFLICT (id) DO NOTHING;

  -- Note: contract numbers use a separate format "(NNN/YY) TYPE", handled
  -- by a dedicated function in the contracts migration (Phase 4).

  -- Audit
  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, after_data)
  VALUES (v_user_id, 'bootstrap_admin', 'users_profile', v_user_id,
          jsonb_build_object('email', p_email));

  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_admin(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_admin(text, text, text) TO authenticated, anon;

COMMENT ON FUNCTION public.bootstrap_admin IS
  'One-shot first-Admin promotion. Refuses to run if a super_admin already exists. Called by /setup.';

-- -----------------------------------------------------------------------------
-- auth.users → users_profile sync trigger
-- When a new auth user is created via Supabase Auth, ensure a profile row exists.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.users_profile (id, email, is_active, is_archived, is_super_admin)
  VALUES (NEW.id, NEW.email, true, false, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_auth_user();

COMMENT ON TRIGGER trg_on_auth_user_created ON auth.users IS
  'Auto-creates users_profile row on auth signup. Profile starts inactive-permissions until Admin grants screens.';
