'use client';

/**
 * نظام Toast بسيط مبني داخلياً (بدون مكتبات خارجية).
 *
 * الاستخدام:
 *   import { toast } from '@/lib/toast';
 *   toast.success('تم الحفظ');
 *   toast.error('فشل الإرسال');
 *   toast.info('جارٍ التحميل');
 *
 * يدعم:
 *   - أربعة أنواع: success / error / warning / info
 *   - auto-dismiss (3 ثوانٍ افتراضياً، 5 للأخطاء)
 *   - dismiss يدوي
 *   - RTL تلقائي عبر CSS
 *   - يصدر event يُلتقط من <Toaster />
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  add: (type: ToastType, message: string, duration?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  info: 3000,
  warning: 4000,
  error: 5000,
};

// نُصدِر toast عبر EventTarget كي يُستدعى من أي مكان (حتى خارج React tree)
class ToastEmitter extends EventTarget {
  emit(type: ToastType, message: string, duration?: number) {
    this.dispatchEvent(new CustomEvent('toast', { detail: { type, message, duration } }));
  }
}

const emitter: ToastEmitter = new ToastEmitter();

/** دوال الاستخدام السريع */
export const toast = {
  success: (message: string, duration?: number) => emitter.emit('success', message, duration),
  error: (message: string, duration?: number) => emitter.emit('error', message, duration),
  warning: (message: string, duration?: number) => emitter.emit('warning', message, duration),
  info: (message: string, duration?: number) => emitter.emit('info', message, duration),
};

/**
 * يُغلَّف الـ tree في root layout.
 * يستمع للأحداث من emitter ويُحدِّث القائمة الداخلية.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const add = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const finalDuration = duration ?? DEFAULT_DURATIONS[type];
    setToasts((prev) => [...prev, { id, type, message, duration: finalDuration }]);
    if (finalDuration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, finalDuration);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ type: ToastType; message: string; duration?: number }>;
      add(ce.detail.type, ce.detail.message, ce.detail.duration);
    };
    emitter.addEventListener('toast', handler);
    return () => emitter.removeEventListener('toast', handler);
  }, [add]);

  return (
    <ToastContext.Provider value={{ toasts, add, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast يجب أن يُستخدَم داخل ToastProvider');
  return ctx;
}
