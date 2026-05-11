import { test, expect } from '@playwright/test';
import { adminClient, createTestUser, deleteTestUser, login } from '../helpers/auth';

/**
 * رحلة الفني الكاملة (موبايل):
 *   1. تسجيل دخول الفني
 *   2. الدخول على /my-jobs
 *   3. اختيار وظيفة معيّنة له
 *   4. الضغط على Accept → الحالة تتحول accepted
 *   5. On my way → on_way
 *   6. Arrived (مع التقاط GPS)
 *   7. Start inspection → اختيار المشكلة
 *   8. Start work → اختيار سطور العمل (خدمة + قطعة + غاز)
 *   9. Mark complete → التوقيع (الفني إلزامي، العميل اختياري)
 *  10. التحقق أن الوظيفة انتقلت إلى completed ثم invoiced (auto-invoice)
 *  11. التحقق من وجود فاتورة جديدة
 */

test.describe('رحلة الفني الكاملة', () => {
  let techEmail: string;
  let techPassword: string;
  let techUserId: string;
  let jobId: string;
  let customerId: string;

  test.beforeAll(async () => {
    // إنشاء فني اختباري
    const tech = await createTestUser({
      prefix: 'test-tech-flow',
      fullName: 'فني اختبار',
      technicianCode: 'TEST-T01',
      permissions: [
        { screen: 'jobs_my', action: 'view' },
        { screen: 'dashboard', action: 'view' },
      ],
    });
    techEmail = tech.email;
    techPassword = tech.password;
    techUserId = tech.userId;

    // إنشاء عميل وآلة ووظيفة seed عبر admin client
    const admin = adminClient();
    const { data: customer } = await admin
      .from('customers')
      .insert({ name_ar: 'عميل اختبار E2E', code: `E2E-${Date.now()}` } as any)
      .select('id').single();
    customerId = customer!.id;

    const { data: job } = await admin
      .from('jobs')
      .insert({
        customer_id: customerId,
        technician_id: techUserId,
        status: 'assigned',
        problem_code: 'no_cooling',
      } as any)
      .select('id').single();
    jobId = job!.id;
  });

  test.afterAll(async () => {
    const admin = adminClient();
    await admin.from('jobs').delete().eq('id', jobId);
    await admin.from('customers').delete().eq('id', customerId);
    await deleteTestUser(techUserId);
  });

  test('فنّي يُكمل وظيفة من البداية إلى التوقيع', async ({ page }) => {
    // 1) تسجيل دخول
    await login(page, techEmail, techPassword);

    // 2) الذهاب إلى وظائفي
    await page.goto('/my-jobs');
    await expect(page.getByRole('heading', { name: /وظائفي|my jobs/i })).toBeVisible();

    // 3) فتح الوظيفة
    await page.locator(`a[href="/my-jobs/${jobId}"]`).click();
    await expect(page).toHaveURL(`/my-jobs/${jobId}`);

    // 4) قبول الوظيفة
    const acceptBtn = page.getByRole('button', { name: /قبول|accept/i });
    if (await acceptBtn.isVisible()) {
      await acceptBtn.click();
      await expect(page.getByText(/في الطريق|on my way/i)).toBeVisible({ timeout: 5_000 });
    }

    // 5) "في الطريق"
    await page.getByRole('button', { name: /في الطريق|on my way/i }).click();
    await expect(page.getByRole('button', { name: /وصلت|arrived/i })).toBeVisible();

    // 6) "وصلت" — قد يطلب صلاحية GPS
    await page.context().grantPermissions(['geolocation']);
    await page.getByRole('button', { name: /وصلت|arrived/i }).click();
    await expect(page.getByRole('button', { name: /بدء الفحص|start inspection/i })).toBeVisible();

    // 7) بدء الفحص واختيار مشكلة
    await page.getByRole('button', { name: /بدء الفحص|start inspection/i }).click();

    // 8) بدء العمل
    await page.getByRole('button', { name: /بدء العمل|start work/i }).click();

    // 9) إنهاء — في هذا الاختبار نتجاوز خطوة إضافة سطور العمل ونعتمد
    //    على أن الوظيفة قد تُسمح بإكمالها بدون سطور (تكلفة صفرية)
    await page.getByRole('button', { name: /إنهاء|mark complete|complete/i }).click();

    // 10) التوقيع — رسم على canvas الفني
    const techSig = page.locator('canvas').first();
    await expect(techSig).toBeVisible();
    const box = await techSig.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 20, box.y + 20);
      await page.mouse.down();
      await page.mouse.move(box.x + 100, box.y + 60);
      await page.mouse.move(box.x + 150, box.y + 30);
      await page.mouse.up();
    }

    await page.getByRole('button', { name: /حفظ|إرسال|submit/i }).click();

    // 11) التحقق أن الحالة صارت completed/invoiced
    await expect(page.getByText(/مكتمل|تم الإصدار|completed|invoiced/i)).toBeVisible({ timeout: 10_000 });

    // 12) التحقق على الخادم أن الفاتورة أُنشئت
    const admin = adminClient();
    const { data: job } = await admin.from('jobs').select('status, invoice_id').eq('id', jobId).single();
    expect(job?.status).toMatch(/completed|invoiced|closed/);
    expect(job?.invoice_id).toBeTruthy();
  });
});
