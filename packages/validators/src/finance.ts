import { z } from 'zod';

const optionalText = (max = 500) =>
  z.string().trim().max(max).nullable().optional().or(z.literal('').transform(() => null));
const requiredNonNeg = z
  .union([z.number(), z.string().transform((s) => Number(s))])
  .refine((n) => Number.isFinite(n) && n >= 0, { message: 'القيمة يجب أن تكون 0 أو أكبر' });
const requiredPositive = z
  .union([z.number(), z.string().transform((s) => Number(s))])
  .refine((n) => Number.isFinite(n) && n > 0, { message: 'القيمة يجب أن تكون أكبر من صفر' });

export const QUOTATION_STATUSES = ['draft','sent','accepted','rejected','expired','cancelled'] as const;
export const INVOICE_STATUSES = ['issued','partial','paid','cancelled','void'] as const;
export const PAYMENT_METHODS = ['cash','knet','transfer','cheque','card','other'] as const;

// -----------------------------------------------------------------------------
// Quotation
// -----------------------------------------------------------------------------
export const quotationSchema = z.object({
  customer_id: z.string().uuid(),
  site_id: z.string().uuid().nullable().optional(),
  request_type: z.enum(['CASH','CO','CW','CWC','UG']).default('CASH'),
  status: z.enum(QUOTATION_STATUSES).default('draft'),
  issue_date: z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: 'تاريخ غير صحيح' }),
  valid_until: z.string().nullable().optional().or(z.literal('').transform(() => null)),
  discount: requiredNonNeg.default(0),
  notes: optionalText(2000),
});
export type QuotationInput = z.infer<typeof quotationSchema>;

// -----------------------------------------------------------------------------
// Invoice
// -----------------------------------------------------------------------------
export const invoiceSchema = z.object({
  customer_id: z.string().uuid(),
  site_id: z.string().uuid().nullable().optional(),
  job_id: z.string().uuid().nullable().optional(),
  contract_id: z.string().uuid().nullable().optional(),
  request_type: z.enum(['CASH','CO','CW','CWC','UG']).nullable().optional(),
  status: z.enum(INVOICE_STATUSES).default('issued'),
  issue_date: z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: 'تاريخ غير صحيح' }),
  due_date: z.string().nullable().optional().or(z.literal('').transform(() => null)),
  discount: requiredNonNeg.default(0),
  notes: optionalText(2000),
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

// -----------------------------------------------------------------------------
// Payment
// -----------------------------------------------------------------------------
export const paymentSchema = z.object({
  invoice_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  amount: requiredPositive,
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText(150),
  payment_date: z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: 'تاريخ غير صحيح' }),
  notes: optionalText(1000),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

// -----------------------------------------------------------------------------
// Contract clause template + per-contract clause
// -----------------------------------------------------------------------------
export const contractClauseTemplateSchema = z.object({
  code: z.string().trim().min(1).max(64),
  display_order: z.number().int().default(0),
  title_ar: z.string().trim().min(1).max(255),
  title_en: z.string().trim().min(1).max(255),
  body_ar: z.string().trim().min(1).max(20000),
  body_en: z.string().trim().min(1).max(20000),
  applies_to: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
});
export type ContractClauseTemplateInput = z.infer<typeof contractClauseTemplateSchema>;

export const contractClauseSchema = z.object({
  contract_id: z.string().uuid(),
  template_id: z.string().uuid().nullable().optional(),
  code: z.string().trim().min(1).max(64),
  display_order: z.number().int().default(0),
  title_ar: z.string().trim().min(1).max(255),
  title_en: z.string().trim().min(1).max(255),
  body_ar: z.string().trim().min(1).max(20000),
  body_en: z.string().trim().min(1).max(20000),
});
export type ContractClauseInput = z.infer<typeof contractClauseSchema>;

// -----------------------------------------------------------------------------
// Compressor bracket
// -----------------------------------------------------------------------------
export const compressorBracketSchema = z.object({
  hp_min: requiredNonNeg,
  hp_max: requiredNonNeg,
  base_price: requiredNonNeg,
  k3_supplied_surcharge_pct: requiredNonNeg.default(10),
  is_active: z.boolean().default(true),
}).superRefine((v, ctx) => {
  if (v.hp_max < v.hp_min) {
    ctx.addIssue({ code: 'custom', path: ['hp_max'], message: 'HP max must be ≥ HP min' });
  }
});
export type CompressorBracketInput = z.infer<typeof compressorBracketSchema>;
