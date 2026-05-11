import { requireScreen } from '@/lib/auth/require-screen';
import { MachineBrandsRepository } from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations } from 'next-intl/server';
import { SimpleMasterClient } from '@/components/masters/simple-master-client';

export const dynamic = 'force-dynamic';

export default async function MachineBrandsPage() {
  const ctx = await requireScreen('machine_brands', 'view');
  const repo = new MachineBrandsRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);
  const [rows, total, canAdd, canEdit] = await Promise.all([
    repo.list({ limit: 200 }),
    repo.count(),
    perms.can('machine_brands', 'add'),
    perms.can('machine_brands', 'edit'),
  ]);
  const t = await getTranslations();
  return (
    <SimpleMasterClient
      title={t('masters.machineBrands')}
      rows={rows}
      total={total}
      canAdd={canAdd}
      canEdit={canEdit}
      apiPath="/api/masters/machine-brands"
      defaultValues={{ name: '', country_origin: '', is_active: true }}
      fields={[
        { name: 'name', label: t('common.name'), required: true, dir: 'ltr' },
        { name: 'country_origin', label: t('masters.countryOrigin'), dir: 'ltr' },
        { name: 'is_active', label: t('common.active'), type: 'switch' },
      ]}
      columns={[
        { key: 'name', header: t('common.name'), cell: (r) => <span className="font-medium">{r.name}</span> },
        { key: 'country_origin', header: t('masters.countryOrigin'), cell: (r) => r.country_origin ?? '—' },
        { key: 'is_active', header: t('common.status'), align: 'center',
          cell: (r) => r.is_active ? (
            <span className="inline-block px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs">{t('common.active')}</span>
          ) : (<span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">{t('common.inactive')}</span>),
        },
      ]}
    />
  );
}
