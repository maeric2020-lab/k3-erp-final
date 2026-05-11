-- =============================================================================
-- K3 ERP — تحليل أداء RPCs
-- يُشغّل EXPLAIN ANALYZE على كل دوال المرحلة 6 لاكتشاف:
--   - Seq Scans غير ضرورية
--   - Sort/Hash steps الكبيرة
--   - أوقات استجابة > 100ms على بيانات اختبار 5 سنوات
--
-- المعيار المقبول: كل دالة < 200ms على البيانات الكبيرة.
-- =============================================================================

\timing on
\echo ''
\echo '################################################################'
\echo '# 1. fn_dashboard_today_jobs'
\echo '################################################################'
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT * FROM public.fn_dashboard_today_jobs();

\echo ''
\echo '################################################################'
\echo '# 2. fn_dashboard_open_requests'
\echo '################################################################'
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT * FROM public.fn_dashboard_open_requests();

\echo ''
\echo '################################################################'
\echo '# 3. fn_dashboard_overdue_invoices'
\echo '################################################################'
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT * FROM public.fn_dashboard_overdue_invoices();

\echo ''
\echo '################################################################'
\echo '# 4. fn_dashboard_revenue_mtd'
\echo '################################################################'
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT * FROM public.fn_dashboard_revenue_mtd();

\echo ''
\echo '################################################################'
\echo '# 5. fn_report_sales (آخر 30 يوم)'
\echo '################################################################'
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT * FROM public.fn_report_sales(current_date - 30, current_date);

\echo ''
\echo '################################################################'
\echo '# 6. fn_report_payment_aging'
\echo '################################################################'
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT * FROM public.fn_report_payment_aging();

\echo ''
\echo '################################################################'
\echo '# 7. fn_report_technician_perf (آخر 30 يوم)'
\echo '################################################################'
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT * FROM public.fn_report_technician_perf(current_date - 30, current_date);

\echo ''
\echo '################################################################'
\echo '# 8. fn_report_jobs_by_tech'
\echo '################################################################'
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT * FROM public.fn_report_jobs_by_tech();

\echo ''
\echo '################################################################'
\echo '# 9. fn_report_parts_consumption (آخر 30 يوم)'
\echo '################################################################'
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT * FROM public.fn_report_parts_consumption(current_date - 30, current_date);

\echo ''
\echo '################################################################'
\echo '# 10. fn_report_customer_balances'
\echo '################################################################'
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT * FROM public.fn_report_customer_balances();

\echo ''
\echo '################################################################'
\echo '# 11. fn_report_active_contracts'
\echo '################################################################'
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT * FROM public.fn_report_active_contracts();

\echo ''
\echo '################################################################'
\echo '# 12. fn_chat_thread_summary'
\echo '################################################################'
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT * FROM public.fn_chat_thread_summary();
