import { requireScreen } from '@/lib/auth/require-screen';
import {
  ContractPricingRepository,
  MachineCategoriesRepository,
  MachineBrandsRepository,
  RefrigerantTypesRepository,
} from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations, getLocale } from 'next-intl/server';
import { ContractPricingClient } from './contract-pricing-client';

export const dynamic = 'force-dynamic';

export default async function ContractPricingPage() {
  const ctx = await requireScreen('contract_pricing', 'view');
  const pricing = new ContractPricingRepository(ctx.supabase);
  const cats = new MachineCategoriesRepository(ctx.supabase);
  const brands = new MachineBrandsRepository(ctx.supabase);
  const refr = new RefrigerantTypesRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);

  const [rows, total, allCats, allBrands, allRefr, canAdd, canEdit] = await Promise.all([
    pricing.listWithJoins({ active_only: false, limit: 200 }),
    pricing.count(),
    cats.list({ active_only: true, limit: 100 }),
    brands.list({ active_only: true, limit: 200 }),
    refr.list({ active_only: true, limit: 100 }),
    perms.can('contract_pricing', 'add'),
    perms.can('contract_pricing', 'edit'),
  ]);
  const t = await getTranslations();
  const locale = await getLocale();

  return (
    <ContractPricingClient
      title={t('masters.contractPricing')}
      rows={rows as any[]}
      total={total}
      categories={allCats}
      brands={allBrands}
      refrigerants={allRefr}
      canAdd={canAdd}
      canEdit={canEdit}
      locale={locale as 'ar' | 'en'}
    />
  );
}
