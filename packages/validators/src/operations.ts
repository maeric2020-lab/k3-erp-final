import { z } from 'zod';

const optionalText = (max = 255) =>
  z.string().trim().max(max).nullable().optional().or(z.literal('').transform(() => null));
const optionalPositive = z
  .union([z.number(), z.string().transform((s) => Number(s))])
  .transform((n) => (Number.isFinite(n) ? n : null))
  .nullable()
  .optional();
const requiredNonNeg = z
  .union([z.number(), z.string().transform((s) => Number(s))])
  .refine((n) => Number.isFinite(n) && n >= 0, { message: 'القيمة يجب أن تكون 0 أو أكبر' });

export const PROBLEM_CODES = [
  'no_cooling','weak_cooling','water_leak','gas_leak','compressor_issue',
  'fan_motor_issue','electrical_issue','sensor_issue','thermostat_issue',
  'noise','bad_smell','drainage_issue','other',
] as const;

export const REQUEST_TYPES = ['CASH','CO','CW','CWC','UG'] as const;
export const CONTRACT_TYPES = ['CO','CW','CWC','UG'] as const;
export const JOB_STATUSES = [
  'assigned','accepted','on_way','arrived','inspection_started',
  'work_started','report_pending','completed','invoiced','closed','cancelled',
] as const;

// -----------------------------------------------------------------------------
// Customer machine
// -----------------------------------------------------------------------------
export const customerMachineSchema = z.object({
  customer_id: z.string().uuid(),
  site_id: z.string().uuid().nullable().optional(),
  machine_master_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid(),
  brand_id: z.string().uuid().nullable().optional(),
  refrigerant_id: z.string().uuid().nullable().optional(),
  outdoor_model: optionalText(150),
  indoor_model: optionalText(150),
  capacity_hp: optionalPositive,
  capacity_tr: optionalPositive,
  btu_h: optionalPositive,
  serial_number: optionalText(150),
  installation_date: z.string().nullable().optional().or(z.literal('').transform(() => null)),
  notes: optionalText(2000),
  is_active: z.boolean().default(true),
});
export type CustomerMachineInput = z.infer<typeof customerMachineSchema>;

// -----------------------------------------------------------------------------
// Maintenance request
// -----------------------------------------------------------------------------
export const maintenanceRequestSchema = z.object({
  customer_id: z.string().uuid(),
  site_id: z.string().uuid().nullable().optional(),
  customer_machine_id: z.string().uuid().nullable().optional(),
  contract_id: z.string().uuid().nullable().optional(),
  request_type: z.enum(REQUEST_TYPES),
  problem_code: z.enum(PROBLEM_CODES),
  problem_description: optionalText(2000),
  reported_by: optionalText(150),
  reported_phone: optionalText(32),
  scheduled_date: z.string().nullable().optional().or(z.literal('').transform(() => null)),
  scheduled_time: z.string().nullable().optional().or(z.literal('').transform(() => null)),
  priority: z.enum(['low','normal','high','urgent']).default('normal'),
  notes: optionalText(2000),
}).superRefine((v, ctx) => {
  if (v.problem_code === 'other' && !v.problem_description) {
    ctx.addIssue({ code: 'custom', path: ['problem_description'], message: 'وصف المشكلة مطلوب عند اختيار "أخرى"' });
  }
  if (v.request_type !== 'CASH' && !v.contract_id) {
    ctx.addIssue({ code: 'custom', path: ['contract_id'], message: 'العقد مطلوب لأنواع الطلبات غير النقدية' });
  }
});
export type MaintenanceRequestInput = z.infer<typeof maintenanceRequestSchema>;

// -----------------------------------------------------------------------------
// Job (admin/dispatch creation)
// -----------------------------------------------------------------------------
export const jobCreateSchema = z.object({
  request_id: z.string().uuid(),
  technician_id: z.string().uuid().nullable().optional(),
});
export type JobCreateInput = z.infer<typeof jobCreateSchema>;

export const jobAssignTechSchema = z.object({
  technician_id: z.string().uuid(),
});
export type JobAssignTechInput = z.infer<typeof jobAssignTechSchema>;

// Status transitions are NOT user-pickable. The API exposes step-up endpoints
// each of which advances by exactly one step; the UI doesn't accept a status
// string from the technician.
export const jobStepSchema = z.object({
  step: z.enum(['accept','on_way','arrived','start_inspection','start_work','mark_complete','submit_signatures','cancel']),
  // Optional payloads per step
  arrived_lat: z.number().nullable().optional(),
  arrived_lng: z.number().nullable().optional(),
  inspection_notes: optionalText(2000),
  technician_notes: optionalText(2000),
  customer_signature_name: optionalText(150),
  customer_signature_path: optionalText(500),
  technician_signature_path: optionalText(500),
});
export type JobStepInput = z.infer<typeof jobStepSchema>;

// -----------------------------------------------------------------------------
// Document line — for line-picker submissions on a job
// -----------------------------------------------------------------------------
export const documentLineSchema = z.object({
  line_type: z.enum(['service','part','gas','contract_unit','custom']),
  service_id: z.string().uuid().nullable().optional(),
  part_id: z.string().uuid().nullable().optional(),
  gas_id: z.string().uuid().nullable().optional(),
  customer_machine_id: z.string().uuid().nullable().optional(),
  machine_master_id: z.string().uuid().nullable().optional(),
  description_ar: z.string().trim().min(1).max(500).optional(),
  description_en: optionalText(500),
  unit: optionalText(64),
  quantity: requiredNonNeg.refine((n) => n > 0, { message: 'الكمية يجب أن تكون أكبر من صفر' }),
  request_type: z.enum(['CASH','CO','CW','CWC','UG','COG','CWG','CWCG'] as const).nullable().optional(),
  notes: optionalText(1000),
  display_order: z.number().int().default(0),
}).superRefine((v, ctx) => {
  if (v.line_type === 'service' && !v.service_id)
    ctx.addIssue({ code: 'custom', path: ['service_id'], message: 'service_id required for service line' });
  if (v.line_type === 'part' && !v.part_id)
    ctx.addIssue({ code: 'custom', path: ['part_id'], message: 'part_id required for part line' });
  if (v.line_type === 'gas' && !v.gas_id)
    ctx.addIssue({ code: 'custom', path: ['gas_id'], message: 'gas_id required for gas line' });
  if (v.line_type === 'contract_unit' && !v.customer_machine_id)
    ctx.addIssue({ code: 'custom', path: ['customer_machine_id'], message: 'customer_machine_id required for contract_unit line' });
});
export type DocumentLineInput = z.infer<typeof documentLineSchema>;

// -----------------------------------------------------------------------------
// Contract (Phase 3 minimal — full wizard in Phase 4)
// -----------------------------------------------------------------------------
export const contractSchema = z.object({
  contract_no: z.string().trim().min(1).max(64),
  customer_id: z.string().uuid(),
  site_id: z.string().uuid().nullable().optional(),
  contract_type: z.enum(CONTRACT_TYPES),
  is_4_year: z.boolean().default(false),
  start_date: z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: 'تاريخ البدء غير صحيح' }),
  end_date: z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: 'تاريخ الانتهاء غير صحيح' }),
  status: z.enum(['draft','active','expired','cancelled','terminated']).default('draft'),
  notes: optionalText(4000),
}).superRefine((v, ctx) => {
  if (Date.parse(v.end_date) <= Date.parse(v.start_date)) {
    ctx.addIssue({ code: 'custom', path: ['end_date'], message: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء' });
  }
});
export type ContractInput = z.infer<typeof contractSchema>;

export const contractMachineSchema = z.object({
  contract_id: z.string().uuid(),
  customer_machine_id: z.string().uuid(),
  unit_price_at_signing: requiredNonNeg,
  notes: optionalText(500),
});
export type ContractMachineInput = z.infer<typeof contractMachineSchema>;
