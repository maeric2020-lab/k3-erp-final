import { requireScreen } from '@/lib/auth/require-screen';
import { ImportsRepository } from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations } from 'next-intl/server';
import { ImportsClient } from './imports-client';

export const dynamic = 'force-dynamic';

export default async function ImportsPage() {
  // We allow access if the user has any import permission on a master
  const ctx = await requireScreen('import_runs', 'view');
  const repo = new ImportsRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);
  const [history, canImport] = await Promise.all([
    repo.listRuns({ limit: 25 }),
    Promise.all([
      perms.can('machines_master', 'import'),
      perms.can('services_master', 'import'),
      perms.can('spare_parts_master', 'import'),
      perms.can('service_pricing', 'import'),
      perms.can('contract_pricing', 'import'),
      perms.can('customers', 'import'),
      perms.can('gas_types_master', 'import'),
    ]).then((arr) => arr.some(Boolean)),
  ]);
  const t = await getTranslations();
  return (
    <ImportsClient
      title={t('imports.title')}
      history={history}
      canImport={canImport}
    />
  );
}
