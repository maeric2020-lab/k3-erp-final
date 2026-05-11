import Link from 'next/link';
import { FileQuestion, Home } from 'lucide-react';

/**
 * صفحة 404 — تُعرَض عند الوصول لمسار غير موجود أو notFound().
 */
export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-500">
          <FileQuestion size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">الصفحة غير موجودة</h2>
          <p className="text-gray-600">
            الرابط الذي طلبته غير صحيح، أو أن الصفحة قد حُذفت أو نُقلت.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Home size={16} />
          العودة للصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}
