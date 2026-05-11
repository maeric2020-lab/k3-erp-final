import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@k3/shared-types';
import { env } from '@/lib/env';

/**
 * عميل Supabase للخادم (Server Components و Route Handlers).
 * يقرأ جلسة المستخدم من الكوكيز ويعمل ضمن صلاحياته. RLS يُطبَّق دائماً.
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // يُستدعى من Server Component — Next.js يمنع كتابة الكوكيز هنا.
            // الـ middleware في lib/supabase/middleware.ts يتولّى التحديث.
          }
        },
      },
    }
  );
}
