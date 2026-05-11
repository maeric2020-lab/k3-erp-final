import { test, expect } from '@playwright/test';
import { adminClient, createTestUser, deleteTestUser } from '../helpers/auth';
import { createClient } from '@supabase/supabase-js';

/**
 * اختبارات أمنية — RLS
 *
 * هذه الاختبارات لا تستخدم Page؛ تستدعي Supabase مباشرة بمستخدمي اختبار
 * مختلفين للتحقق من أن RLS يصدّ ما يجب أن يصدّه.
 */

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;

function userClient(email: string, password: string) {
  const c = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return c.auth.signInWithPassword({ email, password }).then((res) => {
    if (res.error) throw res.error;
    return c;
  });
}

test.describe('RLS — أمن البيانات', () => {
  test('مستخدم بدون أذونات لا يرى أي بيانات', async () => {
    const u = await createTestUser({
      prefix: 'sec-noperms', fullName: 'بدون أذونات', permissions: [],
    });
    try {
      const c = await userClient(u.email, u.password);
      const { data: customers } = await c.from('customers').select('id').limit(10);
      const { data: jobs } = await c.from('jobs').select('id').limit(10);
      const { data: invoices } = await c.from('invoices').select('id').limit(10);
      expect(customers ?? []).toHaveLength(0);
      expect(jobs ?? []).toHaveLength(0);
      expect(invoices ?? []).toHaveLength(0);
    } finally {
      await deleteTestUser(u.userId);
    }
  });

  test('فني يرى وظائفه فقط، ليس وظائف فني آخر', async () => {
    const tech1 = await createTestUser({
      prefix: 'sec-tech1', fullName: 'فني 1', technicianCode: 'SEC-T1',
      permissions: [{ screen: 'jobs_my', action: 'view' }],
    });
    const tech2 = await createTestUser({
      prefix: 'sec-tech2', fullName: 'فني 2', technicianCode: 'SEC-T2',
      permissions: [{ screen: 'jobs_my', action: 'view' }],
    });

    const admin = adminClient();
    const { data: cust } = await admin
      .from('customers')
      .insert({ name_ar: 'عميل أمن', code: `SEC-${Date.now()}` } as any)
      .select('id').single();

    const { data: job1 } = await admin.from('jobs').insert({
      customer_id: cust!.id, technician_id: tech1.userId, status: 'assigned',
    } as any).select('id').single();
    const { data: job2 } = await admin.from('jobs').insert({
      customer_id: cust!.id, technician_id: tech2.userId, status: 'assigned',
    } as any).select('id').single();

    try {
      // فني 1 يرى فقط وظيفته
      const c1 = await userClient(tech1.email, tech1.password);
      const { data: tech1Jobs } = await c1.from('jobs').select('id, technician_id');
      expect(tech1Jobs?.map((j: any) => j.id)).toContain(job1!.id);
      expect(tech1Jobs?.map((j: any) => j.id)).not.toContain(job2!.id);

      // فني 2 يرى فقط وظيفته
      const c2 = await userClient(tech2.email, tech2.password);
      const { data: tech2Jobs } = await c2.from('jobs').select('id');
      expect(tech2Jobs?.map((j: any) => j.id)).toContain(job2!.id);
      expect(tech2Jobs?.map((j: any) => j.id)).not.toContain(job1!.id);
    } finally {
      await admin.from('jobs').delete().in('id', [job1!.id, job2!.id]);
      await admin.from('customers').delete().eq('id', cust!.id);
      await deleteTestUser(tech1.userId);
      await deleteTestUser(tech2.userId);
    }
  });

  test('مستخدم بلا audit_log:view يحصل على 403', async () => {
    const u = await createTestUser({
      prefix: 'sec-noaudit', fullName: 'بدون audit', permissions: [],
    });
    try {
      const c = await userClient(u.email, u.password);
      const { data, error } = await c.from('audit_log').select('id').limit(1);
      // RLS يُعيد مصفوفة فارغة وليس error 403 (هذا هو سلوك Postgres RLS)
      expect(data ?? []).toHaveLength(0);
    } finally {
      await deleteTestUser(u.userId);
    }
  });

  test('لا يمكن تعطيل آخر super-admin', async () => {
    const admin = adminClient();
    // عدّ الـ super-admins النشطين
    const { count } = await admin
      .from('users_profile')
      .select('*', { count: 'exact', head: true })
      .eq('is_super_admin', true).eq('is_active', true).eq('is_archived', false);
    if ((count ?? 0) !== 1) {
      test.skip(true, 'هذا الاختبار يتطلب super-admin واحد فقط في النظام');
    }
    // محاولة تعطيله
    const { data: superAdmin } = await admin.from('users_profile').select('id')
      .eq('is_super_admin', true).eq('is_active', true).limit(1).single();
    const { error } = await admin.rpc('fn_set_user_active' as any, {
      p_user_id: superAdmin!.id, p_active: false,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/last active super-admin|آخر/i);
  });

  test('عضو في thread يستطيع قراءة الرسائل، غير العضو لا يستطيع', async () => {
    const a = await createTestUser({
      prefix: 'sec-chat-a', fullName: 'محادث أ',
      permissions: [{ screen: 'chat', action: 'view' }],
    });
    const b = await createTestUser({
      prefix: 'sec-chat-b', fullName: 'محادث ب',
      permissions: [{ screen: 'chat', action: 'view' }],
    });
    const c = await createTestUser({
      prefix: 'sec-chat-c', fullName: 'متطفّل ج',
      permissions: [{ screen: 'chat', action: 'view' }],
    });

    const admin = adminClient();
    let threadId: string | null = null;
    try {
      // أ ينشئ DM مع ب
      const ca = await userClient(a.email, a.password);
      const { data: tid } = await ca.rpc('fn_chat_create_or_get_dm' as any, {
        p_other_user_id: b.userId,
      });
      threadId = String(tid);

      // أ يرسل رسالة
      await ca.from('chat_messages').insert({
        thread_id: threadId, sender_id: a.userId, body: 'مرحباً',
      } as any);

      // ب يرى الرسالة
      const cb = await userClient(b.email, b.password);
      const { data: bMsgs } = await cb.from('chat_messages').select('id, body').eq('thread_id', threadId);
      expect(bMsgs?.length).toBeGreaterThan(0);
      expect(bMsgs?.[0].body).toBe('مرحباً');

      // ج لا يرى شيئاً
      const cc = await userClient(c.email, c.password);
      const { data: cMsgs } = await cc.from('chat_messages').select('id').eq('thread_id', threadId);
      expect(cMsgs ?? []).toHaveLength(0);

      // ج لا يستطيع الإرسال (RLS يرفض)
      const insertResult = await cc.from('chat_messages').insert({
        thread_id: threadId, sender_id: c.userId, body: 'متطفّل',
      } as any);
      expect(insertResult.error).not.toBeNull();
    } finally {
      if (threadId) await admin.from('chat_threads').delete().eq('id', threadId);
      await deleteTestUser(a.userId);
      await deleteTestUser(b.userId);
      await deleteTestUser(c.userId);
    }
  });

  test('storage: لا يمكن رفع ملف بمسار خاطئ في chat-attachments', async () => {
    const u = await createTestUser({
      prefix: 'sec-storage', fullName: 'مستخدم تخزين',
      permissions: [{ screen: 'chat', action: 'view' }],
    });
    try {
      const c = await userClient(u.email, u.password);
      // محاولة رفع بمسار غير صحيح (يدّعي أنه عضو في thread وهمي)
      const fakeBuffer = new Uint8Array([1, 2, 3]);
      const { error } = await c.storage
        .from('chat-attachments')
        .upload('00000000-0000-0000-0000-000000000000/' + u.userId + '/fake.txt', fakeBuffer);
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/policy|denied|unauthorized/i);
    } finally {
      await deleteTestUser(u.userId);
    }
  });
});
