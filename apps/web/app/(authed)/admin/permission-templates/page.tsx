import { requireScreen } from '@/lib/auth/require-screen';
import { PermissionTemplatesRepository, PermissionsRepository } from '@k3/repositories';
import { TemplatesListClient } from './templates-list-client';

export const dynamic = 'force-dynamic';

export default async function PermissionTemplatesPage() {
  const ctx = await requireScreen('permission_templates', 'view');
  const repo = new PermissionTemplatesRepository(ctx.supabase);
  const perms = new PermissionsRepository(ctx.supabase);

  const [rows, total, canAdd, canEdit] = await Promise.all([
    repo.list({ limit: 100, order_by: 'name', ascending: true }),
    repo.count(),
    perms.hasScreenPermission('permission_templates', 'add'),
    perms.hasScreenPermission('permission_templates', 'edit'),
  ]);
  return <TemplatesListClient initialRows={rows} total={total} canAdd={canAdd} canEdit={canEdit} />;
}
