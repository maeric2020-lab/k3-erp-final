import { SkeletonList } from '@/components/ui/skeleton';

/**
 * شاشة تحميل لكل الصفحات داخل (authed).
 */
export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-40 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
      </div>
      <SkeletonList rows={6} />
    </div>
  );
}
