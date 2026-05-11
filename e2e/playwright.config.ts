import { defineConfig, devices } from '@playwright/test';

/**
 * تكوين Playwright لمشروع K3 ERP
 *
 * ملاحظات:
 *   - الاختبارات تعمل على بيئة staging، ليست على الإنتاج.
 *   - متغيرات البيئة المطلوبة:
 *       BASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   - الاختبارات الموبايل تستخدم viewport iPhone 13 لأن الفنيين يستخدمون
 *     الهواتف المحمولة في الميدان.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,             // تجنّب تعارضات على بيانات seed المشتركة
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], locale: 'ar-KW' },
      testMatch: /.*\.desktop\.spec\.ts/,
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'], locale: 'ar-KW' },
      testMatch: /.*\.mobile\.spec\.ts/,
    },
    {
      name: 'security',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\.security\.spec\.ts/,
    },
  ],
});
