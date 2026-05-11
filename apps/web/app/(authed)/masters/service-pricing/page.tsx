import { requireScreen } from '@/lib/auth/require-screen';
import {
  ServicePricingRepository,
  ServicesMasterRepository,
  MachineCategoriesRepository,
} from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations, getLocale } from 'next-intl/server';
import { ServicePricingClient } from './service-pricing-client';

export const dynamic = 'force-dynamic';

export default async function ServicePricingPage() {
  const ctx = await requireScreen('service_pricing', 'view');
  const pricing = new ServicePricingRepository(ctx.supabase);
  const services = new ServicesMasterRepository(ctx.supabase);
  const cats = new MachineCategoriesRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);

  const [rows, total, allServices, allCats, canAdd, canEdit] = await Promise.all([
    pricing.listWithJoins({ active_only: false, limit: 200 }),
    pricing.count(),
    services.list({ active_only: true, limit: 1000 }),
    cats.list({ active_only: true, limit: 100 }),
    perms.can('service_pricing', 'add'),
    perms.can('service_pricing', 'edit'),
  ]);
  const t = await getTranslations();
  const locale = await getLocale();

  return (
    <ServicePricingClient
      title={t('masters.servicePricing')}
      rows={rows as any[]}
      total={total}
      services={allServices}
      machineCategories={allCats}
      canAdd={canAdd}
      canEdit={canEdit}
      locale={locale as 'ar' | 'en'}
    />
  );
}
