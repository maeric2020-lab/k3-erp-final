'use client';
import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isLocale, type Locale } from '@/lib/i18n/config';

/**
 * Toggles between AR (RTL) and EN (LTR) by setting the NEXT_LOCALE cookie
 * and refreshing the route. The new layout/dir takes effect on next render.
 */
export function LanguageToggle() {
  const current = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setLocale(next: Locale) {
    if (next === current) return;
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  const target: Locale = isLocale(current) && current === 'ar' ? 'en' : 'ar';
  const targetLabel = target === 'ar' ? 'العربية' : 'English';

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => setLocale(target)}
      disabled={isPending}
      aria-label="Toggle language"
      className="gap-2"
    >
      <Languages className="h-4 w-4" />
      <span>{targetLabel}</span>
    </Button>
  );
}
