'use client';
import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from './language-toggle';
import { NotificationBell } from './notification-bell';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export interface BreadcrumbItem {
  href?: string;
  label: string;
}

interface TopbarProps {
  breadcrumb: BreadcrumbItem[];
  userName?: string;
  userId?: string;
}

export function Topbar({ breadcrumb, userName, userId }: TopbarProps) {
  const t = useTranslations('common');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function signOut() {
    const supabase = createSupabaseBrowserClient();
    startTransition(async () => {
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    });
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-6">
      <nav aria-label="Breadcrumb" className="flex-1 text-sm text-muted-foreground">
        <ol className="flex items-center gap-2">
          {breadcrumb.map((item, idx) => {
            const isLast = idx === breadcrumb.length - 1;
            return (
              <li key={`${item.label}-${idx}`} className="flex items-center gap-2">
                {idx > 0 && <span aria-hidden="true">/</span>}
                {item.href && !isLast ? (
                  <Link href={item.href} className="hover:text-foreground">
                    {item.label}
                  </Link>
                ) : (
                  <span className={isLast ? 'text-foreground font-medium' : ''}>{item.label}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex items-center gap-2">
        {userName && <span className="text-sm text-muted-foreground hidden sm:inline">{userName}</span>}
        {userId && <NotificationBell userId={userId} locale={locale} />}
        <LanguageToggle />
        <Button variant="ghost" size="sm" onClick={signOut} disabled={isPending} className="gap-2">
          <LogOut className="h-4 w-4" />
          <span>{t('logout')}</span>
        </Button>
      </div>
    </header>
  );
}
