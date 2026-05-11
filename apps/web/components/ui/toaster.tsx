'use client';

/**
 * مكوّن Toaster — يعرض قائمة الـ toasts المتراكمة.
 * يُوضَع مرة واحدة في root layout.
 */

import { useToast, type ToastType } from '@/lib/toast';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ICONS: Record<ToastType, React.ComponentType<{ size?: number; className?: string }>> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES: Record<ToastType, string> = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none"
      role="region"
      aria-label="إشعارات"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.type];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-3 rounded-lg border shadow-lg animate-in fade-in slide-in-from-top-2 ${STYLES[t.type]}`}
            role="alert"
          >
            <Icon size={20} className="shrink-0 mt-0.5" />
            <div className="flex-1 text-sm font-medium">{t.message}</div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="إخفاء"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
