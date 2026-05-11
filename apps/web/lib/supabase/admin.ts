import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@k3/shared-types';
import { env } from '@/lib/env';

/**
 * عميل Supabase بصلاحية SERVICE-ROLE.
 * يتجاوز RLS. **الخادم فقط**. لا تكشفه للمتصفح أبداً.
 *
 * يُستخدَم فقط في:
 *   - bootstrap أول مدير
 *   - عمليات storage الإدارية
 *   - دعوة المستخدمين عبر auth.admin.inviteUserByEmail
 *
 * كل المسارات الأخرى يجب أن تستخدم العميل العادي المحكوم بـ RLS.
 *
 * `import 'server-only'` يكسر الـ build لو حاول أي client component استيراده،
 * وهذه حماية وقت الترجمة من تسريب المفتاح.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
