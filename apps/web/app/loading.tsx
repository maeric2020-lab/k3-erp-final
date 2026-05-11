import { SkeletonCard } from '@/components/ui/skeleton';

/**
 * شاشة تحميل عامّة.
 * Next.js يعرضها تلقائياً أثناء تحميل أي صفحة في هذا الـ tree.
 */
export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
