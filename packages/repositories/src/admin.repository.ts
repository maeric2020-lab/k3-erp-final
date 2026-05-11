import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@k3/shared-types';
import { CrudRepository } from './_base';

// تُستورَد الأنواع من ملفّاتها الأصلية لتفادي التكرار
// (انظر تقرير المرحلة 8أ — مشكلتا B-1 و B-3)
import type { UserScreenPermission } from './permissions.repository';

export type PermissionTemplate = Tables<'permission_templates'>;
export type PermissionTemplateItem = Tables<'permission_template_items'>;
export type AuditLog = Tables<'audit_log'>;

export interface PermissionGridRow {
  screen_code: string;
  module: string;
  label_ar: string;
  label_en: string;
  display_order: number;
  action: string;
  granted: boolean;
}

// -----------------------------------------------------------------------------
// UserPermissionsAdminRepository — إدارة admin-side فوق user_screen_permissions.
// (PermissionsRepository موجود لفحوصات الـ runtime؛ هذا للواجهة الإدارية للمرحلة 5)
// -----------------------------------------------------------------------------
export class UserPermissionsAdminRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listForUser(userId: string): Promise<UserScreenPermission[]> {
    const { data, error } = await this.db
      .from('user_screen_permissions')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Wraps the fn_user_permission_grid RPC. Returns one row per (screen × action)
   * with `granted` set per the user's current permissions.
   */
  async grid(userId: string): Promise<PermissionGridRow[]> {
    const { data, error } = await this.db.rpc('fn_user_permission_grid' as any, { p_user_id: userId });
    if (error) throw error;
    return (data ?? []) as PermissionGridRow[];
  }

  /**
   * Toggle a single grant. If granted=true and the row doesn't exist, insert
   * it; if granted=false and it exists, delete it. Absence is the deny.
   */
  async setGrant(userId: string, screenCode: string, action: string, granted: boolean): Promise<void> {
    if (granted) {
      const { error } = await this.db
        .from('user_screen_permissions')
        .upsert(
          { user_id: userId, screen_code: screenCode, action },
          { onConflict: 'user_id,screen_code,action' }
        );
      if (error) throw error;
    } else {
      const { error } = await this.db
        .from('user_screen_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('screen_code', screenCode)
        .eq('action', action);
      if (error) throw error;
    }
  }

  /** Bulk replace a user's permissions (useful for "save all"). */
  async replaceForUser(userId: string, grants: Array<{ screen_code: string; action: string }>): Promise<void> {
    const { error: delError } = await this.db
      .from('user_screen_permissions')
      .delete()
      .eq('user_id', userId);
    if (delError) throw delError;
    if (grants.length === 0) return;
    const rows = grants.map((g) => ({ user_id: userId, screen_code: g.screen_code, action: g.action }));
    const { error } = await this.db.from('user_screen_permissions').insert(rows as any);
    if (error) throw error;
  }

  /** Wraps fn_apply_template_to_user. */
  async applyTemplate(userId: string, templateId: string, replace = false): Promise<number> {
    const { data, error } = await this.db.rpc('fn_apply_template_to_user' as any, {
      p_user_id: userId,
      p_template_id: templateId,
      p_replace: replace,
    });
    if (error) throw error;
    return Number(data ?? 0);
  }

  /** Wraps fn_set_user_active. */
  async setUserActive(userId: string, active: boolean): Promise<void> {
    const { error } = await this.db.rpc('fn_set_user_active' as any, {
      p_user_id: userId,
      p_active: active,
    });
    if (error) throw error;
  }
}

// -----------------------------------------------------------------------------
// PermissionTemplatesRepository
// -----------------------------------------------------------------------------
export class PermissionTemplatesRepository extends CrudRepository<'permission_templates'> {
  constructor(db: SupabaseClient<Database>) {
    super(db, 'permission_templates', ['name', 'description']);
  }

  async listActive(): Promise<PermissionTemplate[]> {
    const { data, error } = await this.db
      .from('permission_templates')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }
}

// -----------------------------------------------------------------------------
// PermissionTemplateItemsRepository
// -----------------------------------------------------------------------------
export class PermissionTemplateItemsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listForTemplate(templateId: string): Promise<PermissionTemplateItem[]> {
    const { data, error } = await this.db
      .from('permission_template_items')
      .select('*')
      .eq('template_id', templateId);
    if (error) throw error;
    return data ?? [];
  }

  async setItem(templateId: string, screenCode: string, action: string, granted: boolean): Promise<void> {
    if (granted) {
      const { error } = await this.db
        .from('permission_template_items')
        .upsert(
          { template_id: templateId, screen_code: screenCode, action, granted: true },
          { onConflict: 'template_id,screen_code,action' }
        );
      if (error) throw error;
    } else {
      const { error } = await this.db
        .from('permission_template_items')
        .delete()
        .eq('template_id', templateId)
        .eq('screen_code', screenCode)
        .eq('action', action);
      if (error) throw error;
    }
  }

  async replaceItems(templateId: string, items: Array<{ screen_code: string; action: string }>): Promise<void> {
    const { error: delError } = await this.db
      .from('permission_template_items')
      .delete()
      .eq('template_id', templateId);
    if (delError) throw delError;
    if (items.length === 0) return;
    const rows = items.map((i) => ({ template_id: templateId, screen_code: i.screen_code, action: i.action, granted: true }));
    const { error } = await this.db.from('permission_template_items').insert(rows as any);
    if (error) throw error;
  }
}

// -----------------------------------------------------------------------------
// AuditLogRepository
// -----------------------------------------------------------------------------
export interface AuditLogFilters {
  user_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action?: string | null;
  from_date?: string | null;
  to_date?: string | null;
  limit?: number;
}

export class AuditLogRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async list(f: AuditLogFilters = {}): Promise<AuditLog[]> {
    let q = this.db.from('audit_log').select('*');
    if (f.user_id) q = q.eq('user_id', f.user_id);
    if (f.entity_type) q = q.eq('entity_type', f.entity_type);
    if (f.entity_id) q = q.eq('entity_id', f.entity_id);
    if (f.action) q = q.eq('action', f.action);
    if (f.from_date) q = q.gte('created_at', f.from_date);
    if (f.to_date) q = q.lte('created_at', f.to_date);
    const { data, error } = await q
      .order('created_at', { ascending: false })
      .limit(f.limit ?? 200);
    if (error) throw error;
    return data ?? [];
  }

  async distinctEntityTypes(): Promise<string[]> {
    const { data, error } = await this.db
      .from('audit_log')
      .select('entity_type')
      .order('entity_type', { ascending: true })
      .limit(2000);
    if (error) throw error;
    const set = new Set<string>();
    (data ?? []).forEach((r: any) => set.add(r.entity_type));
    return [...set];
  }

  async distinctActions(): Promise<string[]> {
    const { data, error } = await this.db
      .from('audit_log')
      .select('action')
      .order('action', { ascending: true })
      .limit(2000);
    if (error) throw error;
    const set = new Set<string>();
    (data ?? []).forEach((r: any) => set.add(r.action));
    return [...set];
  }
}
