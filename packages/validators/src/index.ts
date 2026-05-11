import { z } from 'zod';
import { SCREEN_ACTIONS } from '@k3/shared-types';

// -----------------------------------------------------------------------------
// Setup / Bootstrap admin
// -----------------------------------------------------------------------------
export const bootstrapAdminSchema = z
  .object({
    full_name_ar: z.string().trim().min(2, 'الاسم بالعربية مطلوب'),
    full_name_en: z.string().trim().min(2).optional().or(z.literal('').transform(() => undefined)),
    email: z.string().trim().toLowerCase().email('بريد إلكتروني غير صحيح'),
    password: z
      .string()
      .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
      .max(128, 'كلمة المرور طويلة جداً'),
    password_confirm: z.string(),
  })
  .refine((d) => d.password === d.password_confirm, {
    message: 'كلمتا المرور غير متطابقتين',
    path: ['password_confirm'],
  });
export type BootstrapAdminInput = z.infer<typeof bootstrapAdminSchema>;

// -----------------------------------------------------------------------------
// Login
// -----------------------------------------------------------------------------
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

// -----------------------------------------------------------------------------
// Company settings
// -----------------------------------------------------------------------------
export const companySettingsSchema = z.object({
  legal_name_ar: z.string().trim().max(255).nullable().optional(),
  legal_name_en: z.string().trim().max(255).nullable().optional(),
  short_name: z.string().trim().max(64).nullable().optional(),
  address_ar: z.string().trim().max(500).nullable().optional(),
  address_en: z.string().trim().max(500).nullable().optional(),
  phone_primary: z.string().trim().max(32).nullable().optional(),
  phone_secondary: z.string().trim().max(32).nullable().optional(),
  email: z.string().trim().email().or(z.literal('').transform(() => null)).nullable().optional(),
  website: z.string().trim().url().or(z.literal('').transform(() => null)).nullable().optional(),
  civil_id_no: z.string().trim().max(32).nullable().optional(),
  commercial_reg_no: z.string().trim().max(64).nullable().optional(),
  tax_no: z.string().trim().max(64).nullable().optional(),
  default_currency: z.enum(['KWD']).default('KWD'),
  default_language: z.enum(['ar', 'en']).default('ar'),
  allow_other_problem: z.boolean().default(false),
  allow_off_catalog_machine: z.boolean().default(true),
});
export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;

// -----------------------------------------------------------------------------
// Permission grant
// -----------------------------------------------------------------------------
export const permissionGrantSchema = z.object({
  user_id: z.string().uuid(),
  screen_code: z.string().min(1),
  action: z.enum(SCREEN_ACTIONS),
  granted: z.boolean().default(true),
});
export type PermissionGrantInput = z.infer<typeof permissionGrantSchema>;

// -----------------------------------------------------------------------------
// Phase 2 — re-export master-data + customer schemas
// -----------------------------------------------------------------------------
export * from './customer';
export * from './master-data';

// -----------------------------------------------------------------------------
// Phase 3 — re-export operations schemas (jobs, requests, contracts, lines)
// -----------------------------------------------------------------------------
export * from './operations';

// -----------------------------------------------------------------------------
// Phase 4 — re-export finance schemas (quotations, invoices, payments, etc.)
// -----------------------------------------------------------------------------
export * from './finance';

// -----------------------------------------------------------------------------
// Phase 5 — re-export permissions schemas (users, templates, grants)
// -----------------------------------------------------------------------------
export * from './permissions';

// -----------------------------------------------------------------------------
// Phase 6c — re-export chat schemas
// -----------------------------------------------------------------------------
export * from './chat';
