-- =============================================================================
-- K3 ERP — ترحيل 031
-- المرحلة 8ج — Multi-tenancy
--
-- الهدف:
--   1. إنشاء جدول companies
--   2. إضافة عمود company_id إلى كل جدول per-tenant
--   3. ربط users_profile بشركة (مستخدم واحد = شركة واحدة)
--   4. تحديث RLS ليحدّ كل قراءة/كتابة بـ company_id الخاص بالمستخدم
--   5. إنشاء company افتراضية لـ K3 وتحويل البيانات الموجودة إليها
--
-- ملاحظة مهمة: يُنفَّذ هذا الترحيل بأمان على قاعدة بيانات فيها بيانات
-- (يُرحِّل كل البيانات إلى الشركة الافتراضية).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) جدول companies
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.companies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text UNIQUE NOT NULL,
  name_ar       text NOT NULL,
  name_en       text NOT NULL,
  cr_number     text,           -- رقم السجل التجاري
  tax_number    text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- trigger updated_at
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2) إنشاء K3 كشركة افتراضية إن لم توجد شركة بعد
-- -----------------------------------------------------------------------------

INSERT INTO public.companies (code, name_ar, name_en)
SELECT 'K3', 'شركة كي ثري للتجارة العامة والمقاولات', 'K. Three Co. for Gen. Trad. & Cont.'
WHERE NOT EXISTS (SELECT 1 FROM public.companies);

-- نحتفظ بمعرّفها لاستخدامه في الترحيل
DO $$
DECLARE
  k3_id uuid;
BEGIN
  SELECT id INTO k3_id FROM public.companies WHERE code = 'K3' LIMIT 1;

  -- -----------------------------------------------------------------------------
  -- 3) إضافة company_id لـ users_profile
  -- -----------------------------------------------------------------------------

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users_profile' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.users_profile ADD COLUMN company_id uuid REFERENCES public.companies(id);
    UPDATE public.users_profile SET company_id = k3_id WHERE company_id IS NULL;
    ALTER TABLE public.users_profile ALTER COLUMN company_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_users_profile_company ON public.users_profile(company_id);
  END IF;

  -- -----------------------------------------------------------------------------
  -- 4) جداول per-tenant — لكل واحد: ALTER + UPDATE + NOT NULL + index
  -- -----------------------------------------------------------------------------

  -- الجداول التي تأخذ company_id
  PERFORM 1;
END $$;

-- نُنفّذ بقية التعديلات خارج DO block للوضوح ولتجنب complexity

-- customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
UPDATE public.customers SET company_id = (SELECT id FROM public.companies WHERE code = 'K3') WHERE company_id IS NULL;
ALTER TABLE public.customers ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_company ON public.customers(company_id);

-- customer_sites
ALTER TABLE public.customer_sites ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
UPDATE public.customer_sites cs SET company_id = c.company_id FROM public.customers c WHERE cs.customer_id = c.id AND cs.company_id IS NULL;
ALTER TABLE public.customer_sites ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_sites_company ON public.customer_sites(company_id);

-- customer_machines
ALTER TABLE public.customer_machines ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
UPDATE public.customer_machines cm SET company_id = c.company_id FROM public.customers c WHERE cm.customer_id = c.id AND cm.company_id IS NULL;
ALTER TABLE public.customer_machines ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_machines_company ON public.customer_machines(company_id);

-- contracts
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
UPDATE public.contracts c SET company_id = cu.company_id FROM public.customers cu WHERE c.customer_id = cu.id AND c.company_id IS NULL;
ALTER TABLE public.contracts ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_company ON public.contracts(company_id);

-- contract_machines
ALTER TABLE public.contract_machines ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
UPDATE public.contract_machines cm SET company_id = c.company_id FROM public.contracts c WHERE cm.contract_id = c.id AND cm.company_id IS NULL;
ALTER TABLE public.contract_machines ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contract_machines_company ON public.contract_machines(company_id);

-- contract_clauses
ALTER TABLE public.contract_clauses ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
UPDATE public.contract_clauses cc SET company_id = c.company_id FROM public.contracts c WHERE cc.contract_id = c.id AND cc.company_id IS NULL;
ALTER TABLE public.contract_clauses ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contract_clauses_company ON public.contract_clauses(company_id);

-- maintenance_requests
ALTER TABLE public.maintenance_requests ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
UPDATE public.maintenance_requests mr SET company_id = c.company_id FROM public.customers c WHERE mr.customer_id = c.id AND mr.company_id IS NULL;
ALTER TABLE public.maintenance_requests ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_company ON public.maintenance_requests(company_id);

-- jobs
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
UPDATE public.jobs j SET company_id = c.company_id FROM public.customers c WHERE j.customer_id = c.id AND j.company_id IS NULL;
ALTER TABLE public.jobs ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_company ON public.jobs(company_id);

-- إضافة created_by/updated_by على jobs (كان ناقصاً — مذكور في تقرير التدقيق S-1)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- document_lines
ALTER TABLE public.document_lines ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
UPDATE public.document_lines dl SET company_id = COALESCE(
  (SELECT j.company_id FROM public.jobs j WHERE j.id = dl.job_id),
  (SELECT q.company_id FROM public.quotations q WHERE q.id = dl.quotation_id),
  (SELECT i.company_id FROM public.invoices i WHERE i.id = dl.invoice_id)
) WHERE dl.company_id IS NULL;
-- ملاحظة: لا نُجبر NOT NULL هنا لأن بعض السطور قد تكون orphan قبل ربطها
CREATE INDEX IF NOT EXISTS idx_doc_lines_company ON public.document_lines(company_id);

-- quotations
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
UPDATE public.quotations q SET company_id = c.company_id FROM public.customers c WHERE q.customer_id = c.id AND q.company_id IS NULL;
ALTER TABLE public.quotations ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotations_company ON public.quotations(company_id);

-- invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
UPDATE public.invoices i SET company_id = c.company_id FROM public.customers c WHERE i.customer_id = c.id AND i.company_id IS NULL;
ALTER TABLE public.invoices ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_company ON public.invoices(company_id);

-- payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
UPDATE public.payments p SET company_id = c.company_id FROM public.customers c WHERE p.customer_id = c.id AND p.company_id IS NULL;
ALTER TABLE public.payments ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_company ON public.payments(company_id);

-- audit_log
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
UPDATE public.audit_log al SET company_id = up.company_id FROM public.users_profile up WHERE al.user_id = up.id AND al.company_id IS NULL;
-- audit_log قد تحوي أحداث بدون user_id؛ نملأها بالشركة الافتراضية
UPDATE public.audit_log SET company_id = (SELECT id FROM public.companies WHERE code = 'K3') WHERE company_id IS NULL;
ALTER TABLE public.audit_log ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_company ON public.audit_log(company_id);

-- chat_threads
ALTER TABLE public.chat_threads ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
UPDATE public.chat_threads ct SET company_id = up.company_id FROM public.chat_thread_members ctm
  JOIN public.users_profile up ON up.id = ctm.user_id
  WHERE ctm.thread_id = ct.id AND ct.company_id IS NULL;
UPDATE public.chat_threads SET company_id = (SELECT id FROM public.companies WHERE code = 'K3') WHERE company_id IS NULL;
ALTER TABLE public.chat_threads ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_threads_company ON public.chat_threads(company_id);

-- import_runs
ALTER TABLE public.import_runs ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
UPDATE public.import_runs SET company_id = (SELECT id FROM public.companies WHERE code = 'K3') WHERE company_id IS NULL;
ALTER TABLE public.import_runs ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_import_runs_company ON public.import_runs(company_id);

-- -----------------------------------------------------------------------------
-- 5) دالة helper لقراءة company_id الحالي
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_current_company_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT company_id FROM public.users_profile WHERE id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- 6) RLS policies جديدة — نُضيف فلتر company_id لكل جدول per-tenant
--
-- ملاحظة: السياسات الموجودة ستستمر (الإذن بحسب الشاشة)؛ نُضيف policy
-- إضافية تفرض company_id. نظراً لأن سياسات RLS تُجمَع بـ AND داخل
-- الأمر الواحد، نحتاج إعادة بناء السياسات لتجمع الشروط بـ AND.
-- 
-- نهج الإصلاح الأكثر أماناً: نُعدّل كل سياسة موجودة لتُضاف لها شرط
-- company_id = fn_current_company_id().
-- -----------------------------------------------------------------------------

-- customers
DROP POLICY IF EXISTS customers_all ON public.customers;
CREATE POLICY customers_all ON public.customers FOR ALL TO authenticated
  USING (
    company_id = public.fn_current_company_id()
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('customers', 'view'))
  )
  WITH CHECK (
    company_id = public.fn_current_company_id()
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('customers', 'edit'))
  );

-- customer_sites
DROP POLICY IF EXISTS customer_sites_all ON public.customer_sites;
CREATE POLICY customer_sites_all ON public.customer_sites FOR ALL TO authenticated
  USING (
    company_id = public.fn_current_company_id()
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('customer_sites', 'view'))
  )
  WITH CHECK (
    company_id = public.fn_current_company_id()
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('customer_sites', 'edit'))
  );

-- customer_machines
DROP POLICY IF EXISTS customer_machines_all ON public.customer_machines;
CREATE POLICY customer_machines_all ON public.customer_machines FOR ALL TO authenticated
  USING (
    company_id = public.fn_current_company_id()
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('customer_machines', 'view'))
  )
  WITH CHECK (
    company_id = public.fn_current_company_id()
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('customer_machines', 'edit'))
  );

-- contracts
DROP POLICY IF EXISTS contracts_all ON public.contracts;
CREATE POLICY contracts_all ON public.contracts FOR ALL TO authenticated
  USING (
    company_id = public.fn_current_company_id()
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('contracts', 'view'))
  )
  WITH CHECK (
    company_id = public.fn_current_company_id()
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('contracts', 'edit'))
  );

-- maintenance_requests
DROP POLICY IF EXISTS mr_all ON public.maintenance_requests;
CREATE POLICY mr_all ON public.maintenance_requests FOR ALL TO authenticated
  USING (
    company_id = public.fn_current_company_id()
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('maintenance_requests', 'view'))
  )
  WITH CHECK (
    company_id = public.fn_current_company_id()
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('maintenance_requests', 'edit'))
  );

-- jobs (للأدمن — الفنّي يستعمل سياسة منفصلة)
DROP POLICY IF EXISTS jobs_admin ON public.jobs;
CREATE POLICY jobs_admin ON public.jobs FOR ALL TO authenticated
  USING (
    company_id = public.fn_current_company_id()
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('jobs', 'view'))
  )
  WITH CHECK (
    company_id = public.fn_current_company_id()
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('jobs', 'edit'))
  );

DROP POLICY IF EXISTS jobs_technician ON public.jobs;
CREATE POLICY jobs_technician ON public.jobs FOR SELECT TO authenticated
  USING (
    company_id = public.fn_current_company_id()
    AND technician_id = auth.uid()
  );

-- invoices
DROP POLICY IF EXISTS invoices_all ON public.invoices;
CREATE POLICY invoices_all ON public.invoices FOR ALL TO authenticated
  USING (
    company_id = public.fn_current_company_id()
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('invoices', 'view'))
  )
  WITH CHECK (
    company_id = public.fn_current_company_id()
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('invoices', 'edit'))
  );

-- payments
DROP POLICY IF EXISTS payments_all ON public.payments;
CREATE POLICY payments_all ON public.payments FOR ALL TO authenticated
  USING (
    company_id = public.fn_current_company_id()
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('payments', 'view'))
  )
  WITH CHECK (
    company_id = public.fn_current_company_id()
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('payments', 'add'))
  );

-- quotations
DROP POLICY IF EXISTS quotations_all ON public.quotations;
CREATE POLICY quotations_all ON public.quotations FOR ALL TO authenticated
  USING (
    company_id = public.fn_current_company_id()
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('quotations', 'view'))
  )
  WITH CHECK (
    company_id = public.fn_current_company_id()
    AND (public.fn_is_super_admin() OR public.fn_has_screen_permission('quotations', 'edit'))
  );

-- chat_threads — يفلتر بالعضوية + company
DROP POLICY IF EXISTS chat_threads_member ON public.chat_threads;
CREATE POLICY chat_threads_member ON public.chat_threads FOR SELECT TO authenticated
  USING (
    company_id = public.fn_current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.chat_thread_members ctm
       WHERE ctm.thread_id = chat_threads.id AND ctm.user_id = auth.uid()
    )
  );

-- companies — كل مستخدم يرى شركته فقط
DROP POLICY IF EXISTS companies_self ON public.companies;
CREATE POLICY companies_self ON public.companies FOR SELECT TO authenticated
  USING (id = public.fn_current_company_id());

-- -----------------------------------------------------------------------------
-- 7) trigger يملأ company_id تلقائياً من المستخدم عند الـ INSERT
--    يبسّط الكود في الـ services (لا داعي لتمرير company_id يدوياً)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_set_company_id()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.fn_current_company_id();
  END IF;
  RETURN NEW;
END $$;

-- نطبّقه على الجداول الرئيسية (المستودعات تُمرّر company_id حالياً، لكن
-- هذا يحمي من النسيان مستقبلاً)
DROP TRIGGER IF EXISTS trg_customers_company_id ON public.customers;
CREATE TRIGGER trg_customers_company_id BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_company_id();

DROP TRIGGER IF EXISTS trg_jobs_company_id ON public.jobs;
CREATE TRIGGER trg_jobs_company_id BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_company_id();

DROP TRIGGER IF EXISTS trg_invoices_company_id ON public.invoices;
CREATE TRIGGER trg_invoices_company_id BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_company_id();

DROP TRIGGER IF EXISTS trg_requests_company_id ON public.maintenance_requests;
CREATE TRIGGER trg_requests_company_id BEFORE INSERT ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_company_id();

DROP TRIGGER IF EXISTS trg_payments_company_id ON public.payments;
CREATE TRIGGER trg_payments_company_id BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_company_id();

-- =============================================================================
-- نهاية ترحيل 031
-- =============================================================================
