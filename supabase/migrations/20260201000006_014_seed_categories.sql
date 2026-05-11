-- =============================================================================
-- K3 ERP — Migration 014
-- Seed common machine categories and service categories so the Excel import
-- has stable foreign keys to resolve against.
-- =============================================================================

-- Machine categories — codes match what appears in the contract pricing Excel
INSERT INTO public.machine_categories (code, name_ar, name_en, display_order) VALUES
  ('SPLT',    'سبليت',                'Split AC',           10),
  ('PKG',     'باكج',                 'Package AC',         20),
  ('VRV',     'في آر في',            'VRV / VRF',          30),
  ('CHILLER', 'تشيللر',              'Chiller',            40),
  ('FCU',     'فان كويل',            'Fan Coil Unit',      50),
  ('AHU',     'وحدة مناولة هواء',   'Air Handling Unit',  60),
  ('WINDOW',  'شباك',                'Window AC',          70),
  ('CASSETTE','كاسيت',               'Cassette AC',        80),
  ('DUCTED',  'دكتد',                 'Ducted AC',          90),
  ('OTHER',   'أخرى',                'Other',             999)
ON CONFLICT (code) DO NOTHING;

-- Service categories  — only the one we know about so far
INSERT INTO public.service_categories (code, name_ar, name_en, display_order) VALUES
  ('MAINT_SVC', 'خدمات الصيانة', 'Maintenance services', 10)
ON CONFLICT (code) DO NOTHING;

-- Spare part categories — common HVAC part groupings
INSERT INTO public.spare_part_categories (code, name_ar, name_en, display_order) VALUES
  ('COMPRESSOR',  'كمبريسور',         'Compressor',          10),
  ('MOTOR',       'موتور',            'Motor',               20),
  ('CAPACITOR',   'مكثف',             'Capacitor',           30),
  ('CONTACTOR',   'كونتاكتور',        'Contactor',           40),
  ('PCB',         'لوحة كنترول',     'PCB / Control Board', 50),
  ('SENSOR',      'حساس',             'Sensor',              60),
  ('THERMOSTAT',  'ثرموستات',        'Thermostat',          70),
  ('FILTER',      'فلتر',             'Filter',              80),
  ('BELT',        'سير',              'V-Belt',              90),
  ('FAN_BLADE',   'ريشة مروحة',     'Fan Blade',          100),
  ('VALVE',       'صمام',            'Valve',              110),
  ('SWITCH',      'مفتاح',           'Switch',             120),
  ('PIPE',        'بايب',            'Pipe / Tubing',      130),
  ('OTHER',       'أخرى',            'Other',              999)
ON CONFLICT (code) DO NOTHING;

-- Service types — populated from the "Service Type" column in your services Excel
-- These keys appear in the source data: General Servieces, water pressure servieces,
-- chemical pressure servieces, condenser motor Replacing, Blower motor Replacing, etc.
-- We pre-create the most common ones so the import resolves them; new types
-- discovered during import will be auto-created.
INSERT INTO public.service_types (category_id, code, name_ar, name_en, display_order)
SELECT sc.id, t.code, t.name_ar, t.name_en, t.display_order
FROM public.service_categories sc
CROSS JOIN (VALUES
  ('GENERAL_INSPECTION',  'فحص عام',                          'General inspection',           10),
  ('WATER_PRESSURE',       'غسيل بمضخة المياه',              'Water pressure service',        20),
  ('CHEMICAL_PRESSURE',    'غسيل بكيميكال',                  'Chemical pressure service',     30),
  ('CONDENSER_MOTOR_REPL', 'استبدال موتور كوندنسر',         'Condenser motor replacing',     40),
  ('BLOWER_MOTOR_REPL',    'استبدال موتور بلاور',           'Blower motor replacing',        50),
  ('FAN_BLADE_REPL',       'استبدال ريشة مروحة',            'Fan blade replacing',           60),
  ('CAPACITOR_REPL',       'استبدال مكثف',                   'Capacitor / contactor replacing', 70),
  ('TRANSFORMER_REPL',     'استبدال محول كهرباء',           'Transformer replacing',         80),
  ('PCB_REPL',             'استبدال لوحة كنترول',           'PCB replacing',                 90),
  ('SENSOR_REPL',          'استبدال حساس',                  'Sensor replacing',             100),
  ('RELAY_REPL',           'استبدال ريلاي',                 'Relay replacing',              110),
  ('CIRCUIT_BREAKER_REPL', 'استبدال قاطع تحكم',             'Circuit breaker replacing',    120),
  ('THERMOSTAT_REPL',      'استبدال ثرموستات',              'Thermostat replacing',         130),
  ('FILTER_DRIER_REPL',    'استبدال فلتر غاز',              'Filter drier replacing',       140),
  ('LEAK_REPAIR',          'إصلاح تهريب غاز',               'Gas leak repair',              150),
  ('HP_LP_REPL',           'استبدال مفتاح ضغط',             'HP/LP switch replacing',       160),
  ('OVERLOAD_REPL',        'استبدال قاطع وقاية',            'Overload replacing',           170),
  ('DRAIN_TRAY_REPL',      'استبدال حوض صرف',               'Drain tray replacing',         180),
  ('BLOWER_REPAIR',        'إصلاح بلاور',                    'Blower repairing',             190),
  ('EXPANSION_VALVE',      'استبدال صمام التمدد',           'Expansion valve replacing',    200),
  ('DISTRIBUTOR',          'استبدال موزع',                   'Distributor replacing',        210),
  ('BELT_REPL',            'استبدال سير',                    'Belt replacing',               220),
  ('AIR_FILTER_REPL',      'استبدال فلتر هواء',             'Air filter replacing',         230),
  ('FUSE_REPL',             'استبدال فيوز',                  'Fuse replacing',               240),
  ('BEARING_REPL',         'استبدال رولمان بلي',            'Motor bearing replacing',      250),
  ('USED_COMPRESSOR_REPL', 'استبدال كمبريسور مستعمل',      'Used compressor replacing',    260),
  ('NEW_COMPRESSOR_REPL',  'استبدال كمبريسور جديد',        'New compressor replacing',     270),
  ('GAS_CHARGING',         'تعبئة غاز',                       'Gas charging',                 280),
  ('OTHER',                'أخرى',                           'Other',                        999)
) AS t(code, name_ar, name_en, display_order)
WHERE sc.code = 'MAINT_SVC'
ON CONFLICT (code) DO NOTHING;

-- Common HVAC brands (extend via UI as needed)
INSERT INTO public.machine_brands (name) VALUES
  ('Coolex'), ('Carrier'), ('York'), ('Trane'), ('Daikin'),
  ('LG'), ('Samsung'), ('Mitsubishi'), ('Hitachi'), ('Gree'),
  ('Midea'), ('Other')
ON CONFLICT (name) DO NOTHING;

-- Seed gas pricing rows (zeros — Admin sets prices via UI or import)
INSERT INTO public.gas_types_master (refrigerant_id, cost_price_per_kg, selling_price_per_kg)
SELECT id, 0, 0 FROM public.refrigerant_types
WHERE NOT EXISTS (SELECT 1 FROM public.gas_types_master g WHERE g.refrigerant_id = refrigerant_types.id);
