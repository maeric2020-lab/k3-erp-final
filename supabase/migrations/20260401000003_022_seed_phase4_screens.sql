-- =============================================================================
-- K3 ERP — Migration 022
-- Seed screens for Phase 4 modules: sales (quotations) and finance (invoices,
-- payments). Also adds the contract_clause_templates and compressor_brackets
-- admin screens.
-- =============================================================================

INSERT INTO public.screens (code, module, label_ar, label_en, default_actions, display_order) VALUES
  ('quotations',                'sales',       'عروض الأسعار',          'Quotations',           ARRAY['view','add','edit','delete','export'],          140),
  ('invoices',                  'finance',     'الفواتير',              'Invoices',             ARRAY['view','add','edit','delete','export'],          150),
  ('payments',                  'finance',     'المدفوعات',             'Payments',             ARRAY['view','add','edit','delete','export'],          151),
  ('contract_clause_templates', 'admin',       'قوالب بنود العقود',     'Contract clauses',     ARRAY['view','add','edit','delete'],                  98),
  ('compressor_brackets',       'admin',       'تسعير شريحة الكمبريسور', 'Compressor brackets',  ARRAY['view','add','edit','delete'],                  99)
ON CONFLICT (code) DO NOTHING;
