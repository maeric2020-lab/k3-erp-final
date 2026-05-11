import { redirect } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { SetupService } from '@k3/services';

/**
 * Entry point. If no super_admin exists yet → /setup. Otherwise → /login.
 *
 * The setup-needed check uses the service-role admin client because no
 * user is authenticated at this point and users_profile RLS would block
 * the regular anon client.
 */
export default async function Root() {
  const admin = createSupabaseAdminClient();
  const setup = new SetupService(admin);
  const needsSetup = await setup.needsSetup();
  redirect(needsSetup ? '/setup' : '/login');
}
