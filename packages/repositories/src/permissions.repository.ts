import type { K3SupabaseClient, Database, ScreenAction, Tables } from '@k3/shared-types';

export type UserScreenPermission = Tables<'user_screen_permissions'>;

export class PermissionsRepository {
  constructor(private readonly db: K3SupabaseClient) {}

  /**
   * Server-authoritative permission check via Postgres RPC.
   * The RPC returns true when the user is a super_admin OR has an explicit grant.
   */
  async hasScreenPermission(screenCode: string, action: ScreenAction): Promise<boolean> {
    const { data, error } = await this.db.rpc('fn_has_screen_permission', {
      p_screen_code: screenCode,
      p_action: action,
    });
    if (error) throw new Error(`Permission check failed: ${error.message}`);
    return Boolean(data);
  }

  async isSuperAdmin(): Promise<boolean> {
    const { data, error } = await this.db.rpc('fn_is_super_admin');
    if (error) throw new Error(`Super-admin check failed: ${error.message}`);
    return Boolean(data);
  }

  async listForUser(userId: string): Promise<UserScreenPermission[]> {
    const { data, error } = await this.db
      .from('user_screen_permissions')
      .select('*')
      .eq('user_id', userId);
    if (error) throw new Error(`Failed to list permissions: ${error.message}`);
    return data ?? [];
  }

  async grant(userId: string, screenCode: string, action: ScreenAction): Promise<void> {
    const { error } = await this.db
      .from('user_screen_permissions')
      .upsert(
        { user_id: userId, screen_code: screenCode, action, granted: true },
        { onConflict: 'user_id,screen_code,action' }
      );
    if (error) throw new Error(`Failed to grant permission: ${error.message}`);
  }

  async revoke(userId: string, screenCode: string, action: ScreenAction): Promise<void> {
    const { error } = await this.db
      .from('user_screen_permissions')
      .delete()
      .match({ user_id: userId, screen_code: screenCode, action });
    if (error) throw new Error(`Failed to revoke permission: ${error.message}`);
  }
}
