import { requireScreen } from '@/lib/auth/require-screen';
import {
  JobsRepository,
  CustomersRepository,
  CustomerSitesRepository,
  CustomerMachinesRepository,
  ContractsRepository,
  DocumentLinesRepository,
  InvoicesRepository,
  UsersProfileRepository,
} from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { JobAdminClient } from './job-admin-client';

export const dynamic = 'force-dynamic';

interface PageProps { params: { id: string } }

export default async function JobAdminPage({ params }: PageProps) {
  const ctx = await requireScreen('jobs', 'view');
  const jobs = new JobsRepository(ctx.supabase);
  const customers = new CustomersRepository(ctx.supabase);
  const sites = new CustomerSitesRepository(ctx.supabase);
  const machines = new CustomerMachinesRepository(ctx.supabase);
  const contracts = new ContractsRepository(ctx.supabase);
  const lines = new DocumentLinesRepository(ctx.supabase);
  const invoices = new InvoicesRepository(ctx.supabase);
  const usersRepo = new UsersProfileRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);

  const job = await jobs.getById(params.id);
  if (!job) notFound();

  const [customer, site, machine, contract, jobLines, canEdit, technicians, invoice] = await Promise.all([
    customers.getById(job.customer_id),
    job.site_id ? sites.getById(job.site_id) : Promise.resolve(null),
    job.customer_machine_id ? machines.getById(job.customer_machine_id) : Promise.resolve(null),
    job.contract_id ? contracts.getById(job.contract_id) : Promise.resolve(null),
    lines.listForJob(job.id),
    perms.can('jobs', 'edit'),
    usersRepo.listTechnicians(),
    job.invoice_id ? invoices.getById(job.invoice_id) : Promise.resolve(null),
  ]);

  const t = await getTranslations();

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/operations/jobs" className="inline-flex items-center hover:text-gray-900">
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          {t('operations.jobs.title')}
        </Link>
      </div>

      <JobAdminClient
        job={job}
        customer={customer}
        site={site}
        machine={machine}
        contract={contract}
        lines={jobLines}
        canEdit={canEdit}
        technicians={technicians}
        invoice={invoice}
      />
    </div>
  );
}
