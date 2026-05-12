import { requireScreen } from '@/lib/auth/require-screen';
import { CustomersRepository } from '@k3/repositories';
import { ContractForm } from './contract-form';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NewContractPage() {
  const ctx = await requireScreen('contracts', 'add');
  const customers = new CustomersRepository(ctx.supabase);
  const list = await customers.list({ active_only: true, limit: 1000 });
  const t = await getTranslations();
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/contracts" className="inline-flex items-center hover:text-gray-900">
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          {t('operations.contracts.title')}
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">{t('operations.contracts.newContract')}</h1>
      <p className="text-sm text-gray-500">
        Phase 3: minimal contract creation. The full bilingual letterhead wizard with clause editor is in Phase 4.
      </p>
      <ContractForm customers={list.map((c) => ({ id: c.id, label: `${c.name_ar} (${c.code})` }))} />
    </div>
  );
}
