'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { ContractDocument } from '@k3/services';
import type { CompanySettings } from '@k3/repositories';
import { env } from '@/lib/env';

interface Props { doc: ContractDocument; company: CompanySettings | null }

export function ContractPrintClient({ doc, company }: Props) {
  const t = useTranslations();
  const { contract, customer, site, clauses, machines, total_amount } = doc;
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const logoUrl = company?.logo_path ? `${supabaseUrl}/storage/v1/object/public/branding/${company.logo_path}` : null;

  useEffect(() => {
    // Hide app chrome and prepare the page for printing — the user clicks
    // "Print" in their browser and saves as PDF.
    document.body.classList.add('print-page');
    return () => document.body.classList.remove('print-page');
  }, []);

  const triggerPrint = () => window.print();

  return (
    <>
      <style jsx global>{`
        body.print-page { background: #f3f4f6; }
        body.print-page > div > nav,
        body.print-page > div > aside,
        body.print-page header,
        body.print-page nav,
        body.print-page aside { display: none !important; }
        @media print {
          @page { size: A4; margin: 14mm 12mm; }
          body { background: white !important; }
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .clause { page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between max-w-[210mm] mx-auto px-4">
        <button onClick={() => window.history.back()} className="text-sm text-gray-600 hover:text-gray-900">← {t('common.cancel')}</button>
        <button onClick={triggerPrint} className="px-4 py-2 rounded-md bg-brand-600 text-white text-sm font-medium hover:bg-brand-700">
          {t('finance.contractDocument.print')}
        </button>
      </div>

      <div className="print-area max-w-[210mm] mx-auto bg-white shadow-md p-12 text-gray-900" style={{ minHeight: '297mm' }} dir="rtl">
        {/* Letterhead */}
        <header className="flex items-start justify-between gap-6 pb-4 border-b-2 border-gray-900">
          {logoUrl && <img src={logoUrl} alt="K3 logo" className="h-20 object-contain" />}
          <div className="text-end flex-1 ms-4">
            <h1 className="text-xl font-bold">{company?.name_ar ?? 'شركة كي ثري للتجارة العامة والمقاولات'}</h1>
            <p className="text-sm text-gray-600">{company?.name_en ?? 'K. Three Co. for General Trading and Contracting'}</p>
            {company?.phone && <p className="text-xs text-gray-500 mt-1" dir="ltr">{company.phone}</p>}
          </div>
        </header>

        {/* Title */}
        <div className="text-center my-6">
          <h2 className="text-2xl font-bold">عقد صيانة وحدات تكييف</h2>
          <p className="text-sm text-gray-600 mt-1">Air-conditioning maintenance contract</p>
          <div className="flex justify-between items-center mt-3 text-sm">
            <span className="font-mono">{contract.contract_no}</span>
            <span className="font-mono">{contract.contract_type}{contract.is_4_year ? 'G' : ''}</span>
          </div>
        </div>

        {/* Parties */}
        <section className="mb-6 text-sm leading-relaxed">
          <p className="mb-2">
            <span className="font-bold">الطرف الأول:</span> {company?.name_ar ?? 'شركة كي ثري للتجارة العامة والمقاولات'}
          </p>
          <p className="mb-2">
            <span className="font-bold">الطرف الثاني:</span> <span dir="auto">{customer?.name_ar ?? '—'}</span>
            {customer?.code && <span className="text-gray-500 ms-2 font-mono">({customer.code})</span>}
          </p>
          {site && (
            <p className="mb-2">
              <span className="font-bold">موقع العقد:</span>{' '}
              <span dir="auto">
                {[site.governorate, site.area, site.block, site.street].filter(Boolean).join(' · ')}
              </span>
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <p><span className="font-bold">تاريخ البدء:</span> <span className="font-mono" dir="ltr">{contract.start_date}</span></p>
            <p><span className="font-bold">تاريخ الانتهاء:</span> <span className="font-mono" dir="ltr">{contract.end_date}</span></p>
          </div>
        </section>

        {/* Machines table — note: NO per-machine prices per locked decision */}
        <section className="mb-6">
          <h3 className="font-bold mb-2 pb-1 border-b border-gray-300">الوحدات المغطاة بالعقد · Covered units</h3>
          {machines.length === 0 ? (
            <p className="text-sm text-gray-500">لا توجد وحدات مرتبطة بعد.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-xs">
                  <th className="border border-gray-300 p-2 text-end">#</th>
                  <th className="border border-gray-300 p-2 text-end">النوع · Type</th>
                  <th className="border border-gray-300 p-2 text-end">الماركة · Brand</th>
                  <th className="border border-gray-300 p-2 text-end">القدرة · HP</th>
                  <th className="border border-gray-300 p-2 text-end">الموديل · Model</th>
                  <th className="border border-gray-300 p-2 text-end">الرقم التسلسلي · Serial</th>
                </tr>
              </thead>
              <tbody>
                {machines.map((m, i) => (
                  <tr key={m.id}>
                    <td className="border border-gray-300 p-2 font-mono text-xs">{i + 1}</td>
                    <td className="border border-gray-300 p-2">{m.category_ar}</td>
                    <td className="border border-gray-300 p-2 font-mono text-xs" dir="ltr">{m.brand ?? '—'}</td>
                    <td className="border border-gray-300 p-2 font-mono text-xs" dir="ltr">{m.capacity_hp ?? '—'}</td>
                    <td className="border border-gray-300 p-2 font-mono text-xs" dir="ltr">{[m.outdoor_model, m.indoor_model].filter(Boolean).join(' / ') || '—'}</td>
                    <td className="border border-gray-300 p-2 font-mono text-xs" dir="ltr">{m.serial_number ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-3 text-end">
            <p className="font-bold text-base">
              الإجمالي · Total: <span className="font-mono" dir="ltr">{total_amount.toFixed(3)} KWD</span>
            </p>
          </div>
        </section>

        {/* Clauses — bilingual */}
        {clauses.map((cl) => (
          <section key={cl.id} className="clause mb-5">
            <h3 className="font-bold mb-1 pb-1 border-b border-gray-300">
              {cl.title_ar} <span className="text-gray-500 text-sm font-normal">· {cl.title_en}</span>
            </h3>
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              <p dir="rtl" className="mb-2">{cl.body_ar}</p>
              <p dir="ltr" className="text-gray-600 italic">{cl.body_en}</p>
            </div>
          </section>
        ))}

        {/* Footer */}
        <footer className="mt-10 pt-6 border-t border-gray-300 text-xs text-gray-500 flex items-center justify-between">
          <span>{contract.contract_no}</span>
          <span>{new Date().toLocaleDateString('ar-KW')}</span>
        </footer>
      </div>
    </>
  );
}
