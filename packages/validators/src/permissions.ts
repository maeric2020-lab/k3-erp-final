import { z } from 'zod';

const optionalText = (max = 500) =>
  z.string().trim().max(max).nullable().optional().or(z.literal('').transform(() => null));

export const PERMISSION_ACTIONS = [
  'view','add','edit','delete','print','export','approve','assign','import',
] as const;
export type PermissionAction = typeof PERMISSION_ACTIONS[number];

// -----------------------------------------------------------------------------
// User profile (admin-managed). Email is required + immutable post-creation;
// password handling lives at the auth level (invite flow, not stored here).
// -----------------------------------------------------------------------------
export const userProfileSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'البريد الإلكتروني غير صحيح' }),
  full_name_ar: z.string().trim().min(2).max(255),
  full_name_en: optionalText(255),
  phone: optionalText(64),
  technician_code: optionalText(64),
  is_super_admin: z.boolean().default(false),
  is_active: z.boolean().default(true),
});
export type UserProfileInput = z.infer<typeof userProfileSchema>;

export const userProfileUpdateSchema = userProfileSchema.partial().extend({
  // email is not editable through this endpoint
  email: z.never().optional(),
});

// -----------------------------------------------------------------------------
// Permission grant — single screen × action toggle
// -----------------------------------------------------------------------------
export const permissionGrantSchema = z.object({
  user_id: z.string().uuid(),
  screen_code: z.string().min(1).max(64),
  action: z.enum(PERMISSION_ACTIONS),
  granted: z.boolean(),
});
export type PermissionGrantInput = z.infer<typeof permissionGrantSchema>;

// -----------------------------------------------------------------------------
// Permission templates and their items
// -----------------------------------------------------------------------------
export const permissionTemplateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: optionalText(500),
  is_active: z.boolean().default(true),
});
export type PermissionTemplateInput = z.infer<typeof permissionTemplateSchema>;

export const permissionTemplateItemSchema = z.object({
  template_id: z.string().uuid(),
  screen_code: z.string().min(1).max(64),
  action: z.enum(PERMISSION_ACTIONS),
  granted: z.boolean().default(true),
});
export type PermissionTemplateItemInput = z.infer<typeof permissionTemplateItemSchema>;

export const applyTemplateSchema = z.object({
  user_id: z.string().uuid(),
  template_id: z.string().uuid(),
  replace: z.boolean().default(false),
});
export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>;
