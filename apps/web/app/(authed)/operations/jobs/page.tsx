import { requireScreen } from '@/lib/auth/require-screen';
import { JobsRepository, CustomersRepository } from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations } from 'next-intl/server';
import { JobsBoardClient } from './jobs-board-client';

export const dynamic = 'force-dynamic';

export default async function JobsListPage() {
  const ctx = await requireScreen('jobs', 'view');
  const repo = new JobsRepository(ctx.supabase);
  const customers = new CustomersRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);

  const [rows, customerList, canEdit] = await Promise.all([
    repo.list({ limit: 200, order_by: 'created_at', ascending: false }),
    customers.list({ limit: 1000, active_only: true }),
    perms.can('jobs', 'edit'),
  ]);
  const techProfiles = await ctx.supabase
    .from('users_profile')
    .select('id, full_name_ar, full_name_en, technician_id, is_active')
    .not('technician_id', 'is', null)
    .eq('is_active', true);

  const customerById = new Map(customerList.map((c) => [c.id, c.name_ar]));
  const techById = new Map(((techProfiles.data ?? []) as any[]).map((t) => [t.id, (t.full_name_ar || t.full_name_en || '—')]));

  const enriched = rows.map((j) => ({
    ...j,
    customer_name: customerById.get(j.customer_id) ?? '—',
    technician_name: j.technician_id ? techById.get(j.technician_id) ?? '—' : null,
  }));

  return <JobsBoardClient initialRows={enriched as any} canEdit={canEdit} />;
}
