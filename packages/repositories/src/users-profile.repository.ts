import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables, TablesInsert, TablesUpdate } from '@k3/shared-types';

export type UserProfile = Tables<'users_profile'>;

export class UsersProfileRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async getCurrent(): Promise<UserProfile | null> {
    const { data: authData } = await this.db.auth.getUser();
    if (!authData.user) return null;

    const { data, error } = await this.db
      .from('users_profile')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (error) throw new Error(`Failed to load profile: ${error.message}`);
    return data;
  }

  async getById(id: string): Promise<UserProfile | null> {
    const { data, error } = await this.db
      .from('users_profile')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`Failed to load profile: ${error.message}`);
    return data;
  }

  async listActive(): Promise<UserProfile[]> {
    const { data, error } = await this.db
      .from('users_profile')
      .select('*')
      .eq('is_active', true)
      .eq('is_archived', false)
      .order('full_name_ar', { ascending: true });
    if (error) throw new Error(`Failed to list users: ${error.message}`);
    return data ?? [];
  }

  /**
   * قائمة الفنيين النشطين فقط (لشاشات إسناد الوظائف).
   * الفنّي يُحدَّد بوجود technician_id غير NULL.
   */
  async listTechnicians(): Promise<UserProfile[]> {
    const { data, error } = await this.db
      .from('users_profile')
      .select('*')
      .eq('is_active', true)
      .eq('is_archived', false)
      .not('technician_id', 'is', null)
      .order('full_name_ar', { ascending: true });
    if (error) throw new Error(`Failed to list technicians: ${error.message}`);
    return data ?? [];
  }

  /**
   * Admin-side list including inactive (but excluding archived by default).
   */
  async listAll(opts: { search?: string | null; include_archived?: boolean } = {}): Promise<UserProfile[]> {
    let q = this.db.from('users_profile').select('*');
    if (!opts.include_archived) q = q.eq('is_archived', false);
    if (opts.search) {
      const s = opts.search.replace(/[%_]/g, '\\$&');
      q = q.or(`full_name_ar.ilike.%${s}%,full_name_en.ilike.%${s}%,email.ilike.%${s}%`);
    }
    const { data, error } = await q.order('full_name_ar', { ascending: true }).limit(500);
    if (error) throw new Error(`Failed to list users: ${error.message}`);
    return data ?? [];
  }

  async count(): Promise<number> {
    const { count, error } = await this.db
      .from('users_profile')
      .select('*', { count: 'exact', head: true })
      .eq('is_archived', false);
    if (error) throw error;
    return count ?? 0;
  }

  async update(id: string, patch: TablesUpdate<'users_profile'>): Promise<UserProfile> {
    const { data, error } = await this.db
      .from('users_profile')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(`Failed to update profile: ${error.message}`);
    return data;
  }

  /**
   * Insert profile linked to an existing auth user. The admin-side flow
   * invites via Supabase admin auth (separate API), then calls this with
   * the returned auth user id.
   */
  async create(values: TablesInsert<'users_profile'>): Promise<UserProfile> {
    const { data, error } = await this.db
      .from('users_profile')
      .insert(values)
      .select('*')
      .single();
    if (error) throw new Error(`Failed to create profile: ${error.message}`);
    return data;
  }

  async archive(id: string): Promise<void> {
    const { error } = await this.db
      .from('users_profile')
      .update({ is_archived: true, is_active: false })
      .eq('id', id);
    if (error) throw error;
  }
}
