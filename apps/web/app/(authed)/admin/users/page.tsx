import { requireScreen } from '@/lib/auth/require-screen';
import { UsersProfileRepository, PermissionsRepository } from '@k3/repositories';
import { UsersListClient } from './users-list-client';

export const dynamic = 'force-dynamic';

export default async function UsersListPage() {
  const ctx = await requireScreen('users', 'view');
  const repo = new UsersProfileRepository(ctx.supabase);
  const perms = new PermissionsRepository(ctx.supabase);

  const [rows, canAdd, canEdit, canDelete] = await Promise.all([
    repo.listAll(),
    perms.hasScreenPermission('users', 'add'),
    perms.hasScreenPermission('users', 'edit'),
    perms.hasScreenPermission('users', 'delete'),
  ]);

  return <UsersListClient initialRows={rows} canAdd={canAdd} canEdit={canEdit} canDelete={canDelete} />;
}
