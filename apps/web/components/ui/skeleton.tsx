/**
 * Skeleton — placeholder متحرّك يُعرض أثناء تحميل البيانات.
 *
 * أمثلة:
 *   <Skeleton className="h-4 w-32" />            // سطر نص
 *   <Skeleton className="h-10 w-full" />         // input
 *   <Skeleton className="h-32 w-32 rounded-full" />  // صورة دائرية
 */

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200 dark:bg-gray-700 ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
}

/**
 * SkeletonRow — صف جدول كامل (يستخدم في DataTable loading state).
 */
export function SkeletonRow({ columns = 4 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

/**
 * SkeletonCard — بطاقة كاملة (للـ widgets في dashboard).
 */
export function SkeletonCard() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

/**
 * SkeletonList — قائمة جاهزة (للقوائم بدون جدول).
 */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 rounded-lg border">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
