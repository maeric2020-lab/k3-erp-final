/**
 * Phase 3 Database types.
 *
 * For production, regenerate from the live schema with:
 *   pnpm db:gen-types
 *
 * Hand-crafted types covering all tables through Phase 3.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// -- Phase 1 row types --
type UsersProfileRow = {
  id: string;
  full_name_ar: string | null; full_name_en: string | null;
  phone: string | null; email: string;
  is_active: boolean; is_archived: boolean; is_super_admin: boolean;
  technician_id: string | null;
  technician_code: string | null;
  language_pref: 'ar' | 'en';
  created_at: string; updated_at: string;
  created_by: string | null; updated_by: string | null;
};

type ScreenRow = {
  code: string; module: string; label_ar: string; label_en: string;
  default_actions: string[]; display_order: number; is_active: boolean;
  created_at: string; updated_at: string;
};

type UserScreenPermissionRow = {
  id: string; user_id: string; screen_code: string; action: string; granted: boolean;
  created_at: string; updated_at: string;
  created_by: string | null; updated_by: string | null;
};

type CompanySettingsRow = {
  id: number;
  legal_name_ar: string | null; legal_name_en: string | null; short_name: string | null;
  logo_path: string | null; letterhead_path: string | null;
  address_ar: string | null; address_en: string | null;
  phone_primary: string | null; phone_secondary: string | null;
  email: string | null; website: string | null;
  civil_id_no: string | null; commercial_reg_no: string | null; tax_no: string | null;
  default_currency: string; currency_decimals: number; default_language: 'ar' | 'en';
  allow_other_problem: boolean; allow_off_catalog_machine: boolean;
  created_at: string; updated_at: string; updated_by: string | null;
};

type NumberingSequenceRow = {
  id: string; prefix: string; year_resets: boolean;
  current_year: number; current_value: number; pad_width: number;
  separator: string; format_template: string | null; description: string | null; updated_at: string;
};

type AuditLogRow = {
  id: string; user_id: string | null; action: string;
  entity_type: string; entity_id: string | null;
  before_data: Json | null; after_data: Json | null;
  ip_address: string | null; user_agent: string | null; created_at: string;
};

// -- Phase 2 row types --
type CustomerRow = {
  id: string; code: string; name_ar: string; name_en: string | null;
  customer_type: 'individual' | 'company' | 'government';
  civil_id: string | null; email: string | null;
  phone_primary: string | null; phone_secondary: string | null;
  notes: string | null; is_active: boolean;
  created_at: string; updated_at: string;
  created_by: string | null; updated_by: string | null;
};
type CustomerSiteRow = {
  id: string; customer_id: string; site_name: string | null;
  governorate: string | null; area: string | null; block: string | null;
  street: string | null; avenue: string | null; building: string | null;
  full_address: string | null; latitude: number | null; longitude: number | null;
  is_primary: boolean; is_active: boolean;
  created_at: string; updated_at: string;
  created_by: string | null; updated_by: string | null;
};
type MachineCategoryRow = {
  id: string; code: string; name_ar: string; name_en: string;
  display_order: number; is_active: boolean;
  created_at: string; updated_at: string;
  created_by: string | null; updated_by: string | null;
};
type MachineBrandRow = {
  id: string; name: string; country_origin: string | null; is_active: boolean;
  created_at: string; updated_at: string;
  created_by: string | null; updated_by: string | null;
};
type RefrigerantTypeRow = {
  id: string; code: string; name: string; is_active: boolean;
  created_at: string; updated_at: string;
};
type MachinesMasterRow = {
  id: string; category_id: string; brand_id: string | null; refrigerant_id: string | null;
  outdoor_model: string | null; indoor_model: string | null;
  capacity_hp: number | null; capacity_tr: number | null;
  btu_h: number | null; cfm: number | null; kw: number | null;
  country_origin: string | null; notes: string | null; is_active: boolean;
  created_at: string; updated_at: string;
  created_by: string | null; updated_by: string | null;
};
type ServiceCategoryRow = {
  id: string; code: string; name_ar: string; name_en: string;
  display_order: number; is_active: boolean;
  created_at: string; updated_at: string;
  created_by: string | null; updated_by: string | null;
};
type ServiceTypeRow = {
  id: string; category_id: string; code: string; name_ar: string; name_en: string;
  display_order: number; is_active: boolean;
  created_at: string; updated_at: string;
  created_by: string | null; updated_by: string | null;
};
type SparePartCategoryRow = {
  id: string; code: string; name_ar: string; name_en: string;
  display_order: number; is_active: boolean;
  created_at: string; updated_at: string;
  created_by: string | null; updated_by: string | null;
};
type ServicesMasterRow = {
  id: string; service_code: string; service_type_id: string;
  name_ar: string; name_en: string; technical_code: string | null;
  unit: 'service' | 'piece' | 'meter' | 'kg' | 'hour' | 'set';
  capacity_hp: number | null; requires_part: boolean;
  default_part_category_id: string | null; notes: string | null; is_active: boolean;
  created_at: string; updated_at: string;
  created_by: string | null; updated_by: string | null;
};
type SparePartsMasterRow = {
  id: string; part_code: string; category_id: string; part_type: string | null;
  name_ar: string; name_en: string; brand_id: string | null;
  model: string | null; manufacturer: string | null; country_origin: string | null;
  compatible_categories: string[];
  unit: 'piece' | 'meter' | 'kg' | 'set' | 'liter';
  cost_price: number; selling_price: number; notes: string | null; is_active: boolean;
  created_at: string; updated_at: string;
  created_by: string | null; updated_by: string | null;
};
type GasTypesMasterRow = {
  id: string; refrigerant_id: string; unit: 'kg';
  cost_price_per_kg: number; selling_price_per_kg: number;
  notes: string | null; is_active: boolean;
  created_at: string; updated_at: string;
  created_by: string | null; updated_by: string | null;
};
type ServicePricingRow = {
  id: string; service_id: string; machine_category_id: string | null;
  cost_price: number; cash_price: number; co_price: number; cw_price: number;
  cwc_price: number; ug_price: number;
  cash_covered: boolean; co_covered: boolean; cw_covered: boolean;
  cwc_covered: boolean; ug_covered: boolean;
  notes: string | null; is_active: boolean;
  created_at: string; updated_at: string;
  created_by: string | null; updated_by: string | null;
};
type ContractPricingRow = {
  id: string; machine_category_id: string;
  brand_id: string | null; refrigerant_id: string | null;
  outdoor_model: string | null; indoor_model: string | null;
  capacity_hp: number | null; capacity_tr: number | null;
  btu_h: number | null; cfm: number | null; kw: number | null;
  co_unit_price: number; cw_unit_price: number; cwc_unit_price: number;
  cog_unit_price: number; cwg_unit_price: number; cwcg_unit_price: number;
  notes: string | null; is_active: boolean;
  created_at: string; updated_at: string;
  created_by: string | null; updated_by: string | null;
};
type ImportRunRow = {
  id: string; template_type: string; uploaded_by: string | null;
  source_filename: string | null; source_path: string | null;
  total_rows: number; inserted_rows: number; updated_rows: number;
  skipped_rows: number; failed_rows: number;
  status: 'previewing' | 'committed' | 'failed' | 'cancelled';
  error_message: string | null; started_at: string; finished_at: string | null;
};
type ImportRunRowRow = {
  id: string; run_id: string; row_number: number;
  raw_data: Json; resolved_data: Json | null; validation_errors: Json;
  action: 'pending' | 'insert' | 'update' | 'skip' | 'error';
  target_id: string | null; target_table: string | null; created_at: string;
};

// -- Phase 3 row types --
export type RequestType = 'CASH' | 'CO' | 'CW' | 'CWC' | 'UG';
export type ContractType = 'CO' | 'CW' | 'CWC' | 'UG';
export type ProblemCode =
  | 'no_cooling' | 'weak_cooling' | 'water_leak' | 'gas_leak'
  | 'compressor_issue' | 'fan_motor_issue' | 'electrical_issue'
  | 'sensor_issue' | 'thermostat_issue' | 'noise' | 'bad_smell'
  | 'drainage_issue' | 'other';
export type JobStatus =
  | 'assigned' | 'accepted' | 'on_way' | 'arrived' | 'inspection_started'
  | 'work_started' | 'report_pending' | 'completed' | 'invoiced' | 'closed' | 'cancelled';
export type LineType = 'service' | 'part' | 'gas' | 'contract_unit' | 'custom';

type CustomerMachineRow = {
  id: string;
  customer_id: string;
  site_id: string | null;
  machine_master_id: string | null;
  category_id: string;
  brand_id: string | null;
  refrigerant_id: string | null;
  outdoor_model: string | null;
  indoor_model: string | null;
  capacity_hp: number | null;
  capacity_tr: number | null;
  btu_h: number | null;
  serial_number: string | null;
  installation_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type ContractRow = {
  id: string;
  contract_no: string;
  customer_id: string;
  site_id: string | null;
  contract_type: ContractType;
  is_4_year: boolean;
  start_date: string;
  end_date: string;
  status: 'draft' | 'active' | 'expired' | 'cancelled' | 'terminated';
  total_amount: number;
  notes: string | null;
  letterhead_path: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type ContractMachineRow = {
  id: string;
  contract_id: string;
  customer_machine_id: string;
  unit_price_at_signing: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type MaintenanceRequestRow = {
  id: string;
  request_no: string;
  customer_id: string;
  site_id: string | null;
  customer_machine_id: string | null;
  contract_id: string | null;
  request_type: RequestType;
  problem_code: ProblemCode;
  problem_description: string | null;
  reported_by: string | null;
  reported_phone: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'closed' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type JobRow = {
  id: string;
  job_no: string;
  request_id: string;
  customer_id: string;
  site_id: string | null;
  customer_machine_id: string | null;
  contract_id: string | null;
  request_type: RequestType;
  technician_id: string | null;
  status: JobStatus;
  assigned_at: string | null;
  accepted_at: string | null;
  on_way_at: string | null;
  arrived_at: string | null;
  inspection_started_at: string | null;
  work_started_at: string | null;
  report_pending_at: string | null;
  completed_at: string | null;
  invoiced_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  arrived_lat: number | null;
  arrived_lng: number | null;
  technician_signature_path: string | null;
  customer_signature_path: string | null;
  customer_signature_name: string | null;
  technician_notes: string | null;
  inspection_notes: string | null;
  total_amount: number;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type DocumentLineRow = {
  id: string;
  job_id: string | null;
  quotation_id: string | null;
  invoice_id: string | null;
  contract_id: string | null;
  line_type: LineType;
  service_id: string | null;
  part_id: string | null;
  gas_id: string | null;
  customer_machine_id: string | null;
  machine_master_id: string | null;
  description_ar: string;
  description_en: string | null;
  unit: string;
  quantity: number;
  request_type: RequestType | null;
  unit_price: number;
  cost_price: number;
  is_covered: boolean;
  line_total: number;
  pricing_source: string | null;
  pricing_computed_at: string | null;
  notes: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

// -- Phase 4 row types --
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
export type InvoiceStatus = 'issued' | 'partial' | 'paid' | 'cancelled' | 'void';
export type PaymentMethod = 'cash' | 'knet' | 'transfer' | 'cheque' | 'card' | 'other';

type ContractClauseTemplateRow = {
  id: string;
  code: string;
  display_order: number;
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
  applies_to: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type ContractClauseRow = {
  id: string;
  contract_id: string;
  template_id: string | null;
  code: string;
  display_order: number;
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
  created_at: string;
  updated_at: string;
};

type QuotationRow = {
  id: string;
  quotation_no: string;
  customer_id: string;
  site_id: string | null;
  request_type: RequestType;
  status: QuotationStatus;
  issue_date: string;
  valid_until: string | null;
  subtotal: number;
  discount: number;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type InvoiceRow = {
  id: string;
  invoice_no: string;
  customer_id: string;
  site_id: string | null;
  job_id: string | null;
  contract_id: string | null;
  request_type: RequestType | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  discount: number;
  total_amount: number;
  amount_paid: number;
  balance: number;
  is_zero_charge: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type PaymentRow = {
  id: string;
  payment_no: string;
  invoice_id: string;
  customer_id: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  payment_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type CompressorBracketRow = {
  id: string;
  hp_min: number;
  hp_max: number;
  base_price: number;
  k3_supplied_surcharge_pct: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export interface Database {
  public: {
    Tables: {
      // Phase 1
      users_profile: { Row: UsersProfileRow; Insert: Partial<UsersProfileRow> & { id: string; email: string }; Update: Partial<UsersProfileRow> };
      screens: { Row: ScreenRow; Insert: Partial<ScreenRow> & { code: string; module: string; label_ar: string; label_en: string }; Update: Partial<ScreenRow> };
      user_screen_permissions: { Row: UserScreenPermissionRow; Insert: Partial<UserScreenPermissionRow> & { user_id: string; screen_code: string; action: string }; Update: Partial<UserScreenPermissionRow> };
      permission_templates: {
        Row: { id: string; name: string; description: string | null; is_active: boolean; created_at: string; updated_at: string; created_by: string | null; updated_by: string | null };
        Insert: { id?: string; name: string; description?: string | null; is_active?: boolean; created_by?: string | null; updated_by?: string | null };
        Update: { name?: string; description?: string | null; is_active?: boolean; updated_by?: string | null };
      };
      permission_template_items: {
        Row: { id: string; template_id: string; screen_code: string; action: string; granted: boolean };
        Insert: { id?: string; template_id: string; screen_code: string; action: string; granted?: boolean };
        Update: { granted?: boolean };
      };
      company_settings: { Row: CompanySettingsRow; Insert: Partial<CompanySettingsRow>; Update: Partial<CompanySettingsRow> };
      numbering_sequences: { Row: NumberingSequenceRow; Insert: Partial<NumberingSequenceRow> & { id: string; prefix: string }; Update: Partial<NumberingSequenceRow> };
      audit_log: { Row: AuditLogRow; Insert: Partial<AuditLogRow> & { action: string; entity_type: string }; Update: Partial<AuditLogRow> };

      // Phase 2
      customers: { Row: CustomerRow; Insert: Partial<CustomerRow> & { name_ar: string }; Update: Partial<CustomerRow> };
      customer_sites: { Row: CustomerSiteRow; Insert: Partial<CustomerSiteRow> & { customer_id: string }; Update: Partial<CustomerSiteRow> };
      machine_categories: { Row: MachineCategoryRow; Insert: Partial<MachineCategoryRow> & { code: string; name_ar: string; name_en: string }; Update: Partial<MachineCategoryRow> };
      machine_brands: { Row: MachineBrandRow; Insert: Partial<MachineBrandRow> & { name: string }; Update: Partial<MachineBrandRow> };
      refrigerant_types: { Row: RefrigerantTypeRow; Insert: Partial<RefrigerantTypeRow> & { code: string; name: string }; Update: Partial<RefrigerantTypeRow> };
      machines_master: { Row: MachinesMasterRow; Insert: Partial<MachinesMasterRow> & { category_id: string }; Update: Partial<MachinesMasterRow> };
      service_categories: { Row: ServiceCategoryRow; Insert: Partial<ServiceCategoryRow> & { code: string; name_ar: string; name_en: string }; Update: Partial<ServiceCategoryRow> };
      service_types: { Row: ServiceTypeRow; Insert: Partial<ServiceTypeRow> & { category_id: string; code: string; name_ar: string; name_en: string }; Update: Partial<ServiceTypeRow> };
      spare_part_categories: { Row: SparePartCategoryRow; Insert: Partial<SparePartCategoryRow> & { code: string; name_ar: string; name_en: string }; Update: Partial<SparePartCategoryRow> };
      services_master: { Row: ServicesMasterRow; Insert: Partial<ServicesMasterRow> & { service_type_id: string; name_ar: string; name_en: string }; Update: Partial<ServicesMasterRow> };
      spare_parts_master: { Row: SparePartsMasterRow; Insert: Partial<SparePartsMasterRow> & { category_id: string; name_ar: string; name_en: string }; Update: Partial<SparePartsMasterRow> };
      gas_types_master: { Row: GasTypesMasterRow; Insert: Partial<GasTypesMasterRow> & { refrigerant_id: string }; Update: Partial<GasTypesMasterRow> };
      service_pricing: { Row: ServicePricingRow; Insert: Partial<ServicePricingRow> & { service_id: string }; Update: Partial<ServicePricingRow> };
      contract_pricing: { Row: ContractPricingRow; Insert: Partial<ContractPricingRow> & { machine_category_id: string }; Update: Partial<ContractPricingRow> };
      import_runs: { Row: ImportRunRow; Insert: Partial<ImportRunRow> & { template_type: string }; Update: Partial<ImportRunRow> };
      import_run_rows: { Row: ImportRunRowRow; Insert: Partial<ImportRunRowRow> & { run_id: string; row_number: number; raw_data: Json }; Update: Partial<ImportRunRowRow> };

      // Phase 3
      customer_machines: { Row: CustomerMachineRow; Insert: Partial<CustomerMachineRow> & { customer_id: string; category_id: string }; Update: Partial<CustomerMachineRow> };
      contracts: { Row: ContractRow; Insert: Partial<ContractRow> & { contract_no: string; customer_id: string; contract_type: ContractType; start_date: string; end_date: string }; Update: Partial<ContractRow> };
      contract_machines: { Row: ContractMachineRow; Insert: Partial<ContractMachineRow> & { contract_id: string; customer_machine_id: string }; Update: Partial<ContractMachineRow> };
      maintenance_requests: { Row: MaintenanceRequestRow; Insert: Partial<MaintenanceRequestRow> & { customer_id: string; request_type: RequestType; problem_code: ProblemCode }; Update: Partial<MaintenanceRequestRow> };
      jobs: { Row: JobRow; Insert: Partial<JobRow> & { request_id: string; customer_id: string; request_type: RequestType }; Update: Partial<JobRow> };
      document_lines: { Row: DocumentLineRow; Insert: Partial<DocumentLineRow> & { line_type: LineType; description_ar: string; unit: string }; Update: Partial<DocumentLineRow> };

      // Phase 4
      contract_clause_templates: { Row: ContractClauseTemplateRow; Insert: Partial<ContractClauseTemplateRow> & { code: string; title_ar: string; title_en: string; body_ar: string; body_en: string }; Update: Partial<ContractClauseTemplateRow> };
      contract_clauses: { Row: ContractClauseRow; Insert: Partial<ContractClauseRow> & { contract_id: string; code: string; title_ar: string; title_en: string; body_ar: string; body_en: string }; Update: Partial<ContractClauseRow> };
      quotations: { Row: QuotationRow; Insert: Partial<QuotationRow> & { customer_id: string }; Update: Partial<QuotationRow> };
      invoices: { Row: InvoiceRow; Insert: Partial<InvoiceRow> & { customer_id: string }; Update: Partial<InvoiceRow> };
      payments: { Row: PaymentRow; Insert: Partial<PaymentRow> & { invoice_id: string; customer_id: string; amount: number; method: PaymentMethod }; Update: Partial<PaymentRow> };
      compressor_install_brackets: { Row: CompressorBracketRow; Insert: Partial<CompressorBracketRow> & { hp_min: number; hp_max: number; base_price: number }; Update: Partial<CompressorBracketRow> };

      // Phase 6c — chat
      chat_threads: {
        Row: { id: string; name: string | null; is_group: boolean; created_at: string; updated_at: string; created_by: string | null; last_message_at: string | null };
        Insert: { id?: string; name?: string | null; is_group?: boolean; created_by?: string | null; last_message_at?: string | null };
        Update: { name?: string | null; is_group?: boolean; last_message_at?: string | null };
      };
      chat_thread_members: {
        Row: { id: string; thread_id: string; user_id: string; joined_at: string; last_read_at: string | null; is_muted: boolean };
        Insert: { id?: string; thread_id: string; user_id: string; last_read_at?: string | null; is_muted?: boolean };
        Update: { last_read_at?: string | null; is_muted?: boolean };
      };
      chat_messages: {
        Row: { id: string; thread_id: string; sender_id: string; body: string | null; attachments: Array<{ name: string; mime: string; size: number; storage_path: string }>; is_deleted: boolean; created_at: string; edited_at: string | null };
        Insert: { id?: string; thread_id: string; sender_id: string; body?: string | null; attachments?: any; is_deleted?: boolean };
        Update: { body?: string | null; attachments?: any; is_deleted?: boolean; edited_at?: string | null };
      };
      // -- Phase 8c: multi-tenancy + notifications + queue --
      companies: {
        Row: { id: string; code: string; name_ar: string; name_en: string; cr_number: string | null; tax_number: string | null; is_active: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; code: string; name_ar: string; name_en: string; cr_number?: string | null; tax_number?: string | null; is_active?: boolean };
        Update: { code?: string; name_ar?: string; name_en?: string; cr_number?: string | null; tax_number?: string | null; is_active?: boolean };
      };
      notifications: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          type: 'job_assigned' | 'job_status_changed' | 'request_created' | 'invoice_overdue' | 'payment_received' | 'contract_expiring' | 'mention' | 'system';
          title_ar: string;
          title_en: string;
          body_ar: string | null;
          body_en: string | null;
          entity_type: string | null;
          entity_id: string | null;
          action_url: string | null;
          read_at: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string;
          user_id: string;
          type: 'job_assigned' | 'job_status_changed' | 'request_created' | 'invoice_overdue' | 'payment_received' | 'contract_expiring' | 'mention' | 'system';
          title_ar: string;
          title_en: string;
          body_ar?: string | null;
          body_en?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          action_url?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: { read_at?: string | null };
      };
      notification_preferences: {
        Row: {
          user_id: string;
          email_enabled: boolean;
          push_enabled: boolean;
          push_subscription: any;
          enabled_types: string[];
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email_enabled?: boolean;
          push_enabled?: boolean;
          push_subscription?: any;
          enabled_types?: string[];
        };
        Update: {
          email_enabled?: boolean;
          push_enabled?: boolean;
          push_subscription?: any;
          enabled_types?: string[];
        };
      };
      job_queue: {
        Row: {
          id: string;
          company_id: string | null;
          task_type: string;
          payload: Record<string, unknown>;
          priority: number;
          scheduled_for: string;
          status: 'pending' | 'running' | 'done' | 'failed';
          attempts: number;
          max_attempts: number;
          locked_by: string | null;
          locked_until: string | null;
          last_error: string | null;
          result: Record<string, unknown> | null;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: { id?: string; task_type: string; payload?: Record<string, unknown>; priority?: number; scheduled_for?: string; max_attempts?: number };
        Update: { status?: 'pending' | 'running' | 'done' | 'failed'; result?: Record<string, unknown> | null; last_error?: string | null };
      };
    };
    Views: Record<string, never>;
    Functions: {
      bootstrap_admin: { Args: { p_email: string; p_full_name_ar: string; p_full_name_en?: string | null }; Returns: string };
      fn_has_screen_permission: { Args: { p_screen_code: string; p_action: string }; Returns: boolean };
      fn_is_super_admin: { Args: Record<string, never>; Returns: boolean };
      fn_is_active_user: { Args: Record<string, never>; Returns: boolean };
      fn_next_doc_no: { Args: { p_sequence_id: string }; Returns: string };
      compute_line_pricing: {
        Args: {
          p_line_type: LineType;
          p_service_id: string | null;
          p_part_id: string | null;
          p_gas_id: string | null;
          p_customer_machine_id: string | null;
          p_machine_master_id: string | null;
          p_request_type: string | null;
          p_quantity?: number;
        };
        Returns: Array<{
          unit_price: number;
          cost_price: number;
          is_covered: boolean;
          pricing_source: string;
          description_ar: string;
          description_en: string;
          unit: string;
        }>;
      };
      fn_generate_invoice_for_job: { Args: { p_job_id: string }; Returns: string };
      fn_compressor_bracket_price: {
        Args: { p_hp: number; p_k3_supplied?: boolean };
        Returns: Array<{ bracket_id: string; base_price: number; surcharge_pct: number; total_price: number }>;
      };
      fn_apply_template_to_user: {
        Args: { p_user_id: string; p_template_id: string; p_replace?: boolean };
        Returns: number;
      };
      fn_user_permission_grid: {
        Args: { p_user_id: string };
        Returns: Array<{
          screen_code: string;
          module: string;
          label_ar: string;
          label_en: string;
          display_order: number;
          action: string;
          granted: boolean;
        }>;
      };
      fn_set_user_active: {
        Args: { p_user_id: string; p_active: boolean };
        Returns: void;
      };
      fn_dashboard_today_jobs: {
        Args: Record<string, never>;
        Returns: Array<{
          total: number;
          in_field: number;
          working: number;
          completed_today: number;
          pending_assignment: number;
        }>;
      };
      fn_dashboard_open_requests: {
        Args: Record<string, never>;
        Returns: Array<{
          total: number;
          emergency: number;
          high: number;
          normal: number;
          low: number;
        }>;
      };
      fn_dashboard_overdue_invoices: {
        Args: Record<string, never>;
        Returns: Array<{
          count_overdue: number;
          count_due_soon: number;
          total_outstanding: number;
          total_overdue: number;
        }>;
      };
      fn_dashboard_revenue_mtd: {
        Args: Record<string, never>;
        Returns: Array<{
          mtd_total: number;
          prev_month_total: number;
          invoice_count: number;
          daily_series: Array<{ date: string; amount: number }>;
        }>;
      };
      fn_report_sales: {
        Args: { p_from_date: string; p_to_date: string };
        Returns: Array<{
          day: string;
          invoice_count: number;
          invoiced_total: number;
          paid_total: number;
          outstanding_total: number;
        }>;
      };
      fn_report_payment_aging: {
        Args: Record<string, never>;
        Returns: Array<{
          customer_id: string;
          customer_name: string;
          current_total: number;
          d1_30: number;
          d31_60: number;
          d61_90: number;
          d90_plus: number;
          total_outstanding: number;
        }>;
      };
      fn_report_technician_perf: {
        Args: { p_from_date: string; p_to_date: string };
        Returns: Array<{
          technician_id: string;
          technician_name: string;
          technician_code: string | null;
          jobs_completed: number;
          jobs_cancelled: number;
          avg_minutes_arrival_to_complete: number | null;
          total_invoiced: number;
        }>;
      };
      fn_report_jobs_by_tech: {
        Args: Record<string, never>;
        Returns: Array<{
          technician_id: string;
          technician_name: string;
          status: string;
          count: number;
        }>;
      };
      fn_report_parts_consumption: {
        Args: { p_from_date: string; p_to_date: string };
        Returns: Array<{
          part_id: string;
          part_code: string;
          part_name_ar: string;
          part_name_en: string;
          total_quantity: number;
          total_value: number;
          job_count: number;
        }>;
      };
      fn_report_gas_consumption: {
        Args: { p_from_date: string; p_to_date: string };
        Returns: Array<{
          gas_id: string;
          gas_name: string;
          total_quantity: number;
          total_value: number;
          job_count: number;
        }>;
      };
      fn_report_customer_balances: {
        Args: Record<string, never>;
        Returns: Array<{
          customer_id: string;
          customer_code: string;
          customer_name_ar: string;
          customer_name_en: string | null;
          total_invoiced: number;
          total_paid: number;
          total_outstanding: number;
          invoice_count: number;
        }>;
      };
      fn_report_active_contracts: {
        Args: Record<string, never>;
        Returns: Array<{
          contract_id: string;
          contract_no: string;
          contract_type: string;
          is_4_year: boolean;
          customer_name: string;
          start_date: string;
          end_date: string;
          days_remaining: number;
          total_amount: number;
          machine_count: number;
        }>;
      };
      fn_chat_create_or_get_dm: { Args: { p_other_user_id: string }; Returns: string };
      fn_chat_thread_summary: {
        Args: Record<string, never>;
        Returns: Array<{
          thread_id: string;
          is_group: boolean;
          name: string | null;
          last_message_at: string | null;
          last_message_preview: string | null;
          last_sender_id: string | null;
          unread_count: number;
          other_user_id: string | null;
          other_user_name: string | null;
          member_count: number;
        }>;
      };
      // -- Phase 8c --
      fn_current_company_id: { Args: Record<string, never>; Returns: string };
      fn_notify: {
        Args: {
          p_user_id: string;
          p_type: string;
          p_title_ar: string;
          p_title_en: string;
          p_body_ar?: string | null;
          p_body_en?: string | null;
          p_entity_type?: string | null;
          p_entity_id?: string | null;
          p_action_url?: string | null;
          p_metadata?: Record<string, unknown>;
        };
        Returns: string;
      };
      fn_mark_all_notifications_read: { Args: Record<string, never>; Returns: number };
      fn_enqueue: {
        Args: {
          p_task_type: string;
          p_payload?: Record<string, unknown>;
          p_priority?: number;
          p_scheduled_for?: string;
          p_max_attempts?: number;
        };
        Returns: string;
      };
      fn_dequeue: {
        Args: { p_worker_id: string; p_lock_for_ms?: number };
        Returns: Array<{ id: string; task_type: string; payload: Record<string, unknown>; attempts: number }>;
      };
      fn_complete_job: { Args: { p_job_id: string; p_result?: Record<string, unknown> | null }; Returns: void };
      fn_fail_job: { Args: { p_job_id: string; p_error_msg: string }; Returns: void };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
