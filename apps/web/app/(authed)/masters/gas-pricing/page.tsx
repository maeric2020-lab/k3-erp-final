import { requireScreen } from '@/lib/auth/require-screen';
import { GasTypesMasterRepository, RefrigerantTypesRepository } from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations } from 'next-intl/server';
import { SimpleMasterClient } from '@/components/masters/simple-master-client';

export const dynamic = 'force-dynamic';

export default async function GasPricingPage() {
  const ctx = await requireScreen('gas_types_master', 'view');
  const gas = new GasTypesMasterRepository(ctx.supabase);
  const refr = new RefrigerantTypesRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);
  const [rowsRaw, total, allRefr, canEdit] = await Promise.all([
    gas.listWithRefrigerant(),
    gas.count(),
    refr.list({ active_only: true, limit: 100 }),
    perms.can('gas_types_master', 'edit'),
  ]);
  const t = await getTranslations();

  return (
    <SimpleMasterClient
      title={t('masters.gasTypesMaster')}
      rows={rowsRaw as any[]}
      total={total}
      canAdd={canEdit}
      canEdit={canEdit}
      apiPath="/api/masters/gas-pricing"
      defaultValues={{
        refrigerant_id: allRefr[0]?.id ?? '',
        cost_price_per_kg: 0,
        selling_price_per_kg: 0,
        is_active: true,
      }}
      fields={[
        { name: 'refrigerant_id', label: t('masters.refrigerantTypes'), required: true, type: 'select',
          options: allRefr.map((r) => ({ value: r.id, label: r.name })) },
        { name: 'cost_price_per_kg', label: t('masters.costPrice') + ' / kg', type: 'number' },
        { name: 'selling_price_per_kg', label: t('masters.sellingPrice') + ' / kg', type: 'number' },
        { name: 'is_active', label: t('common.active'), type: 'switch' },
      ]}
      columns={[
        { key: 'refrigerant', header: t('masters.refrigerantTypes'),
          cell: (r: any) => r.refrigerant?.name ?? '—' },
        { key: 'cost_price_per_kg', header: t('masters.costPrice') + ' / kg', align: 'end',
          cell: (r: any) => Number(r.cost_price_per_kg ?? 0).toFixed(3) },
        { key: 'selling_price_per_kg', header: t('masters.sellingPrice') + ' / kg', align: 'end',
          cell: (r: any) => Number(r.selling_price_per_kg ?? 0).toFixed(3) },
        { key: 'is_active', header: t('common.status'), align: 'center',
          cell: (r: any) => r.is_active ? (
            <span className="inline-block px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs">{t('common.active')}</span>
          ) : (<span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">{t('common.inactive')}</span>),
        },
      ]}
    />
  );
}
