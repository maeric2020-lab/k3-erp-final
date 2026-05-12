import { requireScreen } from '@/lib/auth/require-screen';
import { ContractClauseTemplatesRepository } from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations } from 'next-intl/server';
import { ClauseTemplatesClient } from './clause-templates-client';

export const dynamic = 'force-dynamic';

export default async function ContractClauseTemplatesPage() {
  const ctx = await requireScreen('contract_clause_templates', 'view');
  const repo = new ContractClauseTemplatesRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);

  const [rows, total, canAdd, canEdit] = await Promise.all([
    repo.list({ limit: 100, order_by: 'display_order', ascending: true }),
    repo.count(),
    perms.can('contract_clause_templates', 'add'),
    perms.can('contract_clause_templates', 'edit'),
  ]);

  return <ClauseTemplatesClient initialRows={rows} total={total} canAdd={canAdd} canEdit={canEdit} />;
}
