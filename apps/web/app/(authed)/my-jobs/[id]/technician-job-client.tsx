'use client';

import { useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  CheckCircle2,
  MapPin,
  PlayCircle,
  Search,
  Wrench,
  FileText,
  Phone,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { Job, Customer, CustomerSite, CustomerMachine, DocumentLine } from '@k3/repositories';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LinePicker } from './line-picker';
import { SignaturePad } from './signature-pad';
import Link from 'next/link';

interface Props {
  job: Job;
  customer: Customer | null;
  site: CustomerSite | null;
  machine: CustomerMachine | null;
  lines: DocumentLine[];
}

/**
 * Mobile-first technician job workflow.
 *
 * Status is NEVER shown as a generic field. Instead, the screen renders the
 * single "next step" button matching where the job is in its lifecycle. Each
 * tap calls /step which advances the DB-level status machine.
 *
 * Lines added during work_started flow through compute_line_pricing.
 */
export function TechnicianJobClient({ job: initialJob, customer, site, machine, lines: initialLines }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const [job, setJob] = useState<Job>(initialJob);
  const [lines, setLines] = useState<DocumentLine[]>(initialLines);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showLinePicker, setShowLinePicker] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  const callStep = async (step: string, payload: any = {}) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/operations/jobs/${job.id}/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, ...payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      // Re-fetch job to get fresh state
      const fresh = await fetch(`/api/operations/jobs/${job.id}`).then((r) => r.json());
      setJob(fresh.job);
      setLines(fresh.lines ?? []);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const requestGeolocation = (): Promise<GeolocationPosition> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
      });
    });

  const handleArrived = async () => {
    setError(null);
    try {
      const pos = await requestGeolocation();
      await callStep('arrived', { arrived_lat: pos.coords.latitude, arrived_lng: pos.coords.longitude });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleAddLine = async (linePayload: any) => {
    setError(null);
    try {
      const res = await fetch(`/api/operations/jobs/${job.id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(linePayload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      // Reload lines
      const fresh = await fetch(`/api/operations/jobs/${job.id}/lines`).then((r) => r.json());
      setLines(fresh.lines ?? []);
      // Re-fetch job for updated total_amount
      const j = await fetch(`/api/operations/jobs/${job.id}`).then((r) => r.json());
      setJob(j.job);
      setShowLinePicker(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleRemoveLine = async (lineId: string) => {
    if (!confirm(t('common.deleteConfirm'))) return;
    await fetch(`/api/operations/jobs/${job.id}/lines/${lineId}`, { method: 'DELETE' });
    const fresh = await fetch(`/api/operations/jobs/${job.id}/lines`).then((r) => r.json());
    setLines(fresh.lines ?? []);
    const j = await fetch(`/api/operations/jobs/${job.id}`).then((r) => r.json());
    setJob(j.job);
  };

  const handleSignaturesSubmitted = async (paths: { technician: string; customer?: string; customerName?: string }) => {
    await callStep('submit_signatures', {
      technician_signature_path: paths.technician,
      customer_signature_path: paths.customer,
      customer_signature_name: paths.customerName,
    });
    setShowSignaturePad(false);
  };

  // ---------------------------------------------------------------------------
  // Determine which "next step" button to show based on job.status
  // ---------------------------------------------------------------------------
  const nextStep = (() => {
    switch (job.status) {
      case 'assigned':           return { step: 'accept',           label: 'accept',           icon: CheckCircle2,  primary: true };
      case 'accepted':           return { step: 'on_way',           label: 'on_way',           icon: MapPin,        primary: true };
      case 'on_way':             return { step: 'arrived',          label: 'arrived',          icon: MapPin,        primary: true, requiresGps: true };
      case 'arrived':            return { step: 'start_inspection', label: 'start_inspection', icon: Search,        primary: true };
      case 'inspection_started': return { step: 'start_work',       label: 'start_work',       icon: PlayCircle,    primary: true };
      case 'work_started':       return { step: 'mark_complete',    label: 'mark_complete',    icon: CheckCircle2,  primary: false };
      case 'report_pending':     return { step: 'submit_signatures', label: 'submit_signatures', icon: FileText,    primary: true, requiresSig: true };
      default: return null;
    }
  })();

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 -mx-4 px-4 py-3 z-10">
        <div className="flex items-center gap-3">
          <Link href="/my-jobs" className="p-2 -m-2 rounded-md hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-xs text-gray-500">{job.job_no}</div>
            <div className="font-semibold truncate">
              {customer?.name_ar ?? '—'}
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs bg-brand-50 text-brand-700">
            {job.request_type}
          </span>
        </div>
      </div>

      <div className="space-y-4 mt-4 px-1">
        {error && <Alert variant="destructive">{error}</Alert>}

        {/* Customer / site / machine summary */}
        <Card className="p-4 space-y-2">
          {customer && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{t('operations.requests.customer')}</span>
              <span className="font-medium text-end" dir="auto">{customer.name_ar}</span>
            </div>
          )}
          {customer?.phone_primary && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{t('common.phone')}</span>
              <a href={`tel:${customer.phone_primary}`} className="font-medium text-brand-600 inline-flex items-center gap-1" dir="ltr">
                <Phone className="w-3.5 h-3.5" />
                {customer.phone_primary}
              </a>
            </div>
          )}
          {site && (
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm text-gray-500">{t('operations.requests.site')}</span>
              <span className="text-sm text-end" dir="auto">
                {[site.governorate, site.area, site.block, site.street].filter(Boolean).join(' / ')}
              </span>
            </div>
          )}
          {machine && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{t('operations.requests.machine')}</span>
              <span className="font-medium text-sm" dir="ltr">
                {[machine.outdoor_model, machine.indoor_model].filter(Boolean).join(' / ')}
              </span>
            </div>
          )}
        </Card>

        {/* Status chip */}
        <Card className="p-4">
          <div className="text-xs text-gray-500 mb-1">{t('common.status')}</div>
          <div className="text-lg font-semibold">
            {t(`operations.jobs.statuses.${job.status}` as any)}
          </div>
        </Card>

        {/* Work lines (visible from work_started onwards) */}
        {(job.status === 'work_started' || job.status === 'report_pending' || job.status === 'completed' || job.status === 'invoiced' || job.status === 'closed') && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{t('operations.jobs.lineItems')}</h3>
              {job.status === 'work_started' && (
                <Button size="sm" onClick={() => setShowLinePicker(true)}>
                  <Plus className="w-4 h-4 me-1" />{t('operations.jobs.addLine')}
                </Button>
              )}
            </div>

            {lines.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-500">{t('operations.jobs.noLines')}</div>
            ) : (
              <div className="space-y-2">
                {lines.map((line) => (
                  <div key={line.id} className="flex items-start justify-between gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm" dir="auto">
                        {locale === 'ar' ? line.description_ar : (line.description_en || line.description_ar)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {line.quantity} × {line.unit_price.toFixed(3)} KWD
                        {line.is_covered && (
                          <span className="ms-2 inline-block px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px]">
                            {t('operations.jobs.covered')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="font-mono text-sm">{line.line_total.toFixed(3)}</div>
                      {job.status === 'work_started' && (
                        <button
                          onClick={() => handleRemoveLine(line.id)}
                          className="mt-1 p-1 text-red-600 hover:bg-red-50 rounded"
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3 border-t border-gray-200 font-semibold">
                  <span>{t('operations.jobs.totalAmount')}</span>
                  <span className="font-mono">{job.total_amount.toFixed(3)} KWD</span>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Step button */}
        {nextStep && (
          <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 p-4 z-20">
            <div className="max-w-2xl mx-auto flex gap-2">
              <Button
                className="flex-1 h-12 text-base"
                disabled={busy}
                onClick={() => {
                  if (nextStep.requiresGps) handleArrived();
                  else if (nextStep.requiresSig) setShowSignaturePad(true);
                  else callStep(nextStep.step);
                }}
              >
                <nextStep.icon className="w-5 h-5 me-2" />
                {t(`operations.jobs.steps.${nextStep.label}` as any)}
              </Button>
              {(['assigned','accepted','on_way','arrived','inspection_started','work_started'].includes(job.status)) && (
                <Button
                  variant="outline"
                  className="h-12"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(t('common.deleteConfirm'))) callStep('cancel');
                  }}
                  aria-label={t('operations.jobs.steps.cancel')}
                >
                  <XCircle className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showLinePicker && (
        <LinePicker
          jobId={job.id}
          customerMachineId={job.customer_machine_id}
          requestType={job.request_type}
          onAdd={handleAddLine}
          onClose={() => setShowLinePicker(false)}
        />
      )}
      {showSignaturePad && (
        <SignaturePad
          jobId={job.id}
          onSubmit={handleSignaturesSubmitted}
          onClose={() => setShowSignaturePad(false)}
        />
      )}
    </div>
  );
}
