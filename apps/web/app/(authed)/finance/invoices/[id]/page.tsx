import { requireScreen } from '@/lib/auth/require-screen';
import {
  InvoicesRepository,
  CustomersRepository,
  PaymentsRepository,
  JobsRepository,
} from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { InvoiceDetailClient } from './invoice-detail-client';

export const dynamic = 'force-dynamic';

interface PageProps { params: { id: string } }

export default async function InvoiceDetailPage({ params }: PageProps) {
  const ctx = await requireScreen('invoices', 'view');
  const repo = new InvoicesRepository(ctx.supabase);
  const customers = new CustomersRepository(ctx.supabase);
  const payments = new PaymentsRepository(ctx.supabase);
  const jobs = new JobsRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);

  const invoice = await repo.getById(params.id);
  if (!invoice) notFound();

  const [customer, lineRows, paymentRows, job, canEditInvoice, canAddPayment] = await Promise.all([
    customers.getById(invoice.customer_id),
    ctx.supabase.from('document_lines').select('*').eq('invoice_id', params.id).order('display_order', { ascending: true }),
    payments.listForInvoice(params.id),
    invoice.job_id ? jobs.getById(invoice.job_id) : Promise.resolve(null),
    perms.can('invoices', 'edit'),
    perms.can('payments', 'add'),
  ]);
  const t = await getTranslations();

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/finance/invoices" className="inline-flex items-center hover:text-gray-900">
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          {t('finance.invoices.title')}
        </Link>
      </div>
      <InvoiceDetailClient
        invoice={invoice}
        customer={customer}
        initialLines={(lineRows.data ?? []) as any}
        initialPayments={paymentRows}
        job={job}
        canEditInvoice={canEditInvoice}
        canAddPayment={canAddPayment}
      />
    </div>
  );
}
