import { requireScreen } from '@/lib/auth/require-screen';
import {
  ContractsRepository,
  ContractMachinesRepository,
  CustomersRepository,
  CustomerMachinesRepository,
  MachineCategoriesRepository,
  MachineBrandsRepository,
} from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { ContractDetailClient } from './contract-detail-client';

export const dynamic = 'force-dynamic';

interface PageProps { params: { id: string } }

export default async function ContractDetailPage({ params }: PageProps) {
  const ctx = await requireScreen('contracts', 'view');
  const repo = new ContractsRepository(ctx.supabase);
  const cm = new ContractMachinesRepository(ctx.supabase);
  const customers = new CustomersRepository(ctx.supabase);
  const machines = new CustomerMachinesRepository(ctx.supabase);
  const cats = new MachineCategoriesRepository(ctx.supabase);
  const brands = new MachineBrandsRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);

  const contract = await repo.getById(params.id);
  if (!contract) notFound();

  const [customer, links, customerMachines, allCats, allBrands, canEdit] = await Promise.all([
    customers.getById(contract.customer_id),
    cm.listForContract(contract.id),
    machines.listForCustomer(contract.customer_id),
    cats.list({ active_only: true, limit: 100 }),
    brands.list({ active_only: true, limit: 200 }),
    perms.can('contracts', 'edit'),
  ]);

  // Enrich the linked machines with their snapshot details
  const machineById = new Map(customerMachines.map((m) => [m.id, m]));
  const catById = new Map(allCats.map((c) => [c.id, c.name_ar]));
  const brandById = new Map(allBrands.map((b) => [b.id, b.name]));
  const enrichedLinks = links.map((l) => {
    const m = machineById.get(l.customer_machine_id);
    return {
      ...l,
      machine_summary: m
        ? `${catById.get(m.category_id) ?? ''} ${m.brand_id ? brandById.get(m.brand_id) ?? '' : ''} — ${m.outdoor_model ?? ''} / ${m.indoor_model ?? ''}`
        : '—',
    };
  });

  // Customer machines NOT yet attached
  const attachedIds = new Set(links.map((l) => l.customer_machine_id));
  const availableMachines = customerMachines
    .filter((m) => !attachedIds.has(m.id))
    .map((m) => ({
      id: m.id,
      label: `${catById.get(m.category_id) ?? ''} ${m.brand_id ? brandById.get(m.brand_id) ?? '' : ''} — ${m.outdoor_model ?? ''}/${m.indoor_model ?? ''}`,
    }));

  const t = await getTranslations();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/contracts" className="inline-flex items-center hover:text-gray-900">
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          {t('operations.contracts.title')}
        </Link>
      </div>
      <ContractDetailClient
        contract={contract}
        customer={customer}
        machines={enrichedLinks}
        availableMachines={availableMachines}
        canEdit={canEdit}
      />
    </div>
  );
}
