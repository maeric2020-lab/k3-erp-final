import { requireScreen } from '@/lib/auth/require-screen';
import { InvoicesRepository, CustomersRepository } from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { InvoicesClient } from './invoices-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { status?: string };
}

export default async function InvoicesListPage({ searchParams }: PageProps) {
  const ctx = await requireScreen('invoices', 'view');
  const repo = new InvoicesRepository(ctx.supabase);
  const customers = new CustomersRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);

  const isOutstanding = searchParams.status === 'outstanding';
  const [rows, total, customerList, canAdd] = await Promise.all([
    isOutstanding
      ? repo.listOutstanding({ limit: 200 })
      : repo.list({ limit: 100, order_by: 'issue_date', ascending: false }),
    isOutstanding
      ? repo.listOutstanding({ limit: 1000 }).then((r) => r.length)
      : repo.count(),
    customers.list({ active_only: true, limit: 1000 }),
    perms.can('invoices', 'add'),
  ]);
  const customerById = new Map(customerList.map((c) => [c.id, c.name_ar]));
  const enriched = rows.map((i) => ({ ...i, customer_name: customerById.get(i.customer_id) ?? '—' }));

  return <InvoicesClient initialRows={enriched as any} total={total} canAdd={canAdd} initialFilter={isOutstanding ? 'outstanding' : 'all'} />;
}
