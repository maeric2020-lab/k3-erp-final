'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BackButtonProps {
  href?: string;
  label?: string;
}

/**
 * Universal back button. In RTL the arrow points right; in LTR it points left.
 * Use `href` for declarative back-to-list behavior; omit it to go back in history.
 */
export function BackButton({ href, label }: BackButtonProps) {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const Icon = locale === 'ar' ? ArrowRight : ArrowLeft;
  const text = label ?? t('back');

  if (href) {
    return (
      <Button asChild variant="ghost" size="sm" className="gap-2">
        <Link href={href}>
          <Icon className="h-4 w-4" />
          <span>{text}</span>
        </Link>
      </Button>
    );
  }
  return (
    <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => router.back()}>
      <Icon className="h-4 w-4" />
      <span>{text}</span>
    </Button>
  );
}
