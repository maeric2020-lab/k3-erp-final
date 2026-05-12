import { requireScreen } from '@/lib/auth/require-screen';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { NewUserForm } from './new-user-form';

export const dynamic = 'force-dynamic';

export default async function NewUserPage() {
  await requireScreen('users', 'add');
  const t = await getTranslations();
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/admin/users" className="inline-flex items-center hover:text-gray-900">
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          {t('admin.users.title')}
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">{t('admin.users.newUser')}</h1>
      <p className="text-sm text-gray-500">
        {t('admin.users.invite')} — the user will receive an email with a link to set their password.
      </p>
      <NewUserForm />
    </div>
  );
}
