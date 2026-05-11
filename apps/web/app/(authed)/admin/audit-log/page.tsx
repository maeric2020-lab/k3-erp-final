import { requireScreen } from '@/lib/auth/require-screen';
import {
  AuditLogRepository,
  UsersProfileRepository,
} from '@k3/repositories';
import { AuditLogClient } from './audit-log-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: {
    user_id?: string;
    entity_type?: string;
    entity_id?: string;
    action?: string;
    from_date?: string;
    to_date?: string;
  };
}

export default async function AuditLogPage({ searchParams }: PageProps) {
  const ctx = await requireScreen('audit_log', 'view');
  const audit = new AuditLogRepository(ctx.supabase);
  const users = new UsersProfileRepository(ctx.supabase);

  const [rows, entityTypes, actions, userList] = await Promise.all([
    audit.list({
      user_id: searchParams.user_id ?? null,
      entity_type: searchParams.entity_type ?? null,
      entity_id: searchParams.entity_id ?? null,
      action: searchParams.action ?? null,
      from_date: searchParams.from_date ?? null,
      to_date: searchParams.to_date ?? null,
      limit: 200,
    }),
    audit.distinctEntityTypes(),
    audit.distinctActions(),
    users.listAll({ include_archived: true }),
  ]);
  const userById = new Map(userList.map((u) => [u.id, u]));
  const enriched = rows.map((r) => ({
    ...r,
    user_name: r.user_id ? (userById.get(r.user_id)?.full_name_ar ?? userById.get(r.user_id)?.email ?? '—') : '—',
  }));

  return (
    <AuditLogClient
      initialRows={enriched as any}
      entityTypes={entityTypes}
      actions={actions}
      users={userList.map((u) => ({ id: u.id, label: u.full_name_ar ?? u.email }))}
      initialFilters={searchParams}
    />
  );
}
