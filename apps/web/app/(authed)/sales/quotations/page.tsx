import { requireScreen } from '@/lib/auth/require-screen';
import { QuotationsRepository, CustomersRepository } from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations } from 'next-intl/server';
import { QuotationsClient } from './quotations-client';

export const dynamic = 'force-dynamic';

export default async function QuotationsListPage() {
  const ctx = await requireScreen('quotations', 'view');
  const repo = new QuotationsRepository(ctx.supabase);
  const customers = new CustomersRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);

  const [rows, total, customerList, canAdd] = await Promise.all([
    repo.list({ limit: 100, order_by: 'issue_date', ascending: false }),
    repo.count(),
    customers.list({ active_only: true, limit: 1000 }),
    perms.can('quotations', 'add'),
  ]);
  const customerById = new Map(customerList.map((c) => [c.id, c.name_ar]));
  const enriched = rows.map((q) => ({ ...q, customer_name: customerById.get(q.customer_id) ?? '—' }));

  return <QuotationsClient initialRows={enriched as any} total={total} canAdd={canAdd} />;
}
