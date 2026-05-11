import { requireScreen } from '@/lib/auth/require-screen';
import { CustomersRepository } from '@k3/repositories';
import { CustomersClient } from './customers-client';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const ctx = await requireScreen('customers', 'view');
  const repo = new CustomersRepository(ctx.supabase);
  const [rows, total] = await Promise.all([
    repo.list({ limit: 25, offset: 0, order_by: 'created_at', ascending: false }),
    repo.count(),
  ]);
  const t = await getTranslations();
  const canAdd = await new (await import('@k3/services')).PermissionsService(ctx.supabase).can('customers', 'add');
  const canEdit = await new (await import('@k3/services')).PermissionsService(ctx.supabase).can('customers', 'edit');
  return (
    <CustomersClient
      initialRows={rows}
      initialTotal={total}
      canAdd={canAdd}
      canEdit={canEdit}
    />
  );
}
