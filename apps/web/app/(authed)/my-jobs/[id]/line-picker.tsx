'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { X, Search, Wrench, Package, Droplet } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

interface Props {
  jobId: string;
  customerMachineId: string | null;
  requestType: string;
  onAdd: (line: any) => Promise<void>;
  onClose: () => void;
}

type Tab = 'service' | 'part' | 'gas';

interface Option {
  id: string;
  name_ar?: string;
  name_en?: string;
  refrigerant_name?: string;
  unit: string;
  unit_price: number;
  is_covered?: boolean;
}

export function LinePicker({ jobId, customerMachineId, requestType, onAdd, onClose }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>('service');
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Debounced fetch
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchOptions = async () => {
      try {
        let url = '';
        if (tab === 'service') {
          const params = new URLSearchParams();
          if (customerMachineId) params.set('customer_machine_id', customerMachineId);
          params.set('request_type', requestType);
          if (search) params.set('q', search);
          url = `/api/operations/line-picker/services?${params}`;
        } else if (tab === 'part') {
          const params = new URLSearchParams();
          if (customerMachineId) params.set('customer_machine_id', customerMachineId);
          if (search) params.set('q', search);
          url = `/api/operations/line-picker/parts?${params}`;
        } else {
          url = '/api/operations/line-picker/gas';
        }

        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `${res.status}`);
        }
        const body = await res.json();
        if (!cancelled) {
          if (tab === 'service') {
            setOptions(body.options.map((o: any) => ({
              id: o.service_id, name_ar: o.name_ar, name_en: o.name_en,
              unit: o.unit, unit_price: o.unit_price, is_covered: o.is_covered,
            })));
          } else if (tab === 'part') {
            setOptions(body.options.map((o: any) => ({
              id: o.part_id, name_ar: o.name_ar, name_en: o.name_en,
              unit: o.unit, unit_price: o.unit_price, is_covered: o.is_covered,
            })));
          } else {
            setOptions(body.options.map((o: any) => ({
              id: o.gas_id, refrigerant_name: o.refrigerant_name,
              unit: 'kg', unit_price: o.unit_price,
            })));
          }
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const handle = setTimeout(fetchOptions, search ? 250 : 0);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [tab, search, customerMachineId, requestType]);

  const addLine = async (option: Option) => {
    setAdding(option.id);
    try {
      const qty = quantities[option.id] ?? 1;
      const payload: any = {
        line_type: tab,
        quantity: qty,
      };
      if (tab === 'service') payload.service_id = option.id;
      if (tab === 'part') payload.part_id = option.id;
      if (tab === 'gas') payload.gas_id = option.id;
      await onAdd(payload);
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[90vh] sm:max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-semibold">{t('operations.jobs.addLine')}</h3>
          <button onClick={onClose} className="p-1 -m-1 rounded-md hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {([
            { k: 'service', icon: Wrench, label: 'addService' },
            { k: 'part',    icon: Package, label: 'addPart' },
            { k: 'gas',     icon: Droplet, label: 'addGas' },
          ] as const).map((it) => (
            <button
              key={it.k}
              onClick={() => setTab(it.k)}
              className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-medium border-b-2 transition-colors ${
                tab === it.k ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <it.icon className="w-4 h-4" />
              {t(`operations.jobs.${it.label}` as any)}
            </button>
          ))}
        </div>

        {/* Search */}
        {(tab === 'service' || tab === 'part') && (
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('common.search')}
                className="ps-9"
              />
            </div>
          </div>
        )}

        {/* Options list */}
        <div className="flex-1 overflow-y-auto">
          {error && <div className="p-3"><Alert variant="destructive">{error}</Alert></div>}
          {loading && <div className="p-6 text-center text-gray-500">{t('common.loading')}</div>}
          {!loading && !error && options.length === 0 && (
            <div className="p-6 text-center text-gray-500">{t('common.noResults')}</div>
          )}
          {!loading && options.length > 0 && (
            <div className="divide-y divide-gray-100">
              {options.map((o) => {
                const display = o.refrigerant_name
                  ? o.refrigerant_name
                  : (locale === 'ar' ? (o.name_ar || o.name_en) : (o.name_en || o.name_ar)) ?? '—';
                const qty = quantities[o.id] ?? 1;
                return (
                  <div key={o.id} className="p-3 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate" dir="auto">{display}</div>
                      <div className="text-xs text-gray-500">
                        {o.unit_price.toFixed(3)} KWD / {o.unit}
                        {o.is_covered && (
                          <span className="ms-2 inline-block px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px]">
                            {t('operations.jobs.covered')}
                          </span>
                        )}
                      </div>
                    </div>
                    <Input
                      type="number"
                      step="any"
                      value={qty}
                      onChange={(e) => setQuantities((s) => ({ ...s, [o.id]: Math.max(0.1, Number(e.target.value) || 1) }))}
                      className="w-20 text-center"
                    />
                    <Button size="sm" onClick={() => addLine(o)} disabled={adding === o.id}>
                      {adding === o.id ? '…' : t('common.add')}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-gray-200">
          <Button variant="outline" className="w-full" onClick={onClose}>{t('common.close')}</Button>
        </div>
      </div>
    </div>
  );
}
