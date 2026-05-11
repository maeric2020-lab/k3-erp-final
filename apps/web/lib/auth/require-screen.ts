import 'server-only';
import { redirect } from 'next/navigation';
import type { ScreenAction } from '@k3/shared-types';
import { PermissionsService } from '@k3/services';
import { requireUser } from './require-user';

/**
 * Server-side gate for a (screen, action) pair. Use at the top of every page
 * that lives inside a permission-controlled module.
 *
 * Returns the supabase client + profile so the page doesn't have to call
 * requireUser() AGAIN (one round-trip vs two).
 */
export async function requireScreen(screenCode: string, action: ScreenAction = 'view', currentPath?: string) {
  const ctx = await requireUser(currentPath);
  const perms = new PermissionsService(ctx.supabase);
  const allowed = await perms.can(screenCode, action);
  if (!allowed) {
    redirect(`/forbidden?screen=${encodeURIComponent(screenCode)}&action=${action}`);
  }
  return ctx;
}
