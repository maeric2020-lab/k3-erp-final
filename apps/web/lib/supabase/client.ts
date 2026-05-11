import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@k3/shared-types';
import { env } from '@/lib/env';

/**
 * عميل Supabase للمتصفح. يستخدم anon key. كل الـ reads/writes محكومة بـ RLS.
 * لا يُستخدَم لعمليات service-role (استخدم admin client على الخادم بدلاً منها).
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
