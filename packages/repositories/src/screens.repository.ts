import type { K3SupabaseClient, Database, Tables } from '@k3/shared-types';

// المصدر الوحيد لنوع Screen — لا يُكرَّر في أي ملف آخر
export type Screen = Tables<'screens'>;

/**
 * مستودع الشاشات.
 * مصدر وحيد للقراءة من جدول public.screens.
 */
export class ScreensRepository {
  constructor(private readonly db: K3SupabaseClient) {}

  /** قائمة الشاشات النشطة فقط، مرتَّبة بحسب display_order. */
  async listActive(): Promise<Screen[]> {
    const { data, error } = await this.db
      .from('screens')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    if (error) throw new Error(`Failed to load screens: ${error.message}`);
    return data ?? [];
  }

  /**
   * كل الشاشات بما فيها غير النشطة، مرتَّبة بحسب الـ module ثم display_order.
   * تُستخدم في شاشات إدارة الأذونات (Phase 5).
   */
  async listAll(): Promise<Screen[]> {
    const { data, error } = await this.db
      .from('screens')
      .select('*')
      .order('module', { ascending: true })
      .order('display_order', { ascending: true });
    if (error) throw new Error(`Failed to load screens: ${error.message}`);
    return data ?? [];
  }

  /** تجميع الشاشات النشطة حسب الـ module. */
  async listByModule(): Promise<Record<string, Screen[]>> {
    const all = await this.listActive();
    return all.reduce<Record<string, Screen[]>>((acc, s) => {
      (acc[s.module] ??= []).push(s);
      return acc;
    }, {});
  }

  async getByCode(code: string): Promise<Screen | null> {
    const { data, error } = await this.db
      .from('screens')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    if (error) throw new Error(`Failed to load screen: ${error.message}`);
    return data;
  }
}
