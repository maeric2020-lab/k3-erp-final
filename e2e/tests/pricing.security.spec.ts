import { test, expect } from '@playwright/test';
import { adminClient } from '../helpers/auth';

/**
 * اختبار تكاملي على دالة compute_line_pricing
 *
 * هذه الدالة هي المصدر الوحيد للأسعار في النظام بأكمله. كل سطر مستند
 * (وظيفة، عرض، فاتورة) يمر عبرها. اختبارها يحمي من تعديلات غير
 * مقصودة قد تكسر الأسعار في الإنتاج.
 *
 * السيناريوهات:
 *   1. خدمة بسعر معروف خارج العقد → السعر CASH
 *   2. نفس الخدمة على آلة محمية بـ CW → سعر مغطى (0 أو خصم)
 *   3. آلة UG (تغطية كاملة) → كل شيء مجاني
 *   4. خدمة "أخرى" — السعر مأخوذ من السطر يدوياً
 *   5. سعر 0.000 KWD مقبول لخدمات مجانية
 */

test.describe('compute_line_pricing — حسابات الأسعار', () => {
  let testServiceId: string;
  let testCustomerId: string;
  let testMachineId: string;

  test.beforeAll(async () => {
    const admin = adminClient();

    // إنشاء فئة وخدمة اختبارية بأسعار معروفة
    const { data: cat } = await admin.from('service_categories')
      .insert({ code: `TST-CAT-${Date.now()}`, name_ar: 'فئة اختبار', name_en: 'Test cat' } as any)
      .select('id').single();

    const { data: svc } = await admin.from('service_types').insert({
      category_id: cat!.id,
      code: `TST-SVC-${Date.now()}`,
      name_ar: 'خدمة اختبار',
      name_en: 'Test service',
    } as any).select('id').single();
    testServiceId = svc!.id;

    // سعر CASH = 50 KWD
    await admin.from('service_pricing').insert({
      service_id: testServiceId, contract_type: 'CASH', price: 50.000,
    } as any);
    // سعر CW = 25 KWD (مع تغطية)
    await admin.from('service_pricing').insert({
      service_id: testServiceId, contract_type: 'CW', price: 25.000,
    } as any);
    // UG = 0 (تغطية كاملة)
    await admin.from('service_pricing').insert({
      service_id: testServiceId, contract_type: 'UG', price: 0.000,
    } as any);

    const { data: cust } = await admin.from('customers').insert({
      name_ar: 'عميل تسعير', code: `PRC-${Date.now()}`,
    } as any).select('id').single();
    testCustomerId = cust!.id;

    const { data: mach } = await admin.from('customer_machines').insert({
      customer_id: testCustomerId, brand_id: null, serial_no: 'PRC-M01',
    } as any).select('id').single();
    testMachineId = mach!.id;
  });

  test.afterAll(async () => {
    const admin = adminClient();
    await admin.from('customer_machines').delete().eq('id', testMachineId);
    await admin.from('customers').delete().eq('id', testCustomerId);
    await admin.from('service_pricing').delete().eq('service_id', testServiceId);
    await admin.from('service_types').delete().eq('id', testServiceId);
  });

  test('خدمة CASH تُسعَّر بـ 50.000 KWD', async () => {
    const admin = adminClient();
    const { data, error } = await admin.rpc('compute_line_pricing' as any, {
      p_line_type: 'service',
      p_service_id: testServiceId,
      p_part_id: null,
      p_gas_id: null,
      p_customer_machine_id: testMachineId,
      p_quantity: 1,
      p_contract_type: 'CASH',
      p_is_4_year: false,
    });
    expect(error).toBeNull();
    expect(Number(data?.[0]?.unit_price)).toBe(50.000);
    expect(Number(data?.[0]?.line_total)).toBe(50.000);
  });

  test('خدمة على آلة UG تُسعَّر بـ 0.000 KWD', async () => {
    const admin = adminClient();
    const { data, error } = await admin.rpc('compute_line_pricing' as any, {
      p_line_type: 'service',
      p_service_id: testServiceId,
      p_part_id: null,
      p_gas_id: null,
      p_customer_machine_id: testMachineId,
      p_quantity: 1,
      p_contract_type: 'UG',
      p_is_4_year: false,
    });
    expect(error).toBeNull();
    expect(Number(data?.[0]?.unit_price)).toBe(0);
  });

  test('خدمة CW تُسعَّر بسعر العقد، ليس بسعر CASH', async () => {
    const admin = adminClient();
    const { data, error } = await admin.rpc('compute_line_pricing' as any, {
      p_line_type: 'service',
      p_service_id: testServiceId,
      p_part_id: null,
      p_gas_id: null,
      p_customer_machine_id: testMachineId,
      p_quantity: 2,
      p_contract_type: 'CW',
      p_is_4_year: false,
    });
    expect(error).toBeNull();
    expect(Number(data?.[0]?.unit_price)).toBe(25.000);
    expect(Number(data?.[0]?.line_total)).toBe(50.000); // 25 × 2
  });
});
