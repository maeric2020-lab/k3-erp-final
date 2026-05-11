'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Briefcase, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import type {
  MaintenanceRequest, Customer, CustomerSite, CustomerMachine, Contract, Job,
} from '@k3/repositories';

interface Tech { id: string; full_name_ar: string | null; full_name_en: string | null; technician_id: string | null }

interface Props {
  request: MaintenanceRequest;
  customer: Customer | null;
  site: CustomerSite | null;
  machine: CustomerMachine | null;
  contract: Contract | null;
  jobs: Job[];
  technicians: Tech[];
  canCreateJob: boolean;
}

export function RequestDetailClient({ request: req, customer, site, machine, contract, jobs, technicians, canCreateJob }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [techId, setTechId] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const convertToJob = async () => {
    setError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/operations/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: req.id, technician_id: techId || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      const body = await res.json();
      router.push(`/operations/jobs/${body.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-sm text-gray-500">{req.request_no}</div>
          <h1 className="text-2xl font-bold text-gray-900">{customer?.name_ar ?? '—'}</h1>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs bg-amber-50 text-amber-700">
          {t(`operations.requests.statuses.${req.status}` as any)}
        </span>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <Card className="p-6 space-y-3">
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <Field label={t('operations.requests.requestType')} value={req.request_type} mono />
          <Field label={t('operations.requests.priority')} value={t(`operations.requests.priorities.${req.priority}` as any)} />
          <Field label={t('operations.requests.problem')} value={t(`operations.requests.problemCodes.${req.problem_code}` as any)} />
          {req.problem_description && <Field label={t('operations.requests.problemDescription')} value={req.problem_description} />}
          {req.scheduled_date && <Field label={t('operations.requests.scheduledDate')} value={req.scheduled_date} />}
          {req.scheduled_time && <Field label={t('operations.requests.scheduledTime')} value={req.scheduled_time} />}
          {req.reported_by && <Field label={t('operations.requests.reportedBy')} value={req.reported_by} />}
          {req.reported_phone && <Field label={t('operations.requests.reportedPhone')} value={req.reported_phone} />}
          {site && <Field label={t('operations.requests.site')} value={[site.governorate, site.area, site.block, site.street].filter(Boolean).join(' / ')} />}
          {machine && <Field label={t('operations.requests.machine')} value={[machine.outdoor_model, machine.indoor_model].filter(Boolean).join(' / ') || '—'} mono />}
          {contract && <Field label={t('operations.requests.contract')} value={`${contract.contract_no} (${contract.contract_type}${contract.is_4_year ? 'G' : ''})`} mono />}
        </div>
        {req.notes && (
          <div className="pt-2 border-t border-gray-200">
            <Label>{t('common.notes')}</Label>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{req.notes}</p>
          </div>
        )}
      </Card>

      {/* Existing jobs for this request */}
      <Card className="p-6">
        <h2 className="font-semibold mb-3">{t('operations.jobs.title')}</h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-gray-500 py-3">{t('common.noData')}</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <Link key={job.id} href={`/operations/jobs/${job.id}`} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                <div className="flex items-center gap-2 min-w-0">
                  <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="font-mono text-sm">{job.job_no}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                    {t(`operations.jobs.statuses.${job.status}` as any)}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 rtl:rotate-180" />
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Convert to job */}
      {canCreateJob && req.status !== 'closed' && req.status !== 'cancelled' && (
        <Card className="p-6 space-y-3">
          <h2 className="font-semibold">{t('operations.requests.convertToJob')}</h2>
          <div>
            <Label htmlFor="tech">{t('operations.jobs.technician')}</Label>
            <select
              id="tech"
              value={techId}
              onChange={(e) => setTechId(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="">— {t('common.optional')} —</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {(locale === 'ar' ? tech.full_name_ar : tech.full_name_en) ?? tech.full_name_ar ?? '—'}
                  {tech.technician_id ? ` (${tech.technician_id})` : ''}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={convertToJob} disabled={creating}>
            {creating ? t('common.loading') : t('operations.requests.convertToJob')}
          </Button>
        </Card>
      )}
    </>
  );
}

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`font-medium ${mono ? 'font-mono text-sm' : ''}`} dir="auto">{value || '—'}</div>
    </div>
  );
}
