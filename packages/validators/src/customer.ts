import { z } from 'zod';

export const customerSchema = z.object({
  name_ar: z.string().trim().min(2, 'الاسم بالعربية مطلوب').max(255),
  name_en: z.string().trim().max(255).nullable().optional().or(z.literal('').transform(() => null)),
  customer_type: z.enum(['individual', 'company', 'government']).default('individual'),
  civil_id: z.string().trim().max(32).nullable().optional().or(z.literal('').transform(() => null)),
  email: z.string().trim().email().nullable().optional().or(z.literal('').transform(() => null)),
  phone_primary: z.string().trim().max(32).nullable().optional().or(z.literal('').transform(() => null)),
  phone_secondary: z.string().trim().max(32).nullable().optional().or(z.literal('').transform(() => null)),
  notes: z.string().trim().max(2000).nullable().optional().or(z.literal('').transform(() => null)),
  is_active: z.boolean().default(true),
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const customerSiteSchema = z.object({
  customer_id: z.string().uuid(),
  site_name: z.string().trim().max(255).nullable().optional().or(z.literal('').transform(() => null)),
  governorate: z.string().trim().max(100).nullable().optional().or(z.literal('').transform(() => null)),
  area: z.string().trim().max(100).nullable().optional().or(z.literal('').transform(() => null)),
  block: z.string().trim().max(50).nullable().optional().or(z.literal('').transform(() => null)),
  street: z.string().trim().max(100).nullable().optional().or(z.literal('').transform(() => null)),
  avenue: z.string().trim().max(100).nullable().optional().or(z.literal('').transform(() => null)),
  building: z.string().trim().max(50).nullable().optional().or(z.literal('').transform(() => null)),
  full_address: z.string().trim().max(1000).nullable().optional().or(z.literal('').transform(() => null)),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  is_primary: z.boolean().default(false),
  is_active: z.boolean().default(true),
});
export type CustomerSiteInput = z.infer<typeof customerSiteSchema>;
