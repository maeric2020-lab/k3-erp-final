import { z } from 'zod';

const optionalText = (max = 255) =>
  z.string().trim().max(max).nullable().optional().or(z.literal('').transform(() => null));
const optionalPositive = z.union([z.number(), z.string().transform((s) => Number(s))])
  .transform((n) => (Number.isFinite(n) ? n : null))
  .nullable()
  .optional();
const requiredNonNeg = z.union([z.number(), z.string().transform((s) => Number(s))])
  .refine((n) => Number.isFinite(n) && n >= 0, { message: 'القيمة يجب أن تكون 0 أو أكبر' });

// -----------------------------------------------------------------------------
// Machine
// -----------------------------------------------------------------------------
export const machineCategorySchema = z.object({
  code: z.string().trim().min(2).max(64).regex(/^[A-Z0-9_]+$/, 'الكود بأحرف لاتينية كبيرة وأرقام فقط'),
  name_ar: z.string().trim().min(1).max(100),
  name_en: z.string().trim().min(1).max(100),
  display_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});
export type MachineCategoryInput = z.infer<typeof machineCategorySchema>;

export const machineBrandSchema = z.object({
  name: z.string().trim().min(1).max(100),
  country_origin: optionalText(100),
  is_active: z.boolean().default(true),
});
export type MachineBrandInput = z.infer<typeof machineBrandSchema>;

export const refrigerantTypeSchema = z.object({
  code: z.string().trim().min(2).max(20).regex(/^[A-Z0-9]+$/),
  name: z.string().trim().min(1).max(50),
  is_active: z.boolean().default(true),
});
export type RefrigerantTypeInput = z.infer<typeof refrigerantTypeSchema>;

export const machineMasterSchema = z.object({
  category_id: z.string().uuid(),
  brand_id: z.string().uuid().nullable().optional(),
  refrigerant_id: z.string().uuid().nullable().optional(),
  outdoor_model: optionalText(150),
  indoor_model: optionalText(150),
  capacity_hp: optionalPositive,
  capacity_tr: optionalPositive,
  btu_h: optionalPositive,
  cfm: optionalPositive,
  kw: optionalPositive,
  country_origin: optionalText(100),
  notes: optionalText(2000),
  is_active: z.boolean().default(true),
});
export type MachineMasterInput = z.infer<typeof machineMasterSchema>;

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------
export const serviceCategorySchema = z.object({
  code: z.string().trim().min(2).max(64).regex(/^[A-Z0-9_]+$/),
  name_ar: z.string().trim().min(1).max(150),
  name_en: z.string().trim().min(1).max(150),
  display_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});
export type ServiceCategoryInput = z.infer<typeof serviceCategorySchema>;

export const serviceTypeSchema = z.object({
  category_id: z.string().uuid(),
  code: z.string().trim().min(2).max(64).regex(/^[A-Z0-9_]+$/),
  name_ar: z.string().trim().min(1).max(150),
  name_en: z.string().trim().min(1).max(150),
  display_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});
export type ServiceTypeInput = z.infer<typeof serviceTypeSchema>;

export const sparePartCategorySchema = z.object({
  code: z.string().trim().min(2).max(64).regex(/^[A-Z0-9_]+$/),
  name_ar: z.string().trim().min(1).max(150),
  name_en: z.string().trim().min(1).max(150),
  display_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});
export type SparePartCategoryInput = z.infer<typeof sparePartCategorySchema>;

export const serviceMasterSchema = z.object({
  service_type_id: z.string().uuid(),
  name_ar: z.string().trim().min(2).max(500),
  name_en: z.string().trim().min(2).max(500),
  technical_code: optionalText(150),
  unit: z.enum(['service', 'piece', 'meter', 'kg', 'hour', 'set']).default('service'),
  capacity_hp: optionalPositive,
  requires_part: z.boolean().default(false),
  default_part_category_id: z.string().uuid().nullable().optional(),
  notes: optionalText(2000),
  is_active: z.boolean().default(true),
});
export type ServiceMasterInput = z.infer<typeof serviceMasterSchema>;

// -----------------------------------------------------------------------------
// Spare parts and gas
// -----------------------------------------------------------------------------
export const sparePartMasterSchema = z.object({
  category_id: z.string().uuid(),
  part_type: optionalText(100),
  name_ar: z.string().trim().min(1).max(300),
  name_en: z.string().trim().min(1).max(300),
  brand_id: z.string().uuid().nullable().optional(),
  model: optionalText(150),
  manufacturer: optionalText(150),
  country_origin: optionalText(100),
  compatible_categories: z.array(z.string().uuid()).default([]),
  unit: z.enum(['piece', 'meter', 'kg', 'set', 'liter']).default('piece'),
  cost_price: requiredNonNeg.default(0),
  selling_price: requiredNonNeg.default(0),
  notes: optionalText(2000),
  is_active: z.boolean().default(true),
});
export type SparePartMasterInput = z.infer<typeof sparePartMasterSchema>;

export const gasTypeMasterSchema = z.object({
  refrigerant_id: z.string().uuid(),
  cost_price_per_kg: requiredNonNeg.default(0),
  selling_price_per_kg: requiredNonNeg.default(0),
  notes: optionalText(2000),
  is_active: z.boolean().default(true),
});
export type GasTypeMasterInput = z.infer<typeof gasTypeMasterSchema>;

// -----------------------------------------------------------------------------
// Pricing
// -----------------------------------------------------------------------------
export const servicePricingSchema = z.object({
  service_id: z.string().uuid(),
  machine_category_id: z.string().uuid().nullable().optional(),
  cost_price: requiredNonNeg.default(0),
  cash_price: requiredNonNeg.default(0),
  co_price: requiredNonNeg.default(0),
  cw_price: requiredNonNeg.default(0),
  cwc_price: requiredNonNeg.default(0),
  ug_price: requiredNonNeg.default(0),
  cash_covered: z.boolean().default(false),
  co_covered: z.boolean().default(false),
  cw_covered: z.boolean().default(false),
  cwc_covered: z.boolean().default(false),
  ug_covered: z.boolean().default(true),
  notes: optionalText(2000),
  is_active: z.boolean().default(true),
}).superRefine((v, ctx) => {
  // covered=true ⇒ price=0 (matches DB CHECK constraint)
  const pairs = [
    ['cash_covered', 'cash_price'],
    ['co_covered', 'co_price'],
    ['cw_covered', 'cw_price'],
    ['cwc_covered', 'cwc_price'],
    ['ug_covered', 'ug_price'],
  ] as const;
  for (const [coveredKey, priceKey] of pairs) {
    if ((v as any)[coveredKey] === true && (v as any)[priceKey] !== 0) {
      ctx.addIssue({ code: 'custom', path: [priceKey], message: 'يجب أن يكون 0 عندما الخدمة مغطاة' });
    }
  }
});
export type ServicePricingInput = z.infer<typeof servicePricingSchema>;

export const contractPricingSchema = z.object({
  machine_category_id: z.string().uuid(),
  brand_id: z.string().uuid().nullable().optional(),
  refrigerant_id: z.string().uuid().nullable().optional(),
  outdoor_model: optionalText(150),
  indoor_model: optionalText(150),
  capacity_hp: optionalPositive,
  capacity_tr: optionalPositive,
  btu_h: optionalPositive,
  cfm: optionalPositive,
  kw: optionalPositive,
  co_unit_price: requiredNonNeg.default(0),
  cw_unit_price: requiredNonNeg.default(0),
  cwc_unit_price: requiredNonNeg.default(0),
  cog_unit_price: requiredNonNeg.default(0),
  cwg_unit_price: requiredNonNeg.default(0),
  cwcg_unit_price: requiredNonNeg.default(0),
  notes: optionalText(2000),
  is_active: z.boolean().default(true),
});
export type ContractPricingInput = z.infer<typeof contractPricingSchema>;
