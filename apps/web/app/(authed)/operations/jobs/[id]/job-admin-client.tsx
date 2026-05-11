'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { env } from '@/lib/env';
import type {
  Job, Customer, CustomerSite, CustomerMachine, Contract, DocumentLine, Invoice,
} from '@k3/repositories';

interface Tech { id: string; full_name_ar: string | null; full_name_en: string | null; technician_code: string | null }

interface Props {
  job: Job;
  customer: Customer | null;
  site: CustomerSite | null;
  machine: CustomerMachine | null;
  contract: Contract | null;
  lines: DocumentLine[];
  canEdit: boolean;
  technicians: Tech[];
  invoice: Invoice | null;
}

const TIMELINE_FIELDS: Array<{ key: keyof Job; label: string }> = [
  { key: 'assigned_at',           label: 'assigned' },
  { key: 'accepted_at',           label: 'accepted' },
  { key: 'on_way_at',             label: 'on_way' },
  { key: 'arrived_at',            label: 'arrived' },
  { key: 'inspection_started_at', label: 'inspection_started' },
  { key: 'work_started_at',       label: 'work_started' },
  { key: 'report_pending_at',     label: 'report_pending' },
  { key: 'completed_at',          label: 'completed' },
  { key: 'invoiced_at',           label: 'invoiced' },
  { key: 'closed_at',             label: 'closed' },
  { key: 'cancelled_at',          label: 'cancelled' },
];

export function JobAdminClient(props: Props) {
  const { job, customer, site, machine, contract, lines, canEdit, technicians, invoice } = props;
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [assigning, setAssigning] = useState(false);
  const [techId, setTechId] = useState(job.technician_id ?? '');
  const [error, setError] = useState<string | null>(null);

  const reassign = async () => {
    if (!techId) return;
    setError(null);
    setAssigning(true);
    try {
      const res = await fetch(`/api/operations/jobs/${job.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technician_id: techId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-sm text-gray-500">{job.job_no}</div>
          <h1 className="text-2xl font-bold text-gray-900">{customer?.name_ar ?? '—'}</h1>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs bg-amber-50 text-amber-700">
          {t(`operations.jobs.statuses.${job.status}` as any)}
        </span>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      {invoice && (
        <Link
          href={`/finance/invoices/${invoice.id}`}
          className="inline-flex items-center gap-2 text-sm text-brand-600 hover:underline"
        >
          <Receipt className="w-4 h-4" />
          {t('finance.invoices.title')}: <span className="font-mono">{invoice.invoice_no}</span>
          {invoice.is_zero_charge && (
            <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px]">
              {t('finance.invoices.zeroCharge')}
            </span>
          )}
        </Link>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column — facts */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <h2 className="font-semibold mb-3">{t('common.details')}</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <Field label={t('operations.requests.requestType')} value={job.request_type} mono />
              {job.technician_id && (
                <Field
                  label={t('operations.jobs.technician')}
                  value={
                    technicians.find((tx) => tx.id === job.technician_id)
                      ? (locale === 'ar'
                          ? technicians.find((tx) => tx.id === job.technician_id)?.full_name_ar
                          : technicians.find((tx) => tx.id === job.technician_id)?.full_name_en)
                      : '—'
                  }
                />
              )}
              {site && <Field label={t('operations.requests.site')} value={[site.governorate, site.area, site.block, site.street].filter(Boolean).join(' / ')} />}
              {machine && <Field label={t('operations.requests.machine')} value={[machine.outdoor_model, machine.indoor_model].filter(Boolean).join(' / ') || '—'} mono />}
              {contract && <Field label={t('operations.requests.contract')} value={`${contract.contract_no} (${contract.contract_type}${contract.is_4_year ? 'G' : ''})`} mono />}
              <Field label={t('operations.jobs.totalAmount')} value={`${job.total_amount.toFixed(3)} KWD`} mono />
            </div>
            {job.inspection_notes && (
              <div className="pt-4 mt-4 border-t border-gray-200">
                <Label>{t('operations.jobs.inspectionNotes')}</Label>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.inspection_notes}</p>
              </div>
            )}
            {job.technician_notes && (
              <div className="pt-4 mt-4 border-t border-gray-200">
                <Label>{t('operations.jobs.technicianNotes')}</Label>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.technician_notes}</p>
              </div>
            )}
          </Card>

          {/* Lines */}
          <Card className="p-6">
            <h2 className="font-semibold mb-3">{t('operations.jobs.lineItems')}</h2>
            {lines.length === 0 ? (
              <p className="text-sm text-gray-500 py-3">{t('operations.jobs.noLines')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="text-start py-2">{t('common.name')}</th>
                      <th className="text-end py-2 w-20">{t('masters.unit')}</th>
                      <th className="text-end py-2 w-16">×</th>
                      <th className="text-end py-2 w-24">{t('masters.sellingPrice')}</th>
                      <th className="text-end py-2 w-24">{t('common.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id} className="border-b border-gray-100 last:border-b-0">
                        <td className="py-2" dir="auto">
                          <div>{locale === 'ar' ? l.description_ar : (l.description_en || l.description_ar)}</div>
                          {l.is_covered && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px]">
                              {t('operations.jobs.covered')}
                            </span>
                          )}
                        </td>
                        <td className="text-end font-mono text-xs">{l.unit}</td>
                        <td className="text-end font-mono">{l.quantity}</td>
                        <td className="text-end font-mono">{l.unit_price.toFixed(3)}</td>
                        <td className="text-end font-mono">{l.line_total.toFixed(3)}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold">
                      <td colSpan={4} className="text-end py-2">{t('operations.jobs.totalAmount')}</td>
                      <td className="text-end font-mono">{job.total_amount.toFixed(3)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Signatures */}
          {(job.technician_signature_path || job.customer_signature_path) && (
            <Card className="p-6">
              <h2 className="font-semibold mb-3">{t('operations.jobs.signatures')}</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {job.technician_signature_path && (
                  <SignatureView label={t('operations.jobs.technicianSignature')} path={job.technician_signature_path} />
                )}
                {job.customer_signature_path && (
                  <SignatureView
                    label={t('operations.jobs.customerSignature')}
                    path={job.customer_signature_path}
                    name={job.customer_signature_name}
                  />
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right column — timeline + actions */}
        <div className="space-y-6">
          {/* Reassign */}
          {canEdit && job.status !== 'closed' && job.status !== 'cancelled' && (
            <Card className="p-6 space-y-3">
              <h2 className="font-semibold">
                {job.technician_id ? t('operations.jobs.reassign') : t('operations.jobs.assign')}
              </h2>
              <select
                value={techId}
                onChange={(e) => setTechId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">— {t('operations.jobs.technician')} —</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {(locale === 'ar' ? tech.full_name_ar : tech.full_name_en) ?? tech.full_name_ar ?? '—'}
                    {tech.technician_code ? ` (${tech.technician_code})` : ''}
                  </option>
                ))}
              </select>
              <Button onClick={reassign} disabled={assigning || !techId} className="w-full">
                {assigning ? t('common.loading') : t('common.save')}
              </Button>
            </Card>
          )}

          {/* Timeline */}
          <Card className="p-6">
            <h2 className="font-semibold mb-3">{t('operations.jobs.timeline')}</h2>
            <div className="space-y-2">
              {TIMELINE_FIELDS.map((it) => {
                const v = job[it.key] as string | null;
                if (!v) return null;
                return (
                  <div key={String(it.key)} className="flex items-start gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{t(`operations.jobs.statuses.${it.label}` as any)}</div>
                      <div className="text-gray-500">{new Date(v).toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {job.arrived_lat != null && job.arrived_lng != null && (
              <div className="mt-3 pt-3 border-t border-gray-200 text-xs">
                <div className="text-gray-500 mb-0.5">GPS at arrival</div>
                <a
                  href={`https://maps.google.com/?q=${job.arrived_lat},${job.arrived_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-brand-600 hover:underline"
                  dir="ltr"
                >
                  {job.arrived_lat.toFixed(5)}, {job.arrived_lng.toFixed(5)}
                </a>
              </div>
            )}
          </Card>
        </div>
      </div>
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

function SignatureView({ label, path, name }: { label: string; path: string; name?: string | null }) {
  // Generate a public signed URL via the storage API client-side. For Phase 3
  // we use the bucket's read policy (active users); for production we'd switch
  // to signed URLs scoped to the job permission.
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const url = `${supabaseUrl}/storage/v1/object/authenticated/signatures/${path}`;
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <img src={url} alt={label} className="border border-gray-200 rounded-md bg-white max-h-32 w-full object-contain" />
      {name && <div className="text-xs text-gray-700 mt-1 font-medium">{name}</div>}
    </div>
  );
}
