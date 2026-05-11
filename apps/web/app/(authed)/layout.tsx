import { requireUser } from '@/lib/auth/require-user';
import { Sidebar } from '@/components/nav/sidebar';

/**
 * Layout shell for every authenticated page.
 * - Forces auth check via requireUser() (redirects to /login if not authed).
 * - Renders the sidebar (server component, computed from screen permissions).
 * - The page itself renders the Topbar + content in its own template.
 */
export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">{children}</main>
    </div>
  );
}
