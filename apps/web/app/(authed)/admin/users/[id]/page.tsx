import { requireScreen } from '@/lib/auth/require-screen';
import {
  UsersProfileRepository,
  UserPermissionsAdminRepository,
  PermissionTemplatesRepository,
  PermissionsRepository,
} from '@k3/repositories';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { UserDetailClient } from './user-detail-client';

export const dynamic = 'force-dynamic';

interface PageProps { params: { id: string } }

export default async function UserDetailPage({ params }: PageProps) {
  const ctx = await requireScreen('users', 'view');
  const profiles = new UsersProfileRepository(ctx.supabase);
  const permGrid = new UserPermissionsAdminRepository(ctx.supabase);
  const templates = new PermissionTemplatesRepository(ctx.supabase);
  const perms = new PermissionsRepository(ctx.supabase);

  const profile = await profiles.getById(params.id);
  if (!profile) notFound();

  const [grid, templateList, canEdit] = await Promise.all([
    permGrid.grid(profile.id),
    templates.listActive(),
    perms.hasScreenPermission('users', 'edit'),
  ]);
  const t = await getTranslations();

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/admin/users" className="inline-flex items-center hover:text-gray-900">
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          {t('admin.users.title')}
        </Link>
      </div>
      <UserDetailClient
        profile={profile}
        initialGrid={grid}
        templates={templateList}
        canEdit={canEdit}
      />
    </div>
  );
}
