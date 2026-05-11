import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';

/**
 * مساعدات لاختبارات E2E
 *
 * توفّر هذه الوحدة:
 *   - عميل Supabase admin (service_role) للـ seed والتنظيف
 *   - دالة لإنشاء مستخدم اختباري بأذونات محددة
 *   - دالة لتسجيل الدخول عبر واجهة المستخدم
 */

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY مطلوبتان لاختبارات E2E');
}

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * إنشاء مستخدم اختباري كاملاً (auth + profile) بكلمة مرور معروفة وأذونات محددة.
 * يُعيد بريد المستخدم وكلمته السرية.
 */
export async function createTestUser(opts: {
  prefix: string;                       // مثلاً 'test-tech', 'test-office'
  fullName: string;
  isSuperAdmin?: boolean;
  technicianCode?: string | null;
  permissions?: Array<{ screen: string; action: string }>;
}): Promise<{ email: string; password: string; userId: string }> {
  const admin = adminClient();
  const email = `${opts.prefix}-${Date.now()}@e2e.k3.test`;
  const password = `TestPwd-${Math.random().toString(36).slice(2, 10)}!`;

  // 1) إنشاء auth user
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (authErr) throw authErr;
  if (!authData.user) throw new Error('لم يُنشأ المستخدم');
  const userId = authData.user.id;

  // 2) upsert في users_profile
  await admin.from('users_profile').upsert({
    id: userId,
    email,
    full_name_ar: opts.fullName,
    full_name_en: opts.fullName,
    is_super_admin: opts.isSuperAdmin ?? false,
    is_active: true,
    technician_code: opts.technicianCode ?? null,
  } as any);

  // 3) منح الأذونات
  if (opts.permissions && opts.permissions.length > 0) {
    const rows = opts.permissions.map((p) => ({
      user_id: userId, screen_code: p.screen, action: p.action, created_by: userId,
    }));
    await admin.from('user_screen_permissions').upsert(rows as any);
  }

  return { email, password, userId };
}

/** حذف مستخدم اختباري (auth + profile + cascades) */
export async function deleteTestUser(userId: string): Promise<void> {
  const admin = adminClient();
  await admin.from('users_profile').delete().eq('id', userId);
  await admin.auth.admin.deleteUser(userId).catch(() => {});
}

/** تسجيل دخول عبر واجهة المستخدم */
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/البريد|email/i).fill(email);
  await page.getByLabel(/كلمة المرور|password/i).fill(password);
  await page.getByRole('button', { name: /دخول|login/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 });
}

/** انتظار اختفاء أي توست / تحميل */
export async function waitForIdle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}
