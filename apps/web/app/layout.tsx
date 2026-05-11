import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { localeMetadata, type Locale } from '@/lib/i18n/config';
import { QueryProvider } from '@/components/providers/query-provider';
import { ToastProvider } from '@/lib/toast';
import { Toaster } from '@/components/ui/toaster';
import { ServiceWorkerRegister } from '@/components/pwa/sw-register';
import { OfflineSyncManager } from '@/components/pwa/offline-sync';
import './globals.css';

export const metadata: Metadata = {
  title: 'K3 ERP',
  description: 'شركة كي ثري — نظام إدارة قسم الصيانة',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'K3 ERP',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f766e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();
  const dir = localeMetadata[locale]?.dir ?? 'rtl';

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ToastProvider>
            <QueryProvider>{children}</QueryProvider>
            <Toaster />
            <ServiceWorkerRegister />
            <OfflineSyncManager />
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
