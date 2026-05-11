'use client';
import { useEffect, useState } from 'react';
import type { ScreenAction } from '@k3/shared-types';
import { PermissionsService } from '@k3/services';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface RequireScreenProps {
  screen: string;
  action?: ScreenAction;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Client-side permission gate for conditionally rendering UI elements
 * (buttons, sections, action chips) WITHIN a page the user is already
 * authorized to view.
 *
 * For full-page protection use the server-side requireScreen() helper instead
 * — it's faster (no client round-trip) and prevents the protected content
 * from ever leaving the server.
 *
 * NOTE: this is a UX convenience, NOT a security boundary. The real check
 * happens at the database via RLS.
 */
export function RequireScreen({ screen, action = 'view', fallback = null, children }: RequireScreenProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    const perms = new PermissionsService(supabase);
    perms
      .can(screen, action)
      .then((ok) => {
        if (!cancelled) setAllowed(ok);
      })
      .catch(() => {
        if (!cancelled) setAllowed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [screen, action]);

  if (allowed === null) return null;
  return allowed ? <>{children}</> : <>{fallback}</>;
}
