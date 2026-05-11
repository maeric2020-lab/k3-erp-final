import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageToggle } from '@/components/nav/language-toggle';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

interface LoginPageProps {
  searchParams: { reason?: string; redirect?: string };
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const t = await getTranslations('login');

  let banner: string | null = null;
  if (searchParams.reason === 'inactive') banner = t('userInactive');
  if (searchParams.reason === 'archived') banner = t('userInactive');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/30 p-6">
      <div className="absolute end-4 top-4">
        <LanguageToggle />
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>K3 ERP — K. Three Co.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {banner && (
            <Alert variant="destructive">
              <AlertDescription>{banner}</AlertDescription>
            </Alert>
          )}
          <LoginForm redirectTo={searchParams.redirect ?? '/dashboard'} />
        </CardContent>
      </Card>
    </div>
  );
}
