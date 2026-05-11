'use client';

/**
 * حدّ الأخطاء العام — Next.js يعرضه تلقائياً عند fail لأي صفحة.
 * يجب أن يكون 'use client' (Next.js requirement).
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // نسجّل الخطأ على client-side console للمساعدة في التصحيح
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 text-red-600">
          <AlertTriangle size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">حدث خطأ غير متوقَّع</h2>
          <p className="text-gray-600">
            نعتذر، حصلت مشكلة أثناء تحميل هذه الصفحة. يمكنك إعادة المحاولة أو العودة إلى الصفحة الرئيسية.
          </p>
          {error.digest && (
            <p className="text-xs text-gray-400 font-mono mt-4">
              رمز الخطأ: {error.digest}
            </p>
          )}
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={16} />
            إعادة المحاولة
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <Home size={16} />
            الصفحة الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
