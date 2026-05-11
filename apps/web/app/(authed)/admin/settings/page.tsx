import { getTranslations } from 'next-intl/server';
import { requireScreen } from '@/lib/auth/require-screen';
import { Topbar } from '@/components/nav/topbar';
import { CompanySettingsRepository } from '@k3/repositories';
import { CompanySettingsForm } from './settings-form';

export const dynamic = 'force-dynamic';

export default async function CompanySettingsPage() {
  const ctx = await requireScreen('company_settings', 'view', '/admin/settings');
  const t = await getTranslations('nav');
  const tSettings = await getTranslations('companySettings');

  const repo = new CompanySettingsRepository(ctx.supabase);
  const settings = await repo.get();
  const logoUrl = await repo.getLogoPublicUrl();

  return (
    <>
      <Topbar
        breadcrumb={[
          { href: '/dashboard', label: t('dashboard') },
          { href: '/admin', label: t('admin') },
          { label: tSettings('title') },
        ]}
        userId={ctx.profile.id}
      />
      <div className="container max-w-3xl flex-1 px-6 py-6">
        <CompanySettingsForm initial={settings} initialLogoUrl={logoUrl} />
      </div>
    </>
  );
}
