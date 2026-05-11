import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@k3/shared-types';
import { BootstrapRepository } from '@k3/repositories';

/**
 * Orchestrates the first-Admin bootstrap.
 *
 * The flow REQUIRES two clients:
 *   1. An `admin` client (service role) — only it can read users_profile
 *      while no super_admin exists yet, and only it can create the auth
 *      user without an active session. The /setup Route Handler wires this.
 *   2. The auth user is created via supabase.auth.admin.createUser() (admin)
 *      then promoted via the bootstrap_admin RPC.
 */
export class SetupService {
  private readonly repo: BootstrapRepository;

  constructor(private readonly admin: SupabaseClient<Database>) {
    this.repo = new BootstrapRepository(admin);
  }

  async needsSetup(): Promise<boolean> {
    return !(await this.repo.superAdminExists());
  }

  async createFirstAdmin(input: {
    email: string;
    password: string;
    full_name_ar: string;
    full_name_en?: string | null;
  }): Promise<{ userId: string }> {
    if (await this.repo.superAdminExists()) {
      throw new SetupAlreadyCompleteError();
    }

    // Create the auth user via admin endpoint (no email confirmation needed)
    const { data: created, error: createErr } = await this.admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name_ar: input.full_name_ar,
        full_name_en: input.full_name_en ?? null,
      },
    });

    if (createErr || !created.user) {
      throw new Error(`Failed to create auth user: ${createErr?.message ?? 'unknown error'}`);
    }

    // Promote to super_admin and seed company_settings + numbering_sequences
    const userId = await this.repo.promoteToSuperAdmin({
      email: input.email,
      full_name_ar: input.full_name_ar,
      full_name_en: input.full_name_en ?? null,
    });

    return { userId };
  }
}

export class SetupAlreadyCompleteError extends Error {
  constructor() {
    super('Setup has already been completed.');
    this.name = 'SetupAlreadyCompleteError';
  }
}
