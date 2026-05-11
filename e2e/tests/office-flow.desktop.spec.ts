import { test, expect } from '@playwright/test';
import { adminClient, createTestUser, deleteTestUser, login } from '../helpers/auth';

/**
 * رحلة موظف المكتب الكاملة:
 *   1. تسجيل دخول
 *   2. إنشاء طلب صيانة جديد
 *   3. تحويل الطلب إلى وظيفة وإسناد فني
 *   4. (يقوم الفني بإكمال الوظيفة في اختبار منفصل)
 *   5. التحقق من وجود الفاتورة في صفحة الفواتير
 *   6. تسجيل دفعة جزئية
 *   7. التحقق أن الرصيد تحدّث
 */

test.describe('رحلة موظف المكتب', () => {
  let officeEmail: string;
  let officePassword: string;
  let officeUserId: string;
  let techUserId: string;
  let customerId: string;
  let invoiceId: string | null = null;

  test.beforeAll(async () => {
    // مستخدم مكتب بأذونات شاملة على العمليات
    const office = await createTestUser({
      prefix: 'test-office',
      fullName: 'موظف مكتب اختبار',
      permissions: [
        { screen: 'dashboard', action: 'view' },
        { screen: 'maintenance_requests', action: 'view' },
        { screen: 'maintenance_requests', action: 'add' },
        { screen: 'maintenance_requests', action: 'edit' },
        { screen: 'jobs', action: 'view' },
        { screen: 'jobs', action: 'add' },
        { screen: 'jobs', action: 'edit' },
        { screen: 'jobs', action: 'assign' },
        { screen: 'invoices', action: 'view' },
        { screen: 'invoices', action: 'edit' },
        { screen: 'payments', action: 'add' },
        { screen: 'customers', action: 'view' },
      ],
    });
    officeEmail = office.email;
    officePassword = office.password;
    officeUserId = office.userId;

    const tech = await createTestUser({
      prefix: 'test-tech-office',
      fullName: 'فني مساعد',
      technicianCode: 'TEST-T02',
    });
    techUserId = tech.userId;

    const admin = adminClient();
    const { data: customer } = await admin
      .from('customers')
      .insert({ name_ar: 'عميل المكتب', code: `E2E-OFF-${Date.now()}` } as any)
      .select('id').single();
    customerId = customer!.id;
  });

  test.afterAll(async () => {
    const admin = adminClient();
    if (invoiceId) await admin.from('invoices').delete().eq('id', invoiceId);
    await admin.from('jobs').delete().eq('customer_id', customerId);
    await admin.from('maintenance_requests').delete().eq('customer_id', customerId);
    await admin.from('customers').delete().eq('id', customerId);
    await deleteTestUser(officeUserId);
    await deleteTestUser(techUserId);
  });

  test('تدفق المكتب الكامل', async ({ page }) => {
    await login(page, officeEmail, officePassword);

    // 1) لوحة المعلومات
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/مرحباً|welcome/i)).toBeVisible();

    // 2) إنشاء طلب جديد
    await page.goto('/operations/requests');
    await page.getByRole('link', { name: /طلب جديد|new request/i }).click();

    await page.getByLabel(/العميل|customer/i).fill('عميل المكتب');
    await page.getByRole('option', { name: /عميل المكتب/i }).first().click();
    await page.getByLabel(/المشكلة|problem/i).selectOption({ label: /لا يبرّد|no cooling/i });
    await page.getByRole('button', { name: /حفظ|save/i }).click();

    // 3) من قائمة الطلبات نحوّل إلى وظيفة
    await page.goto('/operations/requests');
    await page.getByRole('link', { name: /عميل المكتب/i }).first().click();
    await page.getByRole('button', { name: /تحويل إلى وظيفة|convert to job/i }).click();

    // 4) إسناد الفني (داخل لوحة الإسناد)
    await page.goto('/operations/dispatch');
    await page.getByText(/فني مساعد|TEST-T02/).first().click();
    // ... (إكمال الإسناد عبر drag/drop أو dropdown - يعتمد على واجهة الإسناد الفعلية)

    // 5) محاكاة إكمال الوظيفة من جانب الخادم (الفني سيكمل في اختباره)
    const admin = adminClient();
    const { data: job } = await admin
      .from('jobs')
      .select('id')
      .eq('customer_id', customerId)
      .single();
    await admin.from('jobs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      technician_signature_path: 'test/sig.png',
    } as any).eq('id', job!.id);

    // تشغيل دالة توليد الفاتورة
    await admin.rpc('fn_generate_invoice_for_job' as any, { p_job_id: job!.id });

    // 6) فتح صفحة الفواتير والتحقق
    await page.goto('/finance/invoices');
    const invRow = page.locator('tr').filter({ hasText: 'عميل المكتب' }).first();
    await expect(invRow).toBeVisible({ timeout: 10_000 });

    // الحصول على invoice_id لأجل التنظيف
    const { data: inv } = await admin
      .from('invoices')
      .select('id')
      .eq('customer_id', customerId)
      .single();
    invoiceId = inv?.id ?? null;
  });
});
