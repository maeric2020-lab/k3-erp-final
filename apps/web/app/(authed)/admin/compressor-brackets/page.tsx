import { requireScreen } from '@/lib/auth/require-screen';
import { CompressorBracketsRepository } from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { getTranslations } from 'next-intl/server';
import { CompressorBracketsClient } from './compressor-brackets-client';

export const dynamic = 'force-dynamic';

export default async function CompressorBracketsPage() {
  const ctx = await requireScreen('compressor_brackets', 'view');
  const repo = new CompressorBracketsRepository(ctx.supabase);
  const perms = new PermissionsService(ctx.supabase);

  const [rows, total, canAdd, canEdit] = await Promise.all([
    repo.list({ limit: 100, order_by: 'hp_min', ascending: true }),
    repo.count(),
    perms.can('compressor_brackets', 'add'),
    perms.can('compressor_brackets', 'edit'),
  ]);
  const t = await getTranslations();

  return <CompressorBracketsClient initialRows={rows} total={total} canAdd={canAdd} canEdit={canEdit} />;
}
