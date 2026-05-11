import { requireScreen } from '@/lib/auth/require-screen';
import { SparePartCategoriesRepository } from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations } from 'next-intl/server';
import { SimpleMasterClient } from '@/components/masters/simple-master-client';

export const dynamic = 'force-dynamic';

export default async function SparePartCategoriesPage() {
  const ctx = await requireScreen('spare_part_categories', 'view');
  const repo = new SparePartCategoriesRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);
  const [rows, total, canEdit] = await Promise.all([
    repo.list({ limit: 200 }),
    repo.count(),
    perms.can('spare_part_categories', 'edit'),
  ]);
  const t = await getTranslations();
  return (
    <SimpleMasterClient
      title={t('masters.sparePartCategories')}
      rows={rows}
      total={total}
      canAdd={canEdit}
      canEdit={canEdit}
      apiPath="/api/masters/spare-part-categories"
      defaultValues={{ code: '', name_ar: '', name_en: '', display_order: 0, is_active: true }}
      fields={[
        { name: 'code', label: t('common.code'), required: true, dir: 'ltr', placeholder: 'COMPRESSOR' },
        { name: 'name_ar', label: t('common.name_ar'), required: true, dir: 'rtl' },
        { name: 'name_en', label: t('common.name_en'), required: true, dir: 'ltr' },
        { name: 'display_order', label: t('masters.displayOrder'), type: 'number' },
        { name: 'is_active', label: t('common.active'), type: 'switch' },
      ]}
      columns={[
        { key: 'code', header: t('common.code'), className: 'w-32 font-mono text-xs' },
        { key: 'name_ar', header: t('common.name_ar'), cell: (r) => <span className="font-medium">{r.name_ar}</span> },
        { key: 'name_en', header: t('common.name_en') },
        { key: 'display_order', header: t('masters.displayOrder'), align: 'center', hideOnMobile: true },
        { key: 'is_active', header: t('common.status'), align: 'center',
          cell: (r) => r.is_active ? (
            <span className="inline-block px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs">{t('common.active')}</span>
          ) : (<span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">{t('common.inactive')}</span>),
        },
      ]}
    />
  );
}
