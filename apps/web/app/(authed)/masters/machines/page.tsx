import { requireScreen } from '@/lib/auth/require-screen';
import {
  MachinesMasterRepository,
  MachineCategoriesRepository,
  MachineBrandsRepository,
  RefrigerantTypesRepository,
} from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations, getLocale } from 'next-intl/server';
import { SimpleMasterClient } from '@/components/masters/simple-master-client';

export const dynamic = 'force-dynamic';

export default async function MachinesMasterPage() {
  const ctx = await requireScreen('machines_master', 'view');
  const machines = new MachinesMasterRepository(ctx.supabase);
  const cats = new MachineCategoriesRepository(ctx.supabase);
  const brands = new MachineBrandsRepository(ctx.supabase);
  const refr = new RefrigerantTypesRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);

  const [rows, total, allCats, allBrands, allRefr, canAdd, canEdit] = await Promise.all([
    machines.listWithJoins({ active_only: false, limit: 100 }),
    machines.count(),
    cats.list({ active_only: true, limit: 100 }),
    brands.list({ active_only: true, limit: 200 }),
    refr.list({ active_only: true, limit: 100 }),
    perms.can('machines_master', 'add'),
    perms.can('machines_master', 'edit'),
  ]);

  const t = await getTranslations();
  const locale = await getLocale();
  const catLabel = (c: { name_ar: string; name_en: string }) => locale === 'ar' ? c.name_ar : c.name_en;

  return (
    <SimpleMasterClient
      title={t('masters.machinesMaster')}
      rows={rows as any[]}
      total={total}
      canAdd={canAdd}
      canEdit={canEdit}
      apiPath="/api/masters/machines"
      defaultValues={{
        category_id: allCats[0]?.id ?? '',
        brand_id: '', refrigerant_id: '',
        outdoor_model: '', indoor_model: '',
        capacity_hp: null, capacity_tr: null, btu_h: null, cfm: null, kw: null,
        country_origin: '', notes: '', is_active: true,
      }}
      fields={[
        { name: 'category_id', label: t('masters.machineCategories'), required: true, type: 'select',
          options: allCats.map((c) => ({ value: c.id, label: catLabel(c) })) },
        { name: 'brand_id', label: t('masters.machineBrands'), type: 'select',
          options: allBrands.map((b) => ({ value: b.id, label: b.name })) },
        { name: 'refrigerant_id', label: t('masters.refrigerantTypes'), type: 'select',
          options: allRefr.map((r) => ({ value: r.id, label: r.name })) },
        { name: 'outdoor_model', label: t('masters.outdoorModel'), dir: 'ltr' },
        { name: 'indoor_model', label: t('masters.indoorModel'), dir: 'ltr' },
        { name: 'capacity_hp', label: t('masters.capacityHp'), type: 'number' },
        { name: 'capacity_tr', label: t('masters.capacityTr'), type: 'number' },
        { name: 'btu_h', label: t('masters.btu'), type: 'number' },
        { name: 'cfm', label: t('masters.cfm'), type: 'number' },
        { name: 'kw', label: t('masters.kw'), type: 'number' },
        { name: 'country_origin', label: t('masters.countryOrigin'), dir: 'ltr' },
        { name: 'is_active', label: t('common.active'), type: 'switch' },
      ]}
      columns={[
        { key: 'category', header: t('masters.machineCategories'),
          cell: (r: any) => r.category ? catLabel(r.category) : '—' },
        { key: 'brand', header: t('masters.machineBrands'), hideOnMobile: true,
          cell: (r: any) => r.brand?.name ?? '—' },
        { key: 'outdoor_model', header: t('masters.outdoorModel'),
          cell: (r: any) => r.outdoor_model ?? '—' },
        { key: 'indoor_model', header: t('masters.indoorModel'), hideOnMobile: true,
          cell: (r: any) => r.indoor_model ?? '—' },
        { key: 'capacity_hp', header: t('masters.capacityHp'), align: 'center',
          cell: (r: any) => r.capacity_hp ?? '—' },
        { key: 'refrigerant', header: t('masters.refrigerantTypes'), hideOnMobile: true,
          cell: (r: any) => r.refrigerant?.code ?? '—' },
        { key: 'is_active', header: t('common.status'), align: 'center',
          cell: (r: any) => r.is_active ? (
            <span className="inline-block px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs">{t('common.active')}</span>
          ) : (<span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">{t('common.inactive')}</span>),
        },
      ]}
    />
  );
}
