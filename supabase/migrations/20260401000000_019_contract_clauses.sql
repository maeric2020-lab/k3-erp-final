-- =============================================================================
-- K3 ERP — Migration 019
-- Contract clause templates (admin-edited library) and per-contract clause
-- snapshots. Contracts have multiple sections of bilingual text (preamble,
-- coverage, exclusions, liability, signatures). Each section is a "clause"
-- with AR + EN bodies. Templates seed default content; the wizard lets the
-- contract creator edit text per contract.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- contract_clause_templates: the editable library of default clauses
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_clause_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,                  -- e.g. 'preamble','coverage','exclusions','liability'
  display_order   integer NOT NULL DEFAULT 0,
  title_ar        text NOT NULL,
  title_en        text NOT NULL,
  body_ar         text NOT NULL,
  body_en         text NOT NULL,
  -- An optional per-contract-type body. NULL means use the default.
  applies_to      text[] NOT NULL DEFAULT ARRAY[]::text[], -- empty = all types; otherwise filter
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES public.users_profile(id),
  updated_by      uuid REFERENCES public.users_profile(id)
);

DROP TRIGGER IF EXISTS trg_cct_updated_at ON public.contract_clause_templates;
CREATE TRIGGER trg_cct_updated_at
  BEFORE UPDATE ON public.contract_clause_templates
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- -----------------------------------------------------------------------------
-- contract_clauses: snapshot of clauses for a specific contract
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_clauses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  template_id     uuid REFERENCES public.contract_clause_templates(id) ON DELETE SET NULL,
  code            text NOT NULL,
  display_order   integer NOT NULL DEFAULT 0,
  title_ar        text NOT NULL,
  title_en        text NOT NULL,
  body_ar         text NOT NULL,
  body_en         text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cc_contract ON public.contract_clauses (contract_id);

DROP TRIGGER IF EXISTS trg_cc_updated_at ON public.contract_clauses;
CREATE TRIGGER trg_cc_updated_at
  BEFORE UPDATE ON public.contract_clauses
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.contract_clause_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_clauses          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cct_select ON public.contract_clause_templates;
CREATE POLICY cct_select ON public.contract_clause_templates FOR SELECT TO authenticated
  USING (public.fn_has_screen_permission('contracts', 'view') OR public.fn_is_super_admin());

DROP POLICY IF EXISTS cct_insert ON public.contract_clause_templates;
CREATE POLICY cct_insert ON public.contract_clause_templates FOR INSERT TO authenticated
  WITH CHECK (public.fn_has_screen_permission('contract_clause_templates', 'add') OR public.fn_is_super_admin());

DROP POLICY IF EXISTS cct_update ON public.contract_clause_templates;
CREATE POLICY cct_update ON public.contract_clause_templates FOR UPDATE TO authenticated
  USING (public.fn_has_screen_permission('contract_clause_templates', 'edit') OR public.fn_is_super_admin())
  WITH CHECK (public.fn_has_screen_permission('contract_clause_templates', 'edit') OR public.fn_is_super_admin());

DROP POLICY IF EXISTS cct_delete ON public.contract_clause_templates;
CREATE POLICY cct_delete ON public.contract_clause_templates FOR DELETE TO authenticated
  USING (public.fn_has_screen_permission('contract_clause_templates', 'delete') OR public.fn_is_super_admin());

DROP POLICY IF EXISTS cc_all ON public.contract_clauses;
CREATE POLICY cc_all ON public.contract_clauses FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_clauses.contract_id
            AND public.fn_has_screen_permission('contracts', 'view'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_clauses.contract_id
            AND public.fn_has_screen_permission('contracts', 'edit'))
  );

-- -----------------------------------------------------------------------------
-- Seed default clause templates (Arabic primary, English mirror)
-- -----------------------------------------------------------------------------
INSERT INTO public.contract_clause_templates (code, display_order, title_ar, title_en, body_ar, body_en) VALUES
  ('preamble', 10,
   'تمهيد',
   'Preamble',
   'تم الاتفاق بين شركة كي ثري للتجارة العامة والمقاولات (المشار إليها فيما بعد بالطرف الأول) والعميل المذكور أعلاه (المشار إليه فيما بعد بالطرف الثاني) على ما يلي:',
   'It has been agreed between K. Three Co. for General Trading and Contracting (hereinafter "First Party") and the customer named above (hereinafter "Second Party") as follows:'),
  ('coverage', 20,
   'نطاق الخدمة',
   'Scope of service',
   'يلتزم الطرف الأول بصيانة وحدات التكييف المدرجة أدناه طبقاً لشروط العقد المبيّن نوعه. تشمل الصيانة الزيارات الدورية والإصلاحات الواقعة ضمن نطاق التغطية.',
   'The First Party undertakes maintenance of the air-conditioning units listed below in accordance with the contract type indicated. Coverage includes scheduled visits and repairs falling within the agreed scope.'),
  ('exclusions', 30,
   'الاستثناءات',
   'Exclusions',
   'لا يشمل هذا العقد الأضرار الناتجة عن سوء الاستخدام أو الإهمال أو الكوارث الطبيعية. لا تُغطى التركيبات الجديدة ولا الأعمال خارج موقع العقد.',
   'This contract does not cover damage resulting from misuse, negligence, or natural disasters. New installations and works outside the contract site are not covered.'),
  ('payment', 40,
   'الدفع',
   'Payment',
   'يُسدَّد إجمالي قيمة العقد دفعة واحدة أو وفقاً للشروط المتفق عليها كتابةً بين الطرفين.',
   'The total contract value shall be paid in a single payment or as otherwise agreed in writing between the parties.'),
  ('liability', 50,
   'حدود المسؤولية',
   'Limits of liability',
   'تقتصر مسؤولية الطرف الأول على إصلاح أو استبدال المعدات المغطاة وفقاً لهذا العقد. ولا يكون مسؤولاً عن أي أضرار غير مباشرة أو تبعية.',
   'The First Party''s liability is limited to repair or replacement of covered equipment as per this contract and shall not be liable for any indirect or consequential damages.'),
  ('term', 60,
   'مدة العقد',
   'Term',
   'يسري هذا العقد من تاريخ البدء المذكور أعلاه ولمدة سنة واحدة (أو أربع سنوات للعقد الذهبي) قابلة للتجديد بالاتفاق الكتابي.',
   'This contract is effective from the start date indicated above for a period of one year (or four years for Golden contracts), renewable by written agreement.'),
  ('signatures', 99,
   'التوقيعات',
   'Signatures',
   'الطرف الأول: شركة كي ثري للتجارة العامة والمقاولات\n\nالطرف الثاني: ___________________________\n\nالتاريخ: ___________________________',
   'First Party: K. Three Co. for General Trading and Contracting\n\nSecond Party: ___________________________\n\nDate: ___________________________')
ON CONFLICT (code) DO NOTHING;
