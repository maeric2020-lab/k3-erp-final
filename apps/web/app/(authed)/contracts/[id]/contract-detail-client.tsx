'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Trash2, Printer } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import type { Contract, Customer, ContractMachine } from '@k3/repositories';

type EnrichedLink = ContractMachine & { machine_summary: string };

interface Props {
  contract: Contract;
  customer: Customer | null;
  machines: EnrichedLink[];
  availableMachines: Array<{ id: string; label: string }>;
  canEdit: boolean;
}

export function ContractDetailClient({ contract, customer, machines, availableMachines, canEdit }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [pickedMachineId, setPickedMachineId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const attach = async () => {
    if (!pickedMachineId) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/contracts/${contract.id}/machines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_machine_id: pickedMachineId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      setPickedMachineId('');
      setPicking(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const detach = async (linkId: string) => {
    if (!confirm(t('common.deleteConfirm'))) return;
    await fetch(`/api/contracts/${contract.id}/machines/${linkId}`, { method: 'DELETE' });
    router.refresh();
  };

  return (
    <>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-sm text-gray-500">{contract.contract_no}</div>
          <h1 className="text-2xl font-bold text-gray-900">{customer?.name_ar ?? '—'}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/contracts/${contract.id}/print`} target="_blank">
            <Button variant="outline" size="sm">
              <Printer className="w-4 h-4 me-1" />
              {t('finance.contractDocument.print')}
            </Button>
          </Link>
          <span className="px-2.5 py-1 rounded-full text-xs bg-brand-50 text-brand-700">
            {contract.contract_type}{contract.is_4_year ? 'G' : ''}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs bg-amber-50 text-amber-700">
            {t(`operations.contracts.statuses.${contract.status}` as any)}
          </span>
        </div>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <Card className="p-6">
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <Field label={t('operations.contracts.startDate')} value={contract.start_date} mono />
          <Field label={t('operations.contracts.endDate')} value={contract.end_date} mono />
          <Field label={t('operations.jobs.totalAmount')} value={`${Number(contract.total_amount).toFixed(3)} KWD`} mono />
        </div>
        {contract.notes && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Label>{t('common.notes')}</Label>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{contract.notes}</p>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">
            {t('operations.contracts.machinesCount')}: {machines.length}
          </h2>
          {canEdit && !picking && availableMachines.length > 0 && (
            <Button size="sm" onClick={() => setPicking(true)}>
              <Plus className="w-4 h-4 me-1" />{t('operations.contracts.addMachine')}
            </Button>
          )}
        </div>

        {picking && (
          <div className="mb-4 p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
            <Label>{t('operations.requests.machine')}</Label>
            <select
              value={pickedMachineId}
              onChange={(e) => setPickedMachineId(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="">—</option>
              {availableMachines.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
            </select>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={attach} disabled={!pickedMachineId || busy}>
                {busy ? t('common.loading') : t('common.add')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPicking(false)}>{t('common.cancel')}</Button>
            </div>
            <p className="text-xs text-gray-500">
              The unit price will be computed automatically from contract_pricing.
            </p>
          </div>
        )}

        {machines.length === 0 ? (
          <p className="text-sm text-gray-500 py-3">{t('common.noData')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="text-start py-2">{t('operations.requests.machine')}</th>
                  <th className="text-end py-2 w-32">{t('masters.sellingPrice')}</th>
                  {canEdit && <th className="w-12"></th>}
                </tr>
              </thead>
              <tbody>
                {machines.map((m) => (
                  <tr key={m.id} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2.5" dir="auto">{m.machine_summary}</td>
                    <td className="text-end font-mono">{Number(m.unit_price_at_signing).toFixed(3)}</td>
                    {canEdit && (
                      <td className="text-end">
                        <button onClick={() => detach(m.id)} className="p-1.5 rounded text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`font-medium ${mono ? 'font-mono' : ''}`}>{value || '—'}</div>
    </div>
  );
}
