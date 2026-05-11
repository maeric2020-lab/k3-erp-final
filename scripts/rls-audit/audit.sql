-- =============================================================================
-- K3 ERP — تدقيق RLS
-- يُشغَّل هذا السكربت بشكل قراءة فقط على قاعدة البيانات الحية للإجابة على:
--   1. ما الجداول التي ليست عليها RLS مفعّل؟
--   2. ما الجداول التي عليها RLS لكنها بدون أي سياسة (مما يجعلها تمنع كل شيء)؟
--   3. ما السياسات التي تستخدم USING(true) أو WITH CHECK(true)؟
--   4. ما الجداول التي ليس لها سياسة SELECT لمستخدم authenticated؟
--   5. ما الدوال SECURITY DEFINER التي قد تتجاوز RLS عن غير قصد؟
-- =============================================================================

\echo '=== 1) جداول بدون تفعيل RLS (خطير) ==='
SELECT n.nspname AS schema, c.relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND NOT c.relrowsecurity
 ORDER BY c.relname;

\echo ''
\echo '=== 2) جداول عليها RLS لكن بدون أي سياسة (تمنع الكل) ==='
SELECT n.nspname AS schema, c.relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND c.relrowsecurity
   AND NOT EXISTS (
     SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid
   )
 ORDER BY c.relname;

\echo ''
\echo '=== 3) سياسات استخدمت USING(true) أو WITH CHECK(true) ==='
SELECT schemaname, tablename, policyname, cmd,
       pg_get_expr(pol.polqual, pol.polrelid)      AS using_expr,
       pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr
  FROM pg_policies pp
  JOIN pg_policy   pol ON pol.polname = pp.policyname
                       AND pol.polrelid = (pp.schemaname || '.' || pp.tablename)::regclass
 WHERE pp.schemaname = 'public'
   AND (
     pg_get_expr(pol.polqual, pol.polrelid)      = 'true'
     OR pg_get_expr(pol.polwithcheck, pol.polrelid) = 'true'
   )
 ORDER BY tablename, policyname;

\echo ''
\echo '=== 4) جداول بدون سياسة SELECT لمستخدم authenticated ==='
SELECT c.relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND c.relrowsecurity
   AND NOT EXISTS (
     SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = c.relname
        AND (p.cmd = 'SELECT' OR p.cmd = 'ALL')
        AND 'authenticated' = ANY(COALESCE(p.roles, ARRAY['public']))
   )
 ORDER BY c.relname;

\echo ''
\echo '=== 5) دوال SECURITY DEFINER في schema public ==='
SELECT n.nspname AS schema, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS is_security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.prosecdef = true
 ORDER BY p.proname;

\echo ''
\echo '=== 6) دوال SECURITY DEFINER بدون SET search_path (خطر تسلل) ==='
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.prosecdef = true
   AND NOT EXISTS (
     SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
      WHERE cfg LIKE 'search_path=%'
   )
 ORDER BY p.proname;

\echo ''
\echo '=== 7) عدّ السياسات لكل جدول ==='
SELECT tablename, count(*) AS policy_count,
       string_agg(DISTINCT cmd, ', ' ORDER BY cmd) AS commands
  FROM pg_policies
 WHERE schemaname = 'public'
 GROUP BY tablename
 ORDER BY tablename;

\echo ''
\echo '=== 8) فحص buckets في storage ==='
SELECT id, public, file_size_limit FROM storage.buckets ORDER BY id;
