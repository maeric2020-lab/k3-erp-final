import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ScreenAction } from '@k3/shared-types';
import { PermissionsRepository } from '@k3/repositories';

/**
 * Permissions service.
 *
 * Wraps the repository to:
 *   1. Memoize per-request lookups (the same screen+action is checked multiple
 *      times during a render).
 *   2. Provide a single method for "given user & screen, what actions can they take?"
 *      so the UI can render action buttons conditionally without N round-trips.
 */
export class PermissionsService {
  private readonly repo: PermissionsRepository;
  private readonly cache = new Map<string, boolean>();

  constructor(db: SupabaseClient<Database>) {
    this.repo = new PermissionsRepository(db);
  }

  private cacheKey(screen: string, action: ScreenAction) {
    return `${screen}::${action}`;
  }

  async can(screen: string, action: ScreenAction): Promise<boolean> {
    const key = this.cacheKey(screen, action);
    if (this.cache.has(key)) return this.cache.get(key)!;
    const allowed = await this.repo.hasScreenPermission(screen, action);
    this.cache.set(key, allowed);
    return allowed;
  }

  async assert(screen: string, action: ScreenAction): Promise<void> {
    const allowed = await this.can(screen, action);
    if (!allowed) {
      throw new PermissionDeniedError(screen, action);
    }
  }

  async isSuperAdmin(): Promise<boolean> {
    return this.repo.isSuperAdmin();
  }
}

export class PermissionDeniedError extends Error {
  readonly screen: string;
  readonly action: ScreenAction;
  constructor(screen: string, action: ScreenAction) {
    super(`Permission denied: ${action} on ${screen}`);
    this.name = 'PermissionDeniedError';
    this.screen = screen;
    this.action = action;
  }
}
