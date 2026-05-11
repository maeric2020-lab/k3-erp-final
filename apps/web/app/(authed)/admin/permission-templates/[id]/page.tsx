import { requireScreen } from '@/lib/auth/require-screen';
import {
  PermissionTemplatesRepository,
  PermissionTemplateItemsRepository,
  ScreensRepository,
  PermissionsRepository,
} from '@k3/repositories';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { TemplateDetailClient } from './template-detail-client';

export const dynamic = 'force-dynamic';

interface PageProps { params: { id: string } }

export default async function TemplateDetailPage({ params }: PageProps) {
  const ctx = await requireScreen('permission_templates', 'view');
  const repo = new PermissionTemplatesRepository(ctx.supabase);
  const items = new PermissionTemplateItemsRepository(ctx.supabase);
  const screens = new ScreensRepository(ctx.supabase);
  const perms = new PermissionsRepository(ctx.supabase);

  const template = await repo.getById(params.id);
  if (!template) notFound();

  const [allScreens, currentItems, canEdit] = await Promise.all([
    screens.listAll(),
    items.listForTemplate(params.id),
    perms.hasScreenPermission('permission_templates', 'edit'),
  ]);

  // Build the grid rows: one row per (screen × default_action), with granted=true
  // if an item exists for that pair.
  const grantedSet = new Set(currentItems.map((it) => `${it.screen_code}:${it.action}`));
  const grid = allScreens.flatMap((s) =>
    s.default_actions.map((a) => ({
      screen_code: s.code,
      module: s.module,
      label_ar: s.label_ar,
      label_en: s.label_en,
      display_order: s.display_order,
      action: a,
      granted: grantedSet.has(`${s.code}:${a}`),
    }))
  );

  const t = await getTranslations();
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/admin/permission-templates" className="inline-flex items-center hover:text-gray-900">
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          {t('admin.permissionTemplates.title')}
        </Link>
      </div>
      <TemplateDetailClient template={template} initialGrid={grid} canEdit={canEdit} />
    </div>
  );
}
