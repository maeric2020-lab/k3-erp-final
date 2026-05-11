import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BackButton } from '@/components/nav/back-button';

interface PageProps {
  searchParams: { screen?: string; action?: string };
}

export default async function ForbiddenPage({ searchParams }: PageProps) {
  const t = await getTranslations('common');
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>403</CardTitle>
          <CardDescription>{t('permissionDenied')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(searchParams.screen || searchParams.action) && (
            <p className="text-xs text-muted-foreground">
              {searchParams.screen} · {searchParams.action}
            </p>
          )}
          <BackButton href="/dashboard" />
        </CardContent>
      </Card>
    </div>
  );
}
