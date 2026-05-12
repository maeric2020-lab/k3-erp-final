import type { K3SupabaseClient, Database } from '@k3/shared-types';

export class BootstrapRepository {
  constructor(private readonly db: K3SupabaseClient) {}

  /**
   * Returns true if a super_admin already exists.
   * Called by /setup before allowing the bootstrap form to render.
   *
   * Note: until the first user is created, NO authenticated user exists —
   * so this method is callable by anon when used through an admin client,
   * or after the user has just signed up (still anon-equivalent until the
   * profile row + permissions are populated).
   *
   * For the /setup flow we do this check via a Route Handler that uses
   * the service-role client (bypassing RLS), since users_profile RLS
   * doesn't allow anon to read.
   */
  async superAdminExists(): Promise<boolean> {
    const { count, error } = await this.db
      .from('users_profile')
      .select('id', { count: 'exact', head: true })
      .eq('is_super_admin', true);

    if (error) {
      throw new Error(`Failed to check super admin existence: ${error.message}`);
    }
    return (count ?? 0) > 0;
  }

  /**
   * Calls the bootstrap_admin Postgres RPC to promote an existing auth user
   * to super_admin and seed company_settings + numbering_sequences.
   *
   * The auth user must be created BEFORE calling this (via supabase.auth.signUp).
   */
  async promoteToSuperAdmin(input: {
    email: string;
    full_name_ar: string;
    full_name_en?: string | null;
  }): Promise<string> {
    const { data, error } = await this.db.rpc('bootstrap_admin', {
      p_email: input.email,
      p_full_name_ar: input.full_name_ar,
      p_full_name_en: input.full_name_en ?? null,
    });

    if (error) {
      throw new Error(`Bootstrap failed: ${error.message}`);
    }
    return data as string;
  }
}
