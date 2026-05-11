'use client';

/**
 * يُسجّل service worker على المتصفح بعد تحميل الصفحة.
 * يُوضع في root layout (داخل client component).
 *
 * ملاحظات:
 *   - لا يعمل في dev mode افتراضياً (يحتاج HTTPS؛ Vercel يوفّره)
 *   - لا يعمل على Safari iOS قبل 16.4 (PWA notifications محدودة)
 */

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;  // dev: تعطيل

    const handler = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          logger.info('sw.registered', { scope: registration.scope });

          // فحص دوري للتحديثات (كل ساعة)
          setInterval(() => {
            registration.update().catch(() => {});
          }, 60 * 60 * 1000);

          // إذا وُجد update، أبلغ المستخدم
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // نسخة جديدة جاهزة — نُلمح بإعادة التحميل
                logger.info('sw.update_available');
              }
            });
          });
        })
        .catch((err) => {
          logger.error('sw.register_failed', err);
        });
    };

    if (document.readyState === 'complete') handler();
    else window.addEventListener('load', handler);

    return () => window.removeEventListener('load', handler);
  }, []);

  return null;
}
