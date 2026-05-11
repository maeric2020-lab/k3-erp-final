import { requireScreen } from '@/lib/auth/require-screen';
import {
  SparePartsMasterRepository,
  SparePartCategoriesRepository,
  MachineCategoriesRepository,
  MachineBrandsRepository,
} from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations, getLocale } from 'next-intl/server';
import { SparePartsClient } from './spare-parts-client';

export const dynamic = 'force-dynamic';

export default async function SparePartsMasterPage() {
  const ctx = await requireScreen('spare_parts_master', 'view');
  const parts = new SparePartsMasterRepository(ctx.supabase);
  const partCats = new SparePartCategoriesRepository(ctx.supabase);
  const machineCats = new MachineCategoriesRepository(ctx.supabase);
  const brands = new MachineBrandsRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);
  const [rows, total, allPartCats, allMachineCats, allBrands, canAdd, canEdit] = await Promise.all([
    parts.listWithJoins({ active_only: false, limit: 100 }),
    parts.count(),
    partCats.list({ active_only: true, limit: 200 }),
    machineCats.list({ active_only: true, limit: 200 }),
    brands.list({ active_only: true, limit: 200 }),
    perms.can('spare_parts_master', 'add'),
    perms.can('spare_parts_master', 'edit'),
  ]);
  const t = await getTranslations();
  const locale = await getLocale();
  return (
    <SparePartsClient
      title={t('masters.sparePartsMaster')}
      rows={rows as any[]}
      total={total}
      partCategories={allPartCats}
      machineCategories={allMachineCats}
      brands={allBrands}
      canAdd={canAdd}
      canEdit={canEdit}
      locale={locale as 'ar' | 'en'}
    />
  );
}
