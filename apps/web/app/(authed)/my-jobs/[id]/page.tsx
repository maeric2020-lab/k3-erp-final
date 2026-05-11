import { requireUser } from '@/lib/auth/require-user';
import {
  JobsRepository,
  CustomersRepository,
  CustomerSitesRepository,
  CustomerMachinesRepository,
  DocumentLinesRepository,
} from '@k3/repositories';
import { notFound, redirect } from 'next/navigation';
import { TechnicianJobClient } from './technician-job-client';

export const dynamic = 'force-dynamic';

interface PageProps { params: { id: string } }

export default async function TechnicianJobPage({ params }: PageProps) {
  const ctx = await requireUser(`/my-jobs/${params.id}`);
  const repo = new JobsRepository(ctx.supabase);
  const customers = new CustomersRepository(ctx.supabase);
  const sites = new CustomerSitesRepository(ctx.supabase);
  const machines = new CustomerMachinesRepository(ctx.supabase);
  const lines = new DocumentLinesRepository(ctx.supabase);

  const job = await repo.getById(params.id);
  if (!job) notFound();

  // Extra guard — RLS already prevents non-owners from reading, but we make the
  // failure mode explicit.
  if (job.technician_id !== ctx.profile.id && !ctx.profile.is_super_admin) {
    redirect('/forbidden?screen=jobs_my&action=view');
  }

  const [customer, site, machine, jobLines] = await Promise.all([
    customers.getById(job.customer_id),
    job.site_id ? sites.getById(job.site_id) : Promise.resolve(null),
    job.customer_machine_id ? machines.getById(job.customer_machine_id) : Promise.resolve(null),
    lines.listForJob(job.id),
  ]);

  return (
    <TechnicianJobClient
      job={job}
      customer={customer}
      site={site}
      machine={machine}
      lines={jobLines}
    />
  );
}
