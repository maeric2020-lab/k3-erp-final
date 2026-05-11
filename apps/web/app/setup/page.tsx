import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { SetupService } from '@k3/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/nav/language-toggle';
import { SetupForm } from './setup-form';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  const t = await getTranslations('setup');
  const admin = createSupabaseAdminClient();
  const setup = new SetupService(admin);
  const needsSetup = await setup.needsSetup();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/30 p-6">
      <div className="absolute end-4 top-4">
        <LanguageToggle />
      </div>

      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{needsSetup ? t('title') : t('alreadyConfigured')}</CardTitle>
          <CardDescription>{needsSetup ? t('subtitle') : t('alreadyConfiguredHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          {needsSetup ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">{t('description')}</p>
              <SetupForm />
            </>
          ) : (
            <Button asChild>
              <Link href="/login">{t('goToLogin')}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
