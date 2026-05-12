import type { K3SupabaseClient, Database, Tables } from '@k3/shared-types';

export type Notification = Tables<'notifications'>;
export type NotificationPreferences = Tables<'notification_preferences'>;

export class NotificationsRepository {
  constructor(private readonly db: K3SupabaseClient) {}

  /** قائمة الإشعارات للمستخدم الحالي مع pagination */
  async listForCurrent(opts: { unreadOnly?: boolean; limit?: number; offset?: number } = {}): Promise<{ rows: Notification[]; total: number; unread: number }> {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;

    let query = this.db.from('notifications').select('*', { count: 'exact' });
    if (opts.unreadOnly) query = query.is('read_at', null);
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to load notifications: ${error.message}`);

    // عدّ غير المقروء
    const { count: unreadCount } = await this.db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null);

    return {
      rows: data ?? [],
      total: count ?? 0,
      unread: unreadCount ?? 0,
    };
  }

  /** عدّ غير المقروء فقط (سريع، للـ badge في الـ topbar) */
  async unreadCount(): Promise<number> {
    const { count, error } = await this.db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null);
    if (error) throw new Error(`Failed to count: ${error.message}`);
    return count ?? 0;
  }

  /** تعليم إشعار واحد كمقروء */
  async markRead(id: string): Promise<void> {
    const { error } = await this.db
      .from('notifications')
      .update({ read_at: new Date().toISOString() } as any)
      .eq('id', id);
    if (error) throw new Error(`Failed to mark read: ${error.message}`);
  }

  /** تعليم الكل كمقروء (RPC) */
  async markAllRead(): Promise<number> {
    const { data, error } = await this.db.rpc('fn_mark_all_notifications_read' as any);
    if (error) throw new Error(`Failed to mark all read: ${error.message}`);
    return Number(data) || 0;
  }

  /** قراءة تفضيلات المستخدم (إنشاء default إن لم توجد) */
  async getPreferences(): Promise<NotificationPreferences | null> {
    const { data, error } = await this.db
      .from('notification_preferences')
      .select('*')
      .maybeSingle();
    if (error) throw new Error(`Failed to load preferences: ${error.message}`);
    return data;
  }

  /** تحديث تفضيلات */
  async updatePreferences(updates: Partial<{
    email_enabled: boolean;
    push_enabled: boolean;
    push_subscription: any;
    enabled_types: string[];
  }>): Promise<void> {
    // upsert لأن الصف قد لا يكون موجوداً بعد
    const { error } = await this.db
      .from('notification_preferences')
      .upsert({
        user_id: (await this.db.auth.getUser()).data.user?.id,
        ...updates,
      } as any, { onConflict: 'user_id' });
    if (error) throw new Error(`Failed to update preferences: ${error.message}`);
  }
}
