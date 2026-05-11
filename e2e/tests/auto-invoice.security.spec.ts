import { test, expect } from '@playwright/test';
import { adminClient } from '../helpers/auth';

/**
 * اختبار تكاملي على fn_generate_invoice_for_job
 *
 * عند انتقال الوظيفة إلى completed:
 *   - يجب توليد فاتورة جديدة تلقائياً
 *   - السطور تُنسخ من document_lines الخاصة بالوظيفة
 *   - إذا كانت كل السطور مغطاة (UG أو CW مع 0) → الفاتورة zero_charge
 *   - الفاتورة zero_charge تُعيَّن مباشرةً كـ paid
 *   - الفاتورة العادية تبدأ بـ status = 'issued' وbalance = total
 */

test.describe('توليد الفواتير التلقائي', () => {
  let customerId: string;
  let createdJobIds: string[] = [];
  let createdInvoiceIds: string[] = [];

  test.beforeAll(async () => {
    const admin = adminClient();
    const { data: cust } = await admin.from('customers').insert({
      name_ar: 'عميل فوترة', code: `INV-${Date.now()}`,
    } as any).select('id').single();
    customerId = cust!.id;
  });

  test.afterAll(async () => {
    const admin = adminClient();
    if (createdInvoiceIds.length) await admin.from('invoices').delete().in('id', createdInvoiceIds);
    if (createdJobIds.length) await admin.from('jobs').delete().in('id', createdJobIds);
    await admin.from('customers').delete().eq('id', customerId);
  });

  test('وظيفة بسطور CASH تُنتج فاتورة بـ status=issued ورصيد كامل', async () => {
    const admin = adminClient();
    const { data: job } = await admin.from('jobs').insert({
      customer_id: customerId, status: 'work_started', problem_code: 'no_cooling',
    } as any).select('id').single();
    createdJobIds.push(job!.id);

    // إضافة سطر سعر 30.000
    await admin.from('document_lines').insert({
      job_id: job!.id, line_type: 'custom', description_ar: 'عمل', description_en: 'Work',
      quantity: 1, unit_price: 30.000, contract_type: 'CASH',
    } as any);

    // إكمال الوظيفة
    await admin.from('jobs').update({
      status: 'completed', completed_at: new Date().toISOString(),
      technician_signature_path: 'test/sig.png',
    } as any).eq('id', job!.id);

    // توليد الفاتورة
    const { data: invId } = await admin.rpc('fn_generate_invoice_for_job' as any, {
      p_job_id: job!.id,
    });
    expect(invId).toBeTruthy();
    createdInvoiceIds.push(String(invId));

    const { data: inv } = await admin.from('invoices').select('*').eq('id', invId).single();
    expect(inv?.status).toBe('issued');
    expect(Number(inv?.total_amount)).toBe(30.000);
    expect(Number(inv?.balance)).toBe(30.000);
    expect(Number(inv?.amount_paid)).toBe(0);
    expect(inv?.is_zero_charge).toBe(false);
  });

  test('وظيفة بسطور UG (مغطاة بالكامل) تُنتج فاتورة zero_charge مدفوعة', async () => {
    const admin = adminClient();
    const { data: job } = await admin.from('jobs').insert({
      customer_id: customerId, status: 'work_started', problem_code: 'no_cooling',
    } as any).select('id').single();
    createdJobIds.push(job!.id);

    // كل السطور بـ unit_price=0 (UG)
    await admin.from('document_lines').insert({
      job_id: job!.id, line_type: 'custom', description_ar: 'تحت الضمان',
      description_en: 'Under guarantee', quantity: 1, unit_price: 0, contract_type: 'UG',
    } as any);

    await admin.from('jobs').update({
      status: 'completed', completed_at: new Date().toISOString(),
      technician_signature_path: 'test/sig.png',
    } as any).eq('id', job!.id);

    const { data: invId } = await admin.rpc('fn_generate_invoice_for_job' as any, {
      p_job_id: job!.id,
    });
    createdInvoiceIds.push(String(invId));

    const { data: inv } = await admin.from('invoices').select('*').eq('id', invId).single();
    expect(inv?.is_zero_charge).toBe(true);
    expect(inv?.status).toBe('paid');
    expect(Number(inv?.balance)).toBe(0);
  });

  test('استدعاء التوليد مرتين على نفس الوظيفة لا يُنتج فاتورة مكررة', async () => {
    const admin = adminClient();
    const { data: job } = await admin.from('jobs').insert({
      customer_id: customerId, status: 'work_started', problem_code: 'no_cooling',
    } as any).select('id').single();
    createdJobIds.push(job!.id);

    await admin.from('document_lines').insert({
      job_id: job!.id, line_type: 'custom', description_ar: 'مكرر',
      description_en: 'Duplicate test', quantity: 1, unit_price: 10.000, contract_type: 'CASH',
    } as any);

    await admin.from('jobs').update({
      status: 'completed', completed_at: new Date().toISOString(),
      technician_signature_path: 'test/sig.png',
    } as any).eq('id', job!.id);

    const { data: invId1 } = await admin.rpc('fn_generate_invoice_for_job' as any, {
      p_job_id: job!.id,
    });
    createdInvoiceIds.push(String(invId1));

    // استدعاء ثانٍ — يجب أن يُعيد نفس الفاتورة (idempotent)
    const { data: invId2 } = await admin.rpc('fn_generate_invoice_for_job' as any, {
      p_job_id: job!.id,
    });
    expect(invId1).toBe(invId2);
  });
});
