'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function AuthedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Authed page error:', error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-12 flex items-center justify-center">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50 text-red-600">
          <AlertTriangle size={28} />
        </div>
        <h2 className="text-xl font-semibold">حدث خطأ في تحميل الصفحة</h2>
        <p className="text-gray-600 text-sm">
          نعتذر، حصلت مشكلة. يمكنك إعادة المحاولة أو العودة للوحة التحكم.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 font-mono">رمز الخطأ: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm"
          >
            <RefreshCw size={14} />
            إعادة المحاولة
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 text-sm"
          >
            <Home size={14} />
            لوحة التحكم
          </Link>
        </div>
      </div>
    </div>
  );
}
