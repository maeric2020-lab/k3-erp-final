import { requireScreen } from '@/lib/auth/require-screen';
import {
  ServicesMasterRepository,
  ServiceTypesRepository,
  SparePartCategoriesRepository,
} from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations, getLocale } from 'next-intl/server';
import { SimpleMasterClient } from '@/components/masters/simple-master-client';

export const dynamic = 'force-dynamic';

export default async function ServicesMasterPage() {
  const ctx = await requireScreen('services_master', 'view');
  const services = new ServicesMasterRepository(ctx.supabase);
  const types = new ServiceTypesRepository(ctx.supabase);
  const partCats = new SparePartCategoriesRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);

  const [rows, total, allTypes, allPartCats, canAdd, canEdit] = await Promise.all([
    services.listWithJoins({ active_only: false, limit: 100 }),
    services.count(),
    types.list({ active_only: true, limit: 500 }),
    partCats.list({ active_only: true, limit: 100 }),
    perms.can('services_master', 'add'),
    perms.can('services_master', 'edit'),
  ]);

  const t = await getTranslations();
  const locale = await getLocale();
  const lbl = (c: { name_ar: string; name_en: string }) => locale === 'ar' ? c.name_ar : c.name_en;

  return (
    <SimpleMasterClient
      title={t('masters.servicesMaster')}
      rows={rows as any[]}
      total={total}
      canAdd={canAdd}
      canEdit={canEdit}
      apiPath="/api/masters/services"
      defaultValues={{
        service_type_id: allTypes[0]?.id ?? '',
        name_ar: '', name_en: '', technical_code: '',
        unit: 'service', capacity_hp: null,
        requires_part: false, default_part_category_id: '',
        notes: '', is_active: true,
      }}
      fields={[
        { name: 'service_type_id', label: t('masters.serviceTypes'), required: true, type: 'select',
          options: allTypes.map((s) => ({ value: s.id, label: lbl(s) })) },
        { name: 'name_ar', label: t('common.name_ar'), required: true, dir: 'rtl' },
        { name: 'name_en', label: t('common.name_en'), required: true, dir: 'ltr' },
        { name: 'technical_code', label: t('masters.technicalCode'), dir: 'ltr' },
        { name: 'unit', label: t('masters.unit'), type: 'select', options: [
          { value: 'service', label: t('masters.units.service') },
          { value: 'piece', label: t('masters.units.piece') },
          { value: 'meter', label: t('masters.units.meter') },
          { value: 'kg', label: t('masters.units.kg') },
          { value: 'hour', label: t('masters.units.hour') },
          { value: 'set', label: t('masters.units.set') },
        ] },
        { name: 'capacity_hp', label: t('masters.capacityHp'), type: 'number' },
        { name: 'requires_part', label: t('masters.requiresPart'), type: 'switch' },
        { name: 'default_part_category_id', label: t('masters.defaultPartCategory'), type: 'select',
          options: allPartCats.map((c) => ({ value: c.id, label: lbl(c) })) },
        { name: 'is_active', label: t('common.active'), type: 'switch' },
      ]}
      columns={[
        { key: 'service_code', header: t('masters.serviceCode'), className: 'w-32 font-mono text-xs' },
        { key: 'name_ar', header: t('common.name_ar'), cell: (r: any) => <span className="font-medium">{r.name_ar}</span> },
        { key: 'name_en', header: t('common.name_en'), hideOnMobile: true },
        { key: 'service_type', header: t('masters.serviceTypes'), hideOnMobile: true,
          cell: (r: any) => r.service_type ? lbl(r.service_type) : '—' },
        { key: 'technical_code', header: t('masters.technicalCode'), hideOnMobile: true,
          cell: (r: any) => r.technical_code ?? '—' },
        { key: 'unit', header: t('masters.unit'), align: 'center',
          cell: (r: any) => t(`masters.units.${r.unit}` as any) },
        { key: 'is_active', header: t('common.status'), align: 'center',
          cell: (r: any) => r.is_active ? (
            <span className="inline-block px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs">{t('common.active')}</span>
          ) : (<span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">{t('common.inactive')}</span>),
        },
      ]}
    />
  );
}
