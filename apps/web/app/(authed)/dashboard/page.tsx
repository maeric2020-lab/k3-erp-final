import { getLocale, getTranslations } from 'next-intl/server';
import { requireScreen } from '@/lib/auth/require-screen';
import { Topbar } from '@/components/nav/topbar';
import { Briefcase, AlertCircle, Receipt, TrendingUp } from 'lucide-react';
import { DashboardRepository, PermissionsRepository } from '@k3/repositories';
import { StatWidget } from '@/components/dashboard/stat-widget';
import { Sparkline } from '@/components/dashboard/sparkline';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
  const ctx = await requireScreen('dashboard', 'view', '/dashboard');
  const t = await getTranslations();
  const locale = await getLocale();
  const dash = new DashboardRepository(ctx.supabase);
  const perms = new PermissionsRepository(ctx.supabase);

  const userName =
    locale === 'en'
      ? ctx.profile.full_name_en ?? ctx.profile.full_name_ar ?? ctx.profile.email
      : ctx.profile.full_name_ar ?? ctx.profile.full_name_en ?? ctx.profile.email;

  const [canViewJobs, canViewMyJobs, canViewRequests, canViewInvoices] = await Promise.all([
    perms.hasScreenPermission('jobs', 'view'),
    perms.hasScreenPermission('jobs_my', 'view'),
    perms.hasScreenPermission('maintenance_requests', 'view'),
    perms.hasScreenPermission('invoices', 'view'),
  ]);
  const showJobs = canViewJobs || canViewMyJobs || ctx.profile.is_super_admin;
  const showRequests = canViewRequests || ctx.profile.is_super_admin;
  const showInvoices = canViewInvoices || ctx.profile.is_super_admin;

  const [todayJobs, openRequests, overdueInvoices, revenueMtd] = await Promise.all([
    showJobs ? dash.todayJobs() : Promise.resolve(null),
    showRequests ? dash.openRequests() : Promise.resolve(null),
    showInvoices ? dash.overdueInvoices() : Promise.resolve(null),
    showInvoices ? dash.revenueMtd() : Promise.resolve(null),
  ]);

  let revenueDelta: number | null = null;
  if (revenueMtd && revenueMtd.prev_month_total > 0) {
    revenueDelta = Math.round(((revenueMtd.mtd_total - revenueMtd.prev_month_total) / revenueMtd.prev_month_total) * 100);
  }

  const fmt = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-KW' : 'en-US');
  const fmtKwd = (n: number) => `${n.toFixed(3)} KWD`;

  return (
    <>
      <Topbar
        breadcrumb={[{ label: t('dashboard.title') }]}
        userName={userName ?? undefined}
        userId={ctx.profile.id}
      />
      <div className="container max-w-6xl flex-1 px-6 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('dashboard.welcome')}, <span dir="auto">{userName}</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString(locale === 'ar' ? 'ar-KW' : 'en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {showJobs && todayJobs && (
            <StatWidget
              title={t('dashboard.todayJobs')}
              value={fmt(todayJobs.total)}
              subtitle={
                todayJobs.in_field + todayJobs.working > 0
                  ? `${fmt(todayJobs.in_field + todayJobs.working)} ${t('dashboard.todayJobsSubtitle')}`
                  : t('dashboard.todayJobsSubtitle')
              }
              icon={Briefcase}
              tone="brand"
              href={canViewJobs ? '/operations/jobs' : '/my-jobs'}
            >
              <div className="flex items-center gap-3 text-xs">
                <Stat label={t('dashboard.completedToday')} value={fmt(todayJobs.completed_today)} color="text-green-600" />
                {todayJobs.pending_assignment > 0 && (
                  <Stat label={t('dashboard.pendingAssignment')} value={fmt(todayJobs.pending_assignment)} color="text-amber-600" />
                )}
              </div>
            </StatWidget>
          )}

          {showRequests && openRequests && (
            <StatWidget
              title={t('dashboard.openRequests')}
              value={fmt(openRequests.total)}
              subtitle={t('dashboard.openRequestsSubtitle')}
              icon={AlertCircle}
              tone={openRequests.emergency > 0 ? 'red' : 'amber'}
              href="/operations/requests"
            >
              {openRequests.total > 0 && (
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  {openRequests.emergency > 0 && (
                    <PriorityBadge color="bg-red-100 text-red-700" label={`${openRequests.emergency} emergency`} />
                  )}
                  {openRequests.high > 0 && (
                    <PriorityBadge color="bg-amber-100 text-amber-700" label={`${openRequests.high} high`} />
                  )}
                  {openRequests.normal > 0 && (
                    <PriorityBadge color="bg-blue-100 text-blue-700" label={`${openRequests.normal} normal`} />
                  )}
                </div>
              )}
            </StatWidget>
          )}

          {showInvoices && overdueInvoices && (
            <StatWidget
              title={t('dashboard.overdueInvoices')}
              value={fmt(overdueInvoices.count_overdue)}
              subtitle={
                overdueInvoices.total_overdue > 0
                  ? `${fmtKwd(overdueInvoices.total_overdue)} ${t('dashboard.overdueInvoicesSubtitle')}`
                  : t('dashboard.overdueInvoicesSubtitle')
              }
              icon={Receipt}
              tone={overdueInvoices.count_overdue > 0 ? 'red' : 'green'}
              href="/finance/invoices?status=outstanding"
            >
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <Stat label={t('dashboard.dueSoon')} value={fmt(overdueInvoices.count_due_soon)} color="text-amber-600" />
                <Stat label={t('dashboard.totalOutstanding')} value={fmtKwd(overdueInvoices.total_outstanding)} color="text-gray-600" />
              </div>
            </StatWidget>
          )}

          {showInvoices && revenueMtd && (
            <StatWidget
              title={t('dashboard.revenueMtd')}
              value={fmtKwd(revenueMtd.mtd_total)}
              subtitle={
                revenueDelta !== null ? (
                  <span className={revenueDelta >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {revenueDelta >= 0 ? '↑' : '↓'} {Math.abs(revenueDelta)}% {t('dashboard.vsLastMonth')}
                  </span>
                ) : (
                  t('dashboard.revenueMtdSubtitle')
                )
              }
              icon={TrendingUp}
              tone="green"
              href="/finance/invoices"
            >
              <Sparkline data={revenueMtd.daily_series} height={36} />
            </StatWidget>
          )}
        </div>

        {!showJobs && !showRequests && !showInvoices && (
          <div className="bg-white p-8 rounded-lg border border-gray-200 text-center text-sm text-gray-500">
            {t('dashboard.noActivity')}
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <span className={`font-mono font-semibold ${color}`}>{value}</span>
      <span className="text-gray-500 ms-1">{label}</span>
    </div>
  );
}

function PriorityBadge({ color, label }: { color: string; label: string }) {
  return <span className={`px-1.5 py-0.5 rounded ${color} text-[11px] font-medium`}>{label}</span>;
}
