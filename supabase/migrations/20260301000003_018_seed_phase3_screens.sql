-- =============================================================================
-- K3 ERP — Migration 018
-- Seed screens for Phase 3 modules: operations and contracts.
-- =============================================================================

INSERT INTO public.screens (code, module, label_ar, label_en, default_actions, display_order) VALUES
  ('maintenance_requests', 'operations',  'طلبات الصيانة',     'Maintenance requests', ARRAY['view','add','edit','delete','export'],          120),
  ('jobs',                 'operations',  'مهام الفنيين',      'Jobs',                  ARRAY['view','add','edit','delete','export'],          121),
  ('jobs_my',              'operations',  'مهامي',             'My jobs',                ARRAY['view'],                                          122),
  ('jobs_dispatch',        'operations',  'الإسناد',           'Dispatch board',         ARRAY['view','edit'],                                  123),
  ('customer_machines',    'customers',   'آلات العملاء',     'Customer machines',     ARRAY['view','add','edit','delete'],                   42),
  ('contracts',            'sales',       'العقود',            'Contracts',              ARRAY['view','add','edit','delete','export'],          130)
ON CONFLICT (code) DO NOTHING;
