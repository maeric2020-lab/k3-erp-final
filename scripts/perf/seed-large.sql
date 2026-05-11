-- =============================================================================
-- K3 ERP — seed أداء
-- يولّد بيانات اختبار حجمها يحاكي 5 سنوات من الإنتاج المتوسط:
--   - 2,000 عميل
--   - 5,000 آلة عميل
--   - 500 عقد
--   - 50,000 طلب صيانة
--   - 50,000 وظيفة
--   - 200,000 سطر مستند
--   - 40,000 فاتورة
--   - 60,000 دفعة
--
-- يُنفَّذ على قاعدة بيانات staging فقط، ليس على الإنتاج.
-- =============================================================================

\timing on

-- 1) عملاء
INSERT INTO public.customers (code, name_ar, name_en)
SELECT 'PERF-' || lpad(g::text, 5, '0'),
       'عميل أداء ' || g,
       'Perf Customer ' || g
  FROM generate_series(1, 2000) g
ON CONFLICT (code) DO NOTHING;

-- 2) آلات عميل
INSERT INTO public.customer_machines (customer_id, serial_no)
SELECT c.id,
       'SN-PERF-' || lpad((c_idx*1000 + m)::text, 7, '0')
  FROM (
    SELECT id, row_number() OVER () AS c_idx FROM public.customers
     WHERE code LIKE 'PERF-%' LIMIT 1000
  ) c,
  generate_series(1, 5) m;

-- 3) طلبات صيانة (50k)
INSERT INTO public.maintenance_requests (
  request_no, customer_id, request_type, problem_code, status, priority, created_at
)
SELECT 'REQ-PERF-' || lpad(g::text, 6, '0'),
       (SELECT id FROM public.customers WHERE code LIKE 'PERF-%'
         OFFSET (random()*1999)::int LIMIT 1),
       (ARRAY['CASH','CO','CW','CWC','UG'])[ceil(random()*5)],
       (ARRAY['no_cooling','weak_cooling','water_leak','gas_leak'])[ceil(random()*4)],
       (ARRAY['open','in_progress','closed','cancelled'])[ceil(random()*4)],
       (ARRAY['low','normal','high','urgent'])[ceil(random()*4)],
       now() - (random() * interval '5 years')
  FROM generate_series(1, 50000) g;

-- 4) وظائف (50k) — معظمها مرتبطة بطلبات
INSERT INTO public.jobs (
  customer_id, status, problem_code, created_at, completed_at, arrived_at
)
SELECT mr.customer_id,
       (ARRAY['assigned','completed','invoiced','closed','cancelled'])[ceil(random()*5)],
       mr.problem_code,
       mr.created_at,
       CASE WHEN random() > 0.3 THEN mr.created_at + (random()*interval '8 hours') END,
       CASE WHEN random() > 0.3 THEN mr.created_at + (random()*interval '4 hours') END
  FROM public.maintenance_requests mr
 WHERE mr.request_no LIKE 'REQ-PERF-%';

-- 5) سطور مستند (200k)
INSERT INTO public.document_lines (
  job_id, line_type, description_ar, description_en,
  quantity, unit_price, contract_type, created_at
)
SELECT j.id,
       'custom',
       'سطر اختبار',
       'Test line',
       (random()*5+1)::int,
       round((random()*100)::numeric, 3),
       (ARRAY['CASH','CW','UG'])[ceil(random()*3)],
       j.created_at
  FROM public.jobs j
 ORDER BY random()
 LIMIT 200000;

-- 6) فواتير (40k)
INSERT INTO public.invoices (
  invoice_no, customer_id, total_amount, amount_paid, status, issue_date, due_date
)
SELECT 'INV-PERF-' || lpad(g::text, 6, '0'),
       (SELECT id FROM public.customers WHERE code LIKE 'PERF-%'
         OFFSET (random()*1999)::int LIMIT 1),
       round((random()*500+10)::numeric, 3),
       0,
       (ARRAY['issued','partial','paid','cancelled'])[ceil(random()*4)],
       current_date - (random() * 365)::int,
       current_date - (random() * 365)::int + (random()*60)::int
  FROM generate_series(1, 40000) g;

-- 7) دفعات (60k) — معظمها على فواتير موجودة
INSERT INTO public.payments (invoice_id, customer_id, amount, method, payment_date)
SELECT i.id, i.customer_id,
       round((random() * (i.total_amount * 0.5))::numeric, 3),
       (ARRAY['cash','knet','bank_transfer'])[ceil(random()*3)],
       i.issue_date + (random()*30)::int
  FROM public.invoices i
 WHERE i.invoice_no LIKE 'INV-PERF-%'
 ORDER BY random()
 LIMIT 60000;

\echo '=== seed مكتمل ==='
SELECT 'customers' AS tbl, count(*) FROM public.customers
UNION ALL SELECT 'customer_machines', count(*) FROM public.customer_machines
UNION ALL SELECT 'maintenance_requests', count(*) FROM public.maintenance_requests
UNION ALL SELECT 'jobs', count(*) FROM public.jobs
UNION ALL SELECT 'document_lines', count(*) FROM public.document_lines
UNION ALL SELECT 'invoices', count(*) FROM public.invoices
UNION ALL SELECT 'payments', count(*) FROM public.payments;
