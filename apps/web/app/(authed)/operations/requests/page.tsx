import { requireScreen } from '@/lib/auth/require-screen';
import { MaintenanceRequestsRepository, CustomersRepository } from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations } from 'next-intl/server';
import { RequestsClient } from './requests-client';

export const dynamic = 'force-dynamic';

export default async function RequestsPage() {
  const ctx = await requireScreen('maintenance_requests', 'view');
  const repo = new MaintenanceRequestsRepository(ctx.supabase);
  const customers = new CustomersRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);

  const [rows, total, customerList, canAdd, canEdit] = await Promise.all([
    repo.list({ limit: 50, order_by: 'created_at', ascending: false }),
    repo.count(),
    customers.list({ active_only: true, limit: 500 }),
    perms.can('maintenance_requests', 'add'),
    perms.can('maintenance_requests', 'edit'),
  ]);

  const customerById = new Map(customerList.map((c) => [c.id, c]));
  const enriched = rows.map((r) => ({ ...r, customer_name: customerById.get(r.customer_id)?.name_ar ?? '—' }));

  return (
    <RequestsClient
      initialRows={enriched}
      initialTotal={total}
      canAdd={canAdd}
      canEdit={canEdit}
    />
  );
}
