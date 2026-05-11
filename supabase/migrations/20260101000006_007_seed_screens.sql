-- =============================================================================
-- K3 ERP — Migration 007
-- Seed: screens catalog (45 screens), grouped by module
--
-- This is the canonical list of screens used by the permission system.
-- Adding a new screen later = INSERT into this table; no code change required
-- in the permission engine.
-- =============================================================================

INSERT INTO public.screens (code, module, label_ar, label_en, default_actions, display_order) VALUES
  -- Dashboard
  ('dashboard',                 'dashboard',     'لوحة التحكم',                   'Dashboard',                ARRAY['view'], 1),

  -- Operations
  ('maintenance_requests',      'operations',    'طلبات الصيانة',                 'Maintenance requests',     ARRAY['view','add','edit','delete','assign','print','export'],  10),
  ('my_jobs',                   'operations',    'مهامي',                          'My jobs',                  ARRAY['view'], 11),
  ('jobs_supervisor',           'operations',    'إشراف المهام',                  'Jobs supervisor',          ARRAY['view','assign','approve','print','export'], 12),
  ('job_detail',                'operations',    'تفاصيل المهمة',                 'Job detail',               ARRAY['view','edit','print'], 13),
  ('maintenance_report',        'operations',    'تقرير الصيانة',                 'Maintenance report',       ARRAY['view','print','export'], 14),

  -- Sales & Finance
  ('quotations',                'sales',         'عروض الأسعار',                  'Quotations',               ARRAY['view','add','edit','delete','approve','print','export'], 20),
  ('contracts',                 'sales',         'العقود',                          'Contracts',                ARRAY['view','add','edit','delete','print','export'],          21),
  ('contract_builder',          'sales',         'منشئ العقود',                   'Contract builder',         ARRAY['view','edit'], 22),
  ('invoices',                  'finance',       'الفواتير',                       'Invoices',                 ARRAY['view','add','edit','delete','print','export'],          30),
  ('payments',                  'finance',       'المدفوعات',                      'Payments',                 ARRAY['view','add','edit','delete','print','export'],          31),

  -- Customers
  ('customers',                 'customers',     'العملاء',                        'Customers',                ARRAY['view','add','edit','delete','export'],   40),
  ('customer_sites',            'customers',     'مواقع العملاء',                 'Customer sites',           ARRAY['view','add','edit','delete'],            41),

  -- Masters
  ('machine_categories',        'masters',       'فئات الماكينات',                'Machine categories',       ARRAY['view','add','edit','delete'],            50),
  ('machine_brands',            'masters',       'ماركات الماكينات',              'Machine brands',           ARRAY['view','add','edit','delete'],            51),
  ('machines_master',           'masters',       'بيانات الماكينات',              'Machines master',          ARRAY['view','add','edit','delete','import','export'], 52),
  ('service_categories',        'masters',       'فئات الخدمات',                  'Service categories',       ARRAY['view','add','edit','delete'],            53),
  ('service_types',             'masters',       'أنواع الخدمات',                 'Service types',            ARRAY['view','add','edit','delete'],            54),
  ('services_master',           'masters',       'بيانات الخدمات',                'Services master',          ARRAY['view','add','edit','delete','import','export'], 55),
  ('spare_part_categories',     'masters',       'فئات قطع الغيار',               'Spare part categories',    ARRAY['view','add','edit','delete'],            56),
  ('spare_parts_master',        'masters',       'بيانات قطع الغيار',             'Spare parts master',       ARRAY['view','add','edit','delete','import','export'], 57),
  ('gas_types_master',          'masters',       'بيانات الغازات',                'Gas types master',         ARRAY['view','add','edit','delete'],            58),
  ('service_pricing',           'masters',       'تسعير الخدمات',                 'Service pricing',          ARRAY['view','add','edit','delete','import','export'], 59),
  ('contract_pricing',          'masters',       'تسعير العقود',                  'Contract pricing',         ARRAY['view','add','edit','delete','import','export'], 60),

  -- Reports
  ('reports_overview',          'reports',       'نظرة عامة على التقارير',        'Reports overview',         ARRAY['view'], 70),
  ('report_requests',           'reports',       'تقرير الطلبات',                 'Requests report',          ARRAY['view','export'], 71),
  ('report_jobs',               'reports',       'تقرير المهام',                  'Jobs report',              ARRAY['view','export'], 72),
  ('report_technician_performance','reports',    'أداء الفنيين',                  'Technician performance',   ARRAY['view','export'], 73),
  ('report_invoices',           'reports',       'تقرير الفواتير',                'Invoices report',          ARRAY['view','export'], 74),
  ('report_payments',           'reports',       'تقرير المدفوعات',               'Payments report',          ARRAY['view','export'], 75),
  ('report_services_used',      'reports',       'الخدمات المستخدمة',             'Services used',            ARRAY['view','export'], 76),
  ('report_parts_used',         'reports',       'القطع المستخدمة',               'Spare parts used',         ARRAY['view','export'], 77),
  ('report_contract_revenue',   'reports',       'إيرادات العقود',                'Contract revenue',         ARRAY['view','export'], 78),
  ('report_cash_revenue',       'reports',       'إيرادات الكاش',                 'Cash revenue',             ARRAY['view','export'], 79),
  ('report_coverage',           'reports',       'تقرير التغطية',                 'Coverage report',          ARRAY['view','export'], 80),

  -- Admin
  ('users',                     'admin',         'المستخدمون',                    'Users',                    ARRAY['view','add','edit','delete','approve'], 90),
  ('users_permissions',         'admin',         'صلاحيات المستخدمين',            'User permissions',         ARRAY['view','edit'], 91),
  ('roles_templates',           'admin',         'قوالب الصلاحيات',               'Permission templates',     ARRAY['view','add','edit','delete'], 92),
  ('contract_templates',        'admin',         'قوالب العقود',                  'Contract templates',       ARRAY['view','add','edit','delete'], 93),
  ('contract_clauses',          'admin',         'بنود العقد',                    'Contract clauses',         ARRAY['view','add','edit','delete'], 94),
  ('numbering_sequences',       'admin',         'تسلسل الأرقام',                  'Numbering sequences',      ARRAY['view','edit'], 95),
  ('company_settings',          'admin',         'إعدادات الشركة',                'Company settings',         ARRAY['view','edit'], 96),
  ('import_runs',               'admin',         'سجل الاستيراد',                 'Import runs',              ARRAY['view'], 97),
  ('audit_log',                 'admin',         'سجل التدقيق',                   'Audit log',                ARRAY['view'], 98),

  -- Communication
  ('chat',                      'communication', 'المحادثات',                     'Chat',                     ARRAY['view'], 100)
ON CONFLICT (code) DO UPDATE SET
  module          = EXCLUDED.module,
  label_ar        = EXCLUDED.label_ar,
  label_en        = EXCLUDED.label_en,
  default_actions = EXCLUDED.default_actions,
  display_order   = EXCLUDED.display_order,
  updated_at      = now();
