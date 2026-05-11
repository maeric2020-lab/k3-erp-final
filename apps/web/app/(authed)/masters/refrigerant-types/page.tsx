import { requireScreen } from '@/lib/auth/require-screen';
import { RefrigerantTypesRepository } from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations } from 'next-intl/server';
import { SimpleMasterClient } from '@/components/masters/simple-master-client';

export const dynamic = 'force-dynamic';

export default async function RefrigerantTypesPage() {
  const ctx = await requireScreen('machines_master', 'view');
  const repo = new RefrigerantTypesRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);
  const [rows, total, canEdit] = await Promise.all([
    repo.list({ limit: 200 }),
    repo.count(),
    perms.can('machines_master', 'edit'),
  ]);
  const t = await getTranslations();
  return (
    <SimpleMasterClient
      title={t('masters.refrigerantTypes')}
      rows={rows}
      total={total}
      canAdd={canEdit}
      canEdit={canEdit}
      apiPath="/api/masters/refrigerant-types"
      defaultValues={{ code: '', name: '', is_active: true }}
      fields={[
        { name: 'code', label: t('common.code'), required: true, dir: 'ltr', placeholder: 'R410A' },
        { name: 'name', label: t('common.name'), required: true, dir: 'ltr' },
        { name: 'is_active', label: t('common.active'), type: 'switch' },
      ]}
      columns={[
        { key: 'code', header: t('common.code'), className: 'w-32 font-mono' },
        { key: 'name', header: t('common.name'), cell: (r) => <span className="font-medium">{r.name}</span> },
        { key: 'is_active', header: t('common.status'), align: 'center',
          cell: (r) => r.is_active ? (
            <span className="inline-block px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs">{t('common.active')}</span>
          ) : (<span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">{t('common.inactive')}</span>),
        },
      ]}
    />
  );
}
