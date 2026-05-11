import { requireScreen } from '@/lib/auth/require-screen';
import { QuotationsRepository, CustomersRepository, DocumentLinesRepository } from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { QuotationDetailClient } from './quotation-detail-client';

export const dynamic = 'force-dynamic';

interface PageProps { params: { id: string } }

export default async function QuotationDetailPage({ params }: PageProps) {
  const ctx = await requireScreen('quotations', 'view');
  const repo = new QuotationsRepository(ctx.supabase);
  const customers = new CustomersRepository(ctx.supabase);
  const lines = new DocumentLinesRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);

  const quotation = await repo.getById(params.id);
  if (!quotation) notFound();

  const [customer, lineRows, canEdit] = await Promise.all([
    customers.getById(quotation.customer_id),
    ctx.supabase.from('document_lines').select('*').eq('quotation_id', params.id).order('display_order', { ascending: true }),
    perms.can('quotations', 'edit'),
  ]);
  const t = await getTranslations();

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/sales/quotations" className="inline-flex items-center hover:text-gray-900">
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          {t('finance.quotations.title')}
        </Link>
      </div>
      <QuotationDetailClient
        quotation={quotation}
        customer={customer}
        initialLines={(lineRows.data ?? []) as any}
        canEdit={canEdit}
      />
    </div>
  );
}
