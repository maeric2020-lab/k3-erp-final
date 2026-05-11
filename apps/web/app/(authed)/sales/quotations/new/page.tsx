import { requireScreen } from '@/lib/auth/require-screen';
import { CustomersRepository } from '@k3/repositories';
import { QuotationForm } from './quotation-form';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NewQuotationPage() {
  const ctx = await requireScreen('quotations', 'add');
  const customers = new CustomersRepository(ctx.supabase);
  const list = await customers.list({ active_only: true, limit: 1000 });
  const t = await getTranslations();
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/sales/quotations" className="inline-flex items-center hover:text-gray-900">
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          {t('finance.quotations.title')}
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">{t('finance.quotations.newQuotation')}</h1>
      <QuotationForm customers={list.map((c) => ({ id: c.id, label: `${c.name_ar} (${c.code})` }))} />
    </div>
  );
}
