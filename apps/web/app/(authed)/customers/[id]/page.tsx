import { requireScreen } from '@/lib/auth/require-screen';
import {
  CustomersRepository,
  CustomerMachinesRepository,
  MachineCategoriesRepository,
  MachineBrandsRepository,
  RefrigerantTypesRepository,
} from '@k3/repositories';
import { CustomerForm } from '../customer-form';
import { CustomerSitesPanel } from './sites-panel';
import { CustomerMachinesPanel } from './machines-panel';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps { params: { id: string } }

export default async function CustomerEditPage({ params }: PageProps) {
  const ctx = await requireScreen('customers', 'view');
  const repo = new CustomersRepository(ctx.supabase);
  const machines = new CustomerMachinesRepository(ctx.supabase);
  const cats = new MachineCategoriesRepository(ctx.supabase);
  const brands = new MachineBrandsRepository(ctx.supabase);
  const refrs = new RefrigerantTypesRepository(ctx.supabase);
  const data = await repo.getWithSites(params.id);
  if (!data) notFound();
  const [machineList, catList, brandList, refrList] = await Promise.all([
    machines.listForCustomer(data.customer.id),
    cats.list({ active_only: true, limit: 200 }),
    brands.list({ active_only: true, limit: 500 }),
    refrs.list({ active_only: true, limit: 100 }),
  ]);
  const t = await getTranslations();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/customers" className="inline-flex items-center hover:text-gray-900">
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          {t('customers.title')}
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{data.customer.name_ar}</h1>
        <div className="text-sm text-gray-500 font-mono">{data.customer.code}</div>
      </div>

      <CustomerForm mode="edit" customer={data.customer} />
      <CustomerSitesPanel customerId={data.customer.id} initialSites={data.sites} />
      <CustomerMachinesPanel
        customerId={data.customer.id}
        sites={data.sites}
        initialMachines={machineList}
        categories={catList}
        brands={brandList}
        refrigerants={refrList}
      />
    </div>
  );
}
