import { requireScreen } from '@/lib/auth/require-screen';
import { ContractsRepository, CustomersRepository } from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations } from 'next-intl/server';
import { ContractsClient } from './contracts-client';

export const dynamic = 'force-dynamic';

export default async function ContractsPage() {
  const ctx = await requireScreen('contracts', 'view');
  const repo = new ContractsRepository(ctx.supabase);
  const customers = new CustomersRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);

  const [rows, total, customerList, canAdd] = await Promise.all([
    repo.list({ limit: 100, order_by: 'start_date', ascending: false }),
    repo.count(),
    customers.list({ limit: 1000, active_only: true }),
    perms.can('contracts', 'add'),
  ]);
  const customerById = new Map(customerList.map((c) => [c.id, c.name_ar]));
  const enriched = rows.map((c) => ({ ...c, customer_name: customerById.get(c.customer_id) ?? '—' }));

  return <ContractsClient initialRows={enriched as any} total={total} canAdd={canAdd} />;
}
