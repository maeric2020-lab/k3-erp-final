import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@k3/shared-types';
import { UsersProfileRepository, type UserProfile } from '@k3/repositories';

/**
 * UserInvitationService — admin-side user creation.
 *
 * Two-step flow:
 *   1. Admin client creates auth user (or invites by email — that's the
 *      Supabase admin API). The email receives a confirm/set-password link.
 *   2. We insert a users_profile row linked to the new auth user id, with
 *      role/profile fields filled in. RLS doesn't apply to the admin client.
 *
 * Both steps must succeed; if step 2 fails, we revert step 1 (best-effort
 * via auth.admin.deleteUser).
 */
export class UserInvitationService {
  private readonly profiles: UsersProfileRepository;

  constructor(private readonly adminDb: SupabaseClient<Database>) {
    // The admin client must NOT be used for the profile-write path's RLS;
    // however since we're called server-side on an admin-permitted endpoint
    // we use it directly here for atomicity.
    this.profiles = new UsersProfileRepository(adminDb);
  }

  async invite(input: {
    email: string;
    full_name_ar: string;
    full_name_en?: string | null;
    phone?: string | null;
    technician_code?: string | null;
    is_super_admin?: boolean;
    is_active?: boolean;
    redirect_to?: string;
  }): Promise<UserProfile> {
    // Step 1: invite or upsert auth user
    const { data: invitation, error: inviteError } = await this.adminDb.auth.admin.inviteUserByEmail(
      input.email,
      input.redirect_to ? { redirectTo: input.redirect_to } : undefined
    );
    if (inviteError) {
      // If the user already exists in auth, try to fetch them; otherwise
      // re-raise.
      if (inviteError.message?.toLowerCase().includes('already')) {
        // Look up by email
        const { data: existing } = await this.adminDb.auth.admin.listUsers();
        const found = existing?.users?.find((u: any) => u.email?.toLowerCase() === input.email.toLowerCase());
        if (!found) throw inviteError;
        const existingProfile = await this.profiles.getById(found.id);
        if (existingProfile) return existingProfile;
        return this.profiles.create({
          id: found.id,
          email: input.email,
          full_name_ar: input.full_name_ar,
          full_name_en: input.full_name_en ?? null,
          phone: input.phone ?? null,
          technician_code: input.technician_code ?? null,
          is_super_admin: input.is_super_admin ?? false,
          is_active: input.is_active ?? true,
        } as any);
      }
      throw inviteError;
    }
    if (!invitation?.user) throw new Error('Invitation returned no user');

    const userId = invitation.user.id;

    // Step 2: profile insert. The auth.users → users_profile sync trigger may
    // already have created a stub row; in that case we update.
    const existing = await this.profiles.getById(userId);
    try {
      if (existing) {
        return await this.profiles.update(userId, {
          full_name_ar: input.full_name_ar,
          full_name_en: input.full_name_en ?? null,
          phone: input.phone ?? null,
          technician_code: input.technician_code ?? null,
          is_super_admin: input.is_super_admin ?? false,
          is_active: input.is_active ?? true,
        });
      }
      return await this.profiles.create({
        id: userId,
        email: input.email,
        full_name_ar: input.full_name_ar,
        full_name_en: input.full_name_en ?? null,
        phone: input.phone ?? null,
        technician_code: input.technician_code ?? null,
        is_super_admin: input.is_super_admin ?? false,
        is_active: input.is_active ?? true,
      } as any);
    } catch (e) {
      // Best-effort: roll back the auth user so we don't leave orphans
      try { await this.adminDb.auth.admin.deleteUser(userId); } catch { /* ignore */ }
      throw e;
    }
  }

  /**
   * Permanently archive a user — deactivates the profile and deletes the
   * auth record. The audit log preserves the trail.
   */
  async archive(userId: string): Promise<void> {
    await this.profiles.archive(userId);
    try {
      await this.adminDb.auth.admin.deleteUser(userId);
    } catch (e) {
      // The auth user may already be gone or the admin API may be unavailable.
      // The profile is archived either way; this is a best-effort cleanup.
      console.warn('Auth user delete failed:', e);
    }
  }
}
