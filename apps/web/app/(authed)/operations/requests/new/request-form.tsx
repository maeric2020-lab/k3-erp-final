'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { maintenanceRequestSchema, type MaintenanceRequestInput, PROBLEM_CODES, REQUEST_TYPES } from '@k3/validators';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

interface SiteOption  { id: string; label: string; is_primary: boolean }
interface MachineOption { id: string; label: string }
interface ContractOption { id: string; label: string; type: string }

interface Props {
  customers: Array<{ id: string; label: string }>;
  allowOtherProblem: boolean;
}

export function RequestForm({ customers, allowOtherProblem }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);

  const form = useForm<MaintenanceRequestInput>({
    resolver: zodResolver(maintenanceRequestSchema),
    defaultValues: {
      customer_id: '',
      site_id: null,
      customer_machine_id: null,
      contract_id: null,
      request_type: 'CASH',
      problem_code: 'no_cooling',
      problem_description: '',
      reported_by: '',
      reported_phone: '',
      scheduled_date: null,
      scheduled_time: null,
      priority: 'normal',
      notes: '',
    },
  });

  const customerId = form.watch('customer_id');
  const requestType = form.watch('request_type');
  const problemCode = form.watch('problem_code');

  // Load dependent data when customer changes
  useEffect(() => {
    if (!customerId) {
      setSites([]); setMachines([]); setContracts([]);
      return;
    }
    let abort = false;
    (async () => {
      try {
        const [sitesRes, machinesRes, contractsRes] = await Promise.all([
          fetch(`/api/customers/${customerId}/sites`),
          fetch(`/api/operations/customer-machines?customer_id=${customerId}`),
          fetch(`/api/contracts?customer_id=${customerId}`),
        ]);
        if (abort) return;
        const sitesJson = sitesRes.ok ? await sitesRes.json() : { sites: [] };
        const machinesJson = machinesRes.ok ? await machinesRes.json() : { rows: [] };
        const contractsJson = contractsRes.ok ? await contractsRes.json() : { rows: [] };
        setSites((sitesJson.sites ?? []).map((s: any) => ({
          id: s.id,
          label: s.site_name ?? `${s.area ?? ''} ${s.block ?? ''}`.trim() ?? 'Site',
          is_primary: !!s.is_primary,
        })));
        setMachines((machinesJson.rows ?? []).map((m: any) => ({
          id: m.id,
          label: `${m.outdoor_model ?? ''}/${m.indoor_model ?? ''} ${m.capacity_hp ? `(${m.capacity_hp}HP)` : ''}`.trim(),
        })));
        setContracts((contractsJson.rows ?? []).filter((c: any) => c.status === 'active' || c.status === 'draft').map((c: any) => ({
          id: c.id, label: `${c.contract_no} (${c.contract_type})`, type: c.contract_type,
        })));
      } catch {
        if (!abort) {
          setSites([]); setMachines([]); setContracts([]);
        }
      }
    })();
    return () => { abort = true; };
  }, [customerId]);

  // Auto-pick primary site when customer changes
  useEffect(() => {
    const primary = sites.find((s) => s.is_primary);
    if (primary) form.setValue('site_id', primary.id);
  }, [sites]);  // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (values: MaintenanceRequestInput) => {
    setServerError(null);
    try {
      const res = await fetch('/api/operations/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      const body = await res.json();
      router.push(`/operations/requests/${body.id}`);
    } catch (e) {
      setServerError((e as Error).message);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 bg-white p-6 rounded-lg border border-gray-200">
      {serverError && <Alert variant="destructive">{serverError}</Alert>}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label htmlFor="customer_id" required>{t('operations.requests.customer')}</Label>
          <select
            id="customer_id"
            {...form.register('customer_id')}
            className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">—</option>
            {customers.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
          </select>
        </div>

        <div>
          <Label htmlFor="site_id">{t('operations.requests.site')}</Label>
          <select
            id="site_id"
            {...form.register('site_id')}
            disabled={!customerId}
            className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">—</option>
            {sites.map((s) => (<option key={s.id} value={s.id}>{s.label}{s.is_primary ? ' ★' : ''}</option>))}
          </select>
        </div>

        <div>
          <Label htmlFor="customer_machine_id">{t('operations.requests.machine')}</Label>
          <select
            id="customer_machine_id"
            {...form.register('customer_machine_id')}
            disabled={!customerId}
            className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">—</option>
            {machines.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
          </select>
        </div>

        <div>
          <Label htmlFor="request_type" required>{t('operations.requests.requestType')}</Label>
          <select
            id="request_type"
            {...form.register('request_type')}
            className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            {REQUEST_TYPES.map((rt) => (
              <option key={rt} value={rt}>{t(`operations.requestTypes.${rt}` as any) ?? rt}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="contract_id" required={requestType !== 'CASH'}>
            {t('operations.requests.contract')}
          </Label>
          <select
            id="contract_id"
            {...form.register('contract_id')}
            disabled={!customerId || requestType === 'CASH'}
            className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">—</option>
            {contracts.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
          </select>
          {requestType !== 'CASH' && contracts.length === 0 && customerId && (
            <p className="text-xs text-amber-700 mt-1">{t('operations.requests.noContractMatch')}</p>
          )}
          {form.formState.errors.contract_id && (
            <p className="text-xs text-red-600 mt-1">{form.formState.errors.contract_id.message as string}</p>
          )}
        </div>

        <div>
          <Label htmlFor="problem_code" required>{t('operations.requests.problem')}</Label>
          <select
            id="problem_code"
            {...form.register('problem_code')}
            className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            {PROBLEM_CODES.filter((p) => p !== 'other' || allowOtherProblem).map((p) => (
              <option key={p} value={p}>{t(`operations.requests.problemCodes.${p}` as any) ?? p}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="priority">{t('operations.requests.priority')}</Label>
          <select
            id="priority"
            {...form.register('priority')}
            className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="low">{t('operations.requests.priorities.low')}</option>
            <option value="normal">{t('operations.requests.priorities.normal')}</option>
            <option value="high">{t('operations.requests.priorities.high')}</option>
            <option value="urgent">{t('operations.requests.priorities.urgent')}</option>
          </select>
        </div>

        {problemCode === 'other' && allowOtherProblem && (
          <div className="sm:col-span-2">
            <Label htmlFor="problem_description" required>{t('operations.requests.problemDescription')}</Label>
            <textarea
              id="problem_description"
              {...form.register('problem_description')}
              className="w-full min-h-[80px] px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            />
            {form.formState.errors.problem_description && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.problem_description.message as string}</p>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="reported_by">{t('operations.requests.reportedBy')}</Label>
          <Input id="reported_by" {...form.register('reported_by')} />
        </div>
        <div>
          <Label htmlFor="reported_phone">{t('operations.requests.reportedPhone')}</Label>
          <Input id="reported_phone" {...form.register('reported_phone')} dir="ltr" />
        </div>
        <div>
          <Label htmlFor="scheduled_date">{t('operations.requests.scheduledDate')}</Label>
          <Input id="scheduled_date" type="date" {...form.register('scheduled_date')} />
        </div>
        <div>
          <Label htmlFor="scheduled_time">{t('operations.requests.scheduledTime')}</Label>
          <Input id="scheduled_time" type="time" {...form.register('scheduled_time')} />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="notes">{t('common.notes')}</Label>
          <textarea
            id="notes"
            {...form.register('notes')}
            className="w-full min-h-[80px] px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t('common.loading') : t('common.save')}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}
