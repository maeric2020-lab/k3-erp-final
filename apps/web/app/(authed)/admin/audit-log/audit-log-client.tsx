'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight, Filter, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AuditLog } from '@k3/repositories';

type EnrichedAuditLog = AuditLog & { user_name: string };

interface Props {
  initialRows: EnrichedAuditLog[];
  entityTypes: string[];
  actions: string[];
  users: Array<{ id: string; label: string }>;
  initialFilters: {
    user_id?: string;
    entity_type?: string;
    entity_id?: string;
    action?: string;
    from_date?: string;
    to_date?: string;
  };
}

export function AuditLogClient({ initialRows, entityTypes, actions, users, initialFilters }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    user_id: initialFilters.user_id ?? '',
    entity_type: initialFilters.entity_type ?? '',
    entity_id: initialFilters.entity_id ?? '',
    action: initialFilters.action ?? '',
    from_date: initialFilters.from_date ?? '',
    to_date: initialFilters.to_date ?? '',
  });

  const applyFilters = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    const qs = params.toString();
    router.push(qs ? `/admin/audit-log?${qs}` : '/admin/audit-log');
  };
  const clearFilters = () => {
    setFilters({ user_id: '', entity_type: '', entity_id: '', action: '', from_date: '', to_date: '' });
    router.push('/admin/audit-log');
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const hasActiveFilters = Object.values(filters).some((v) => v);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.auditLog.title')}</h1>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="w-4 h-4 me-1" />
          {t('admin.auditLog.filters')}
          {hasActiveFilters && (
            <span className="ms-2 px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 text-[10px]">
              {Object.values(filters).filter(Boolean).length}
            </span>
          )}
        </Button>
      </div>

      {showFilters && (
        <Card className="p-6 space-y-3">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="f_user">{t('admin.auditLog.user')}</Label>
              <select id="f_user" value={filters.user_id}
                onChange={(e) => setFilters((s) => ({ ...s, user_id: e.target.value }))}
                className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                <option value="">—</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="f_entity">{t('admin.auditLog.entity')}</Label>
              <select id="f_entity" value={filters.entity_type}
                onChange={(e) => setFilters((s) => ({ ...s, entity_type: e.target.value }))}
                className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                <option value="">—</option>
                {entityTypes.map((et) => <option key={et} value={et}>{et}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="f_action">{t('admin.auditLog.action')}</Label>
              <select id="f_action" value={filters.action}
                onChange={(e) => setFilters((s) => ({ ...s, action: e.target.value }))}
                className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                <option value="">—</option>
                {actions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="f_eid">{t('admin.auditLog.entityId')}</Label>
              <Input id="f_eid" value={filters.entity_id}
                onChange={(e) => setFilters((s) => ({ ...s, entity_id: e.target.value }))}
                dir="ltr" placeholder="UUID" />
            </div>
            <div>
              <Label htmlFor="f_from">{t('admin.auditLog.fromDate')}</Label>
              <Input id="f_from" type="datetime-local" value={filters.from_date}
                onChange={(e) => setFilters((s) => ({ ...s, from_date: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <Label htmlFor="f_to">{t('admin.auditLog.toDate')}</Label>
              <Input id="f_to" type="datetime-local" value={filters.to_date}
                onChange={(e) => setFilters((s) => ({ ...s, to_date: e.target.value }))} dir="ltr" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={applyFilters}>{t('common.search')}</Button>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                <X className="w-4 h-4 me-1" />{t('common.cancel')}
              </Button>
            )}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        {initialRows.length === 0 ? (
          <p className="text-sm text-gray-500 p-8 text-center">{t('common.noData')}</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {initialRows.map((row) => {
              const isOpen = expanded.has(row.id);
              const hasDelta = row.before_data || row.after_data;
              return (
                <div key={row.id} className="p-3 hover:bg-gray-50">
                  <button
                    onClick={() => hasDelta && toggleExpand(row.id)}
                    className="w-full text-start flex items-center gap-3"
                  >
                    {hasDelta ? (
                      isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                             : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 rtl:rotate-180" />
                    ) : (
                      <div className="w-4 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0 grid sm:grid-cols-4 gap-2 items-baseline">
                      <span className="text-xs text-gray-500 font-mono whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString()}
                      </span>
                      <span className="font-medium" dir="auto">{row.user_name}</span>
                      <span className="text-sm">
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">{row.action}</span>
                        <span className="ms-2 text-gray-500">{row.entity_type}</span>
                      </span>
                      {row.entity_id && (
                        <span className="text-xs text-gray-400 font-mono truncate" dir="ltr">{row.entity_id}</span>
                      )}
                    </div>
                  </button>

                  {isOpen && hasDelta && (
                    <div className="mt-3 ms-7 grid sm:grid-cols-2 gap-3">
                      {row.before_data && (
                        <div>
                          <div className="text-xs font-semibold text-gray-500 mb-1">{t('admin.auditLog.viewBefore')}</div>
                          <pre className="text-xs bg-red-50 border border-red-100 rounded p-2 overflow-x-auto" dir="ltr">
                            {JSON.stringify(row.before_data, null, 2)}
                          </pre>
                        </div>
                      )}
                      {row.after_data && (
                        <div>
                          <div className="text-xs font-semibold text-gray-500 mb-1">{t('admin.auditLog.viewAfter')}</div>
                          <pre className="text-xs bg-green-50 border border-green-100 rounded p-2 overflow-x-auto" dir="ltr">
                            {JSON.stringify(row.after_data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
