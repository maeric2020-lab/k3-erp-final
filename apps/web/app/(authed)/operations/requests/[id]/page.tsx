import { requireScreen } from '@/lib/auth/require-screen';
import {
  MaintenanceRequestsRepository,
  CustomersRepository,
  CustomerSitesRepository,
  CustomerMachinesRepository,
  ContractsRepository,
  JobsRepository,
} from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { RequestDetailClient } from './request-detail-client';

export const dynamic = 'force-dynamic';

interface PageProps { params: { id: string } }

export default async function RequestDetailPage({ params }: PageProps) {
  const ctx = await requireScreen('maintenance_requests', 'view');
  const requests = new MaintenanceRequestsRepository(ctx.supabase);
  const customers = new CustomersRepository(ctx.supabase);
  const sites = new CustomerSitesRepository(ctx.supabase);
  const machines = new CustomerMachinesRepository(ctx.supabase);
  const contracts = new ContractsRepository(ctx.supabase);
  const jobs = new JobsRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);

  const req = await requests.getById(params.id);
  if (!req) notFound();

  const [customer, site, machine, contract, requestJobs, canCreateJob, technicians] = await Promise.all([
    customers.getById(req.customer_id),
    req.site_id ? sites.getById(req.site_id) : Promise.resolve(null),
    req.customer_machine_id ? machines.getById(req.customer_machine_id) : Promise.resolve(null),
    req.contract_id ? contracts.getById(req.contract_id) : Promise.resolve(null),
    jobs.listForRequest(req.id),
    perms.can('jobs', 'add'),
    // Technicians = active users with technician_id set
    ctx.supabase.from('users_profile').select('id, full_name_ar, full_name_en, technician_id')
      .eq('is_active', true).not('technician_id', 'is', null).then((r) => r.data ?? []),
  ]);
  const t = await getTranslations();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/operations/requests" className="inline-flex items-center hover:text-gray-900">
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          {t('operations.requests.title')}
        </Link>
      </div>
      <RequestDetailClient
        request={req}
        customer={customer}
        site={site}
        machine={machine}
        contract={contract}
        jobs={requestJobs}
        technicians={technicians as any}
        canCreateJob={canCreateJob}
      />
    </div>
  );
}
