import { requireScreen } from '@/lib/auth/require-screen';
import {
  CustomersRepository,
  CustomerSitesRepository,
  CustomerMachinesRepository,
  ContractsRepository,
} from '@k3/repositories';
import { CompanySettingsRepository } from '@k3/repositories';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { RequestForm } from './request-form';

export const dynamic = 'force-dynamic';

export default async function NewRequestPage() {
  const ctx = await requireScreen('maintenance_requests', 'add');
  const customersRepo = new CustomersRepository(ctx.supabase);
  const settingsRepo = new CompanySettingsRepository(ctx.supabase);
  const customers = await customersRepo.list({ active_only: true, limit: 1000 });
  const settings = await settingsRepo.get();
  const t = await getTranslations();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/operations/requests" className="inline-flex items-center hover:text-gray-900">
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          {t('operations.requests.title')}
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">{t('operations.requests.newRequest')}</h1>
      <RequestForm
        customers={customers.map((c) => ({ id: c.id, label: `${c.name_ar} (${c.code})` }))}
        allowOtherProblem={settings?.allow_other_problem ?? false}
      />
    </div>
  );
}
