import { requireUser } from '@/lib/auth/require-user';
import { JobsRepository, CustomersRepository } from '@k3/repositories';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  assigned: 'bg-blue-50 text-blue-700 border-blue-200',
  accepted: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  on_way: 'bg-purple-50 text-purple-700 border-purple-200',
  arrived: 'bg-amber-50 text-amber-700 border-amber-200',
  inspection_started: 'bg-amber-100 text-amber-800 border-amber-300',
  work_started: 'bg-orange-100 text-orange-800 border-orange-300',
  report_pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  completed: 'bg-green-50 text-green-700 border-green-200',
  invoiced: 'bg-green-100 text-green-800 border-green-300',
  closed: 'bg-gray-50 text-gray-600 border-gray-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const ACTIVE_STATUSES = [
  'assigned', 'accepted', 'on_way', 'arrived',
  'inspection_started', 'work_started', 'report_pending',
];

export default async function MyJobsPage() {
  const ctx = await requireUser('/my-jobs');
  const repo = new JobsRepository(ctx.supabase);
  const customers = new CustomersRepository(ctx.supabase);

  const allJobs = await repo.listForTechnician(ctx.profile.id);
  const active = allJobs.filter((j) => ACTIVE_STATUSES.includes(j.status));
  const recent = allJobs.filter((j) => !ACTIVE_STATUSES.includes(j.status)).slice(0, 10);

  // Pre-fetch customer names in one batch
  const customerIds = Array.from(new Set([...active, ...recent].map((j) => j.customer_id)));
  const customerRows = customerIds.length
    ? await Promise.all(customerIds.map((id) => customers.getById(id).catch(() => null)))
    : [];
  const customerMap = new Map(customerRows.filter((c): c is NonNullable<typeof c> => !!c).map((c) => [c.id, c]));

  const t = await getTranslations();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('operations.jobs.myTitle')}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {active.length > 0
            ? `${active.length} ${t('common.active').toLowerCase()}`
            : t('common.noData')}
        </p>
      </div>

      {/* Active jobs — these are the cards a technician taps to enter their workflow */}
      {active.length > 0 && (
        <div className="space-y-3">
          {active.map((job) => {
            const cust = customerMap.get(job.customer_id);
            const colorCls = STATUS_COLORS[job.status] ?? 'bg-gray-50 border-gray-200';
            return (
              <Link
                key={job.id}
                href={`/my-jobs/${job.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 active:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-gray-500">{job.job_no}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${colorCls}`}>
                        {t(`operations.jobs.statuses.${job.status}` as any)}
                      </span>
                    </div>
                    <div className="font-semibold text-gray-900 truncate">
                      {cust?.name_ar ?? '—'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {t(`customers.types.${job.request_type === 'CASH' ? 'individual' : 'company'}` as any) /* placeholder */}
                      {' · '}
                      {job.request_type}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 mt-1 rtl:rotate-180" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {recent.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            {t('imports.history')}
          </h2>
          {recent.map((job) => {
            const cust = customerMap.get(job.customer_id);
            return (
              <Link
                key={job.id}
                href={`/my-jobs/${job.id}`}
                className="block bg-gray-50 rounded-lg border border-gray-200 p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-500">{job.job_no}</span>
                  <span className="text-sm text-gray-700 truncate flex-1">{cust?.name_ar ?? '—'}</span>
                  <span className="text-xs text-gray-500">
                    {t(`operations.jobs.statuses.${job.status}` as any)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {active.length === 0 && recent.length === 0 && (
        <div className="text-center py-16 text-gray-500">{t('common.noData')}</div>
      )}
    </div>
  );
}
