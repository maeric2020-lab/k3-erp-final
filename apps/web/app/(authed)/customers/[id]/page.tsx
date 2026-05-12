import { requireScreen } from '@/lib/auth/require-screen';
import { CustomerForm } from '../customer-form';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NewCustomerPage() {
  await requireScreen('customers', 'add');
  const t = await getTranslations();
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/customers" className="inline-flex items-center hover:text-gray-900">
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          {t('customers.title')}
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">{t('customers.newCustomer')}</h1>
      <CustomerForm mode="create" />
    </div>
  );
}
