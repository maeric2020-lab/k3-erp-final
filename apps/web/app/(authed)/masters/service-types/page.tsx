import { requireScreen } from '@/lib/auth/require-screen';
import { ServiceTypesRepository, ServiceCategoriesRepository } from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations, getLocale } from 'next-intl/server';
import { SimpleMasterClient } from '@/components/masters/simple-master-client';

export const dynamic = 'force-dynamic';

export default async function ServiceTypesPage() {
  const ctx = await requireScreen('service_types', 'view');
  const repo = new ServiceTypesRepository(ctx.supabase);
  const catRepo = new ServiceCategoriesRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);
  const [rows, total, cats, canEdit] = await Promise.all([
    repo.list({ limit: 500 }),
    repo.count(),
    catRepo.list({ active_only: true, limit: 100 }),
    perms.can('service_types', 'edit'),
  ]);
  const t = await getTranslations();
  const locale = await getLocale();
  const catLabel = (c: { name_ar: string; name_en: string }) => locale === 'ar' ? c.name_ar : c.name_en;
  const catMap = new Map(cats.map((c) => [c.id, c]));

  return (
    <SimpleMasterClient
      title={t('masters.serviceTypes')}
      rows={rows}
      total={total}
      canAdd={canEdit}
      canEdit={canEdit}
      apiPath="/api/masters/service-types"
      defaultValues={{ category_id: cats[0]?.id ?? '', code: '', name_ar: '', name_en: '', display_order: 0, is_active: true }}
      fields={[
        {
          name: 'category_id',
          label: t('masters.serviceCategories'),
          required: true,
          type: 'select',
          options: cats.map((c) => ({ value: c.id, label: catLabel(c) })),
        },
        { name: 'code', label: t('common.code'), required: true, dir: 'ltr' },
        { name: 'name_ar', label: t('common.name_ar'), required: true, dir: 'rtl' },
        { name: 'name_en', label: t('common.name_en'), required: true, dir: 'ltr' },
        { name: 'display_order', label: t('masters.displayOrder'), type: 'number' },
        { name: 'is_active', label: t('common.active'), type: 'switch' },
      ]}
      columns={[
        { key: 'code', header: t('common.code'), className: 'w-40 font-mono text-xs' },
        { key: 'name_ar', header: t('common.name_ar'), cell: (r) => <span className="font-medium">{r.name_ar}</span> },
        { key: 'name_en', header: t('common.name_en'), hideOnMobile: true },
        {
          key: 'category_id',
          header: t('masters.serviceCategories'),
          hideOnMobile: true,
          cell: (r) => {
            const c = catMap.get(r.category_id);
            return c ? catLabel(c) : '—';
          },
        },
        { key: 'is_active', header: t('common.status'), align: 'center',
          cell: (r) => r.is_active ? (
            <span className="inline-block px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs">{t('common.active')}</span>
          ) : (<span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">{t('common.inactive')}</span>),
        },
      ]}
    />
  );
}
