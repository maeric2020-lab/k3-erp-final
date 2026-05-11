import 'server-only';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { UsersProfileRepository, type UserProfile } from '@k3/repositories';

/**
 * Server-only guard. Use at the top of every protected Server Component / Route
 * Handler that needs an authenticated, active user.
 *
 * Returns the profile + an authenticated supabase client for downstream queries.
 *
 * Throws (via redirect) when:
 *   - No session         → /login?redirect=…
 *   - No profile row     → /login (signals the auth user has no profile yet)
 *   - User is inactive   → /login?reason=inactive
 *   - User is archived   → /login?reason=archived
 */
export async function requireUser(currentPath?: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const search = currentPath ? `?redirect=${encodeURIComponent(currentPath)}` : '';
    redirect(`/login${search}`);
  }

  const profile: UserProfile | null = await new UsersProfileRepository(supabase).getCurrent();
  if (!profile) {
    redirect('/login?reason=no_profile');
  }
  if (!profile.is_active) {
    redirect('/login?reason=inactive');
  }
  if (profile.is_archived) {
    redirect('/login?reason=archived');
  }

  return { supabase, user, profile };
}
