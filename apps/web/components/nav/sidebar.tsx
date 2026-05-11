import 'server-only';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  LayoutDashboard,
  ClipboardList,
  Briefcase,
  FileText,
  Receipt,
  Users,
  Database,
  BarChart3,
  Shield,
  MessageSquare,
} from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ScreensRepository, type Screen } from '@k3/repositories';
import { PermissionsService } from '@k3/services';
import { cn } from '@/lib/utils';

const MODULE_ORDER = [
  'dashboard',
  'operations',
  'sales',
  'finance',
  'customers',
  'masters',
  'reports',
  'admin',
  'communication',
] as const;

const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  operations: ClipboardList,
  sales: Briefcase,
  finance: Receipt,
  customers: Users,
  masters: Database,
  reports: BarChart3,
  admin: Shield,
  communication: MessageSquare,
};

const SCREEN_HREFS: Record<string, string> = {
  dashboard: '/dashboard',
  company_settings: '/admin/settings',
  // Phase 2 — master data
  customers: '/customers',
  customer_sites: '/customers',
  machine_categories: '/masters/machine-categories',
  machine_brands: '/masters/machine-brands',
  machines_master: '/masters/machines',
  service_categories: '/masters/service-categories',
  service_types: '/masters/service-types',
  spare_part_categories: '/masters/spare-part-categories',
  services_master: '/masters/services',
  spare_parts_master: '/masters/spare-parts',
  gas_types_master: '/masters/gas-pricing',
  service_pricing: '/masters/service-pricing',
  contract_pricing: '/masters/contract-pricing',
  import_runs: '/masters/imports',
  // Phase 3 — operations
  maintenance_requests: '/operations/requests',
  jobs: '/operations/jobs',
  jobs_my: '/my-jobs',
  jobs_dispatch: '/operations/jobs',
  customer_machines: '/customers',
  contracts: '/contracts',
  // Phase 4 — sales/finance/admin
  quotations: '/sales/quotations',
  invoices: '/finance/invoices',
  payments: '/finance/payments',
  contract_clause_templates: '/admin/contract-clause-templates',
  compressor_brackets: '/admin/compressor-brackets',
  // Phase 5 — admin
  users: '/admin/users',
  permission_templates: '/admin/permission-templates',
  audit_log: '/admin/audit-log',
  // Phase 6b — reports
  report_sales: '/reports/sales',
  report_payment_aging: '/reports/payment-aging',
  report_technician_perf: '/reports/technician-performance',
  report_jobs_by_tech: '/reports/jobs-by-tech',
  report_parts_consumption: '/reports/parts-consumption',
  report_gas_consumption: '/reports/gas-consumption',
  report_customer_balances: '/reports/customer-balances',
  report_active_contracts: '/reports/active-contracts',
  // Phase 6c — chat
  chat: '/chat',
};

export async function Sidebar({ className }: { className?: string }) {
  const supabase = createSupabaseServerClient();
  const screens = await new ScreensRepository(supabase).listActive();
  const perms = new PermissionsService(supabase);
  const t = await getTranslations('nav');
  const tApp = await getTranslations('app');
  const locale = await getLocale();

  // Filter screens by view permission, then group by module
  const visible: Screen[] = [];
  for (const s of screens) {
    if (await perms.can(s.code, 'view')) visible.push(s);
  }
  const grouped: Record<string, Screen[]> = {};
  for (const s of visible) (grouped[s.module] ??= []).push(s);

  return (
    <aside
      className={cn(
        'flex w-64 shrink-0 flex-col border-e bg-card text-card-foreground',
        'h-screen sticky top-0',
        className
      )}
      aria-label="Primary navigation"
    >
      {/* Header / brand */}
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
            K3
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">{tApp('name')}</span>
            <span className="text-xs text-muted-foreground">{tApp('tagline')}</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {MODULE_ORDER.filter((m) => grouped[m]?.length).map((moduleKey) => {
          const Icon = MODULE_ICONS[moduleKey] ?? LayoutDashboard;
          return (
            <div key={moduleKey} className="mb-4">
              <div className="flex items-center gap-2 px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                <span>{t(moduleKey as any)}</span>
              </div>
              <ul className="space-y-0.5">
                {grouped[moduleKey]!.map((s) => {
                  const href = SCREEN_HREFS[s.code];
                  const label = locale === 'en' ? s.label_en : s.label_ar;
                  if (!href) {
                    return (
                      <li key={s.code}>
                        <span
                          className="block rounded-md px-3 py-2 text-sm text-muted-foreground/70 cursor-not-allowed"
                          title="Coming in a later phase"
                        >
                          {label}
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li key={s.code}>
                      <Link
                        href={href}
                        className="block rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                      >
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
