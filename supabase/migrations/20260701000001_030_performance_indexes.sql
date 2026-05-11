-- =============================================================================
-- K3 ERP — ترحيل 030
-- المرحلة 7ج — فهارس الأداء
--
-- بناءً على تحليل استعلامات RPCs المرحلة 6، تُضاف فهارس استباقية على
-- الأعمدة الأكثر استخداماً في المُرشّحات والـ JOINs.
--
-- منهجية: لا تُضاف فهارس إلا إذا أكّد EXPLAIN ANALYZE على بيانات كبيرة
-- أن الـ planner يلجأ إلى Seq Scan. الفهارس أدناه نتيجة هذا التحليل.
--
-- IF NOT EXISTS لجعل التشغيل آمناً عند إعادة التطبيق.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- jobs: الفهارس الأكثر تأثيراً
-- -----------------------------------------------------------------------------

-- لـ fn_dashboard_today_jobs: فحص بـ created_at ضمن اليوم
CREATE INDEX IF NOT EXISTS idx_jobs_created_at_date ON public.jobs ((created_at::date));

-- لـ fn_dashboard_today_jobs: completed_today
CREATE INDEX IF NOT EXISTS idx_jobs_completed_at_date ON public.jobs ((completed_at::date))
  WHERE completed_at IS NOT NULL;

-- لـ fn_report_technician_perf: فلتر بالفني والتاريخ
CREATE INDEX IF NOT EXISTS idx_jobs_tech_created
  ON public.jobs (technician_id, (created_at::date))
  WHERE technician_id IS NOT NULL;

-- لـ fn_report_jobs_by_tech: فلتر الحالة + الفني
CREATE INDEX IF NOT EXISTS idx_jobs_tech_status
  ON public.jobs (technician_id, status)
  WHERE technician_id IS NOT NULL;

-- لـ jobs_my (الفنّي يرى وظائفه): فهرس مركّب
CREATE INDEX IF NOT EXISTS idx_jobs_tech_id_status
  ON public.jobs (technician_id, status, created_at DESC);

-- -----------------------------------------------------------------------------
-- invoices: الفهارس
-- -----------------------------------------------------------------------------

-- لـ fn_dashboard_overdue_invoices: outstanding بالحالة
CREATE INDEX IF NOT EXISTS idx_invoices_outstanding
  ON public.invoices (due_date)
  WHERE status IN ('issued','partial') AND balance > 0;

-- لـ fn_dashboard_revenue_mtd و fn_report_sales: فلتر بالتاريخ
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date_status
  ON public.invoices (issue_date, status);

-- لـ fn_report_payment_aging: العميل + balance > 0
CREATE INDEX IF NOT EXISTS idx_invoices_customer_balance
  ON public.invoices (customer_id)
  WHERE status IN ('issued','partial') AND balance > 0;

-- لـ fn_report_customer_balances: تجميع per-customer
CREATE INDEX IF NOT EXISTS idx_invoices_customer_status
  ON public.invoices (customer_id, status)
  WHERE status NOT IN ('cancelled','void');

-- -----------------------------------------------------------------------------
-- maintenance_requests: dashboard
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_requests_status_priority
  ON public.maintenance_requests (status, priority)
  WHERE status IN ('open','in_progress');

-- -----------------------------------------------------------------------------
-- document_lines: تقارير القطع والغازات
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_doc_lines_part_date
  ON public.document_lines (part_id, (created_at::date))
  WHERE line_type = 'part' AND part_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_doc_lines_gas_date
  ON public.document_lines (gas_id, (created_at::date))
  WHERE line_type = 'gas' AND gas_id IS NOT NULL;

-- لتسريع join على job_id (تقارير الاستهلاك تستخدم count distinct)
CREATE INDEX IF NOT EXISTS idx_doc_lines_job_type
  ON public.document_lines (job_id, line_type);

-- -----------------------------------------------------------------------------
-- contracts: للتقرير العقود النشطة
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_contracts_active_end_date
  ON public.contracts (end_date)
  WHERE status = 'active';

-- -----------------------------------------------------------------------------
-- chat_messages: تحميل آخر رسالة لكل thread (DISTINCT ON)
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created
  ON public.chat_messages (thread_id, created_at DESC)
  WHERE is_deleted = false;

-- لاحساب unread_count بسرعة
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_sender_created
  ON public.chat_messages (thread_id, sender_id, created_at)
  WHERE is_deleted = false;

-- -----------------------------------------------------------------------------
-- payments: التقارير المالية
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_payments_customer_date
  ON public.payments (customer_id, payment_date);

CREATE INDEX IF NOT EXISTS idx_payments_invoice
  ON public.payments (invoice_id);

-- -----------------------------------------------------------------------------
-- audit_log: فلاتر الشاشة
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON public.audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON public.audit_log (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_action_created
  ON public.audit_log (action, created_at DESC);

-- -----------------------------------------------------------------------------
-- إحصاءات: تنفيذ ANALYZE على الجداول الكبيرة بعد إضافة الفهارس
-- -----------------------------------------------------------------------------

ANALYZE public.jobs;
ANALYZE public.invoices;
ANALYZE public.maintenance_requests;
ANALYZE public.document_lines;
ANALYZE public.contracts;
ANALYZE public.chat_messages;
ANALYZE public.payments;
ANALYZE public.audit_log;

-- =============================================================================
-- نهاية ترحيل 030
-- =============================================================================
