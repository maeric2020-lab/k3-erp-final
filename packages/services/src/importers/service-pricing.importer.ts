import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@k3/shared-types';
import {
  ServicesMasterRepository,
  ServiceTypesRepository,
  ServiceCategoriesRepository,
  MachineCategoriesRepository,
  ServicePricingRepository,
} from '@k3/repositories';
import {
  asNumber,
  asString,
  findHeader,
  isCoveredSentinel,
  type ParsedSheet,
} from './../excel';
import {
  rawWithSheet,
  type Importer,
  type ImporterContext,
  type PreparedRow,
  type ValidationError,
} from './../import.service';

/**
 * Service pricing importer — matches the production K3 file:
 *   قائمة_انواع_خدمات_الصيانة_واسعارها.xlsx
 *
 * Real headers (after lower-case normalization by the Excel parser):
 *   "category section", "service type", "service details(ar)",
 *   "service details(en)", "hp", "cost price", "cash", "co", "cw", "cwc",
 *   "qty", "total"
 *
 * Notes specific to the production file:
 *   - There is NO "UG" column. UG always = covered (decision #1), so we hard-set
 *     ug_covered = true / ug_price = 0 for every row.
 *   - Row 2 is an Arabic translation of the header row (column A starts with
 *     "قسم"). We detect and skip it.
 *   - "Include" sentinel in CASH/CO/CW/CWC → covered=true, price=0.
 *   - Each row creates one universal pricing row (machine_category_id = NULL)
 *     because the source lists prices per service, not per (service × category).
 *     Per-category overrides can be added later via the UI.
 */
export class ServicePricingImporter implements Importer {
  template = 'service_pricing' as const;

  detect(sheets: ParsedSheet[]): boolean {
    if (sheets.length === 0) return false;
    const s = sheets[0];
    const hasCash = !!findHeader(s.headers, ['cash', 'cash price']);
    const hasCo = !!findHeader(s.headers, ['co', 'co price']);
    const hasCwc = !!findHeader(s.headers, ['cwc', 'cwc price']);
    const hasService = !!findHeader(s.headers, [
      'service details(en)', 'service details (en)', 'service details en',
      'service name', 'service', 'name', 'name_en',
    ]);
    return hasCash && hasCo && hasCwc && hasService;
  }

  async prepare(sheets: ParsedSheet[], ctx: ImporterContext): Promise<PreparedRow[]> {
    const sheet = sheets[0];
    if (!sheet) return [];

    const h = {
      category_section: findHeader(sheet.headers, ['category section']),
      service_type: findHeader(sheet.headers, ['service type']),
      service_name_en: findHeader(sheet.headers, [
        'service details(en)', 'service details (en)', 'service details en',
        'service name', 'name', 'service', 'name_en',
      ]),
      service_name_ar: findHeader(sheet.headers, [
        'service details(ar)', 'service details (ar)', 'service details ar',
        'name_ar', 'name ar',
      ]),
      capacity_hp: findHeader(sheet.headers, ['hp', 'capacity hp', 'capacity']),
      cost: findHeader(sheet.headers, ['cost price', 'cost']),
      cash: findHeader(sheet.headers, ['cash', 'cash price']),
      co: findHeader(sheet.headers, ['co', 'co price']),
      cw: findHeader(sheet.headers, ['cw', 'cw price']),
      cwc: findHeader(sheet.headers, ['cwc', 'cwc price']),
      ug: findHeader(sheet.headers, ['ug', 'ug price']), // optional — synthesized if missing
    };

    const required = ['service_name_en', 'cash', 'co', 'cw', 'cwc'] as const;
    for (const k of required) {
      if (!h[k]) {
        return [
          {
            row_number: 1,
            raw: rawWithSheet(sheet.sheet_name, { __error: `Missing required column: ${k}` }),
            resolved: null,
            errors: [{ field: k, message: `Required column "${k}" not found` }],
            action: 'error',
            target_table: 'service_pricing',
            apply: null,
          },
        ];
      }
    }

    const repos = {
      svcCats: new ServiceCategoriesRepository(ctx.db),
      svcTypes: new ServiceTypesRepository(ctx.db),
      services: new ServicesMasterRepository(ctx.db),
      machineCats: new MachineCategoriesRepository(ctx.db),
      pricing: new ServicePricingRepository(ctx.db),
    };

    const defaultCat = await repos.svcCats.getByCode('MAINT_SVC');

    const prepared: PreparedRow[] = [];

    for (const row of sheet.rows) {
      const errors: ValidationError[] = [];
      const cells = row.cells;

      const serviceName = asString(cells[h.service_name_en!]);
      const serviceNameAr = h.service_name_ar ? asString(cells[h.service_name_ar]) : null;

      // Skip the Arabic-translation header row (row 2): col A = "قسم الصنف",
      // service_name_en starts with "تفاصيل الخدمة"
      if (serviceName && /^تفاصيل\s*الخدمة/.test(serviceName)) {
        prepared.push({
          row_number: row.row_number,
          raw: rawWithSheet(sheet.sheet_name, cells),
          resolved: null,
          errors: [{ field: '__row', message: 'Header translation row — skipped' }],
          action: 'skip',
          target_table: 'service_pricing',
          apply: null,
        });
        continue;
      }

      if (!serviceName) {
        prepared.push({
          row_number: row.row_number,
          raw: rawWithSheet(sheet.sheet_name, cells),
          resolved: null,
          errors: [{ field: 'service_name_en', message: 'Service name is required' }],
          action: 'error',
          target_table: 'service_pricing',
          apply: null,
        });
        continue;
      }

      const serviceTypeName = h.service_type ? asString(cells[h.service_type]) : null;
      const categorySection = h.category_section ? asString(cells[h.category_section]) : null;
      const capacityHp = h.capacity_hp ? asNumber(cells[h.capacity_hp]) : null;
      const costPrice = h.cost ? asNumber(cells[h.cost]) ?? 0 : 0;

      const readPriced = (header: string | null) => {
        if (!header) return { price: 0, covered: false };
        const v = cells[header];
        if (isCoveredSentinel(v)) return { price: 0, covered: true };
        const n = asNumber(v);
        return { price: n ?? 0, covered: false };
      };
      const cash = readPriced(h.cash);
      const co = readPriced(h.co);
      const cw = readPriced(h.cw);
      const cwc = readPriced(h.cwc);
      const ug = h.ug
        ? readPriced(h.ug)
        : { price: 0, covered: true }; // UG is always covered when not in source

      // Force-fix UG to always-covered (decision #1)
      ug.covered = true;
      ug.price = 0;

      // Resolve service category
      let serviceCategoryId = defaultCat?.id ?? null;
      if (!serviceCategoryId && categorySection) {
        const all = await repos.svcCats.list({ active_only: true });
        const found = all.find(
          (c) =>
            c.name_en.toLowerCase() === categorySection.toLowerCase() ||
            c.name_ar === categorySection ||
            c.code.toLowerCase() === categorySection.toLowerCase()
        );
        serviceCategoryId = found?.id ?? null;
      }
      if (!serviceCategoryId) {
        errors.push({ field: 'category_section', message: 'No service category resolved' });
      }

      // Resolve service type (auto-create within the category if missing)
      let serviceTypeId: string | null = null;
      if (serviceTypeName && serviceCategoryId) {
        const t = await repos.svcTypes.findOrCreateByName(
          serviceCategoryId,
          serviceTypeName,
          serviceTypeName
        );
        serviceTypeId = t.id;
      } else if (serviceCategoryId) {
        const other = await repos.svcTypes.findOrCreateByName(serviceCategoryId, 'Other', 'أخرى');
        serviceTypeId = other.id;
      }
      if (!serviceTypeId) {
        errors.push({ field: 'service_type', message: 'No service type resolved' });
      }

      const resolved = {
        service_name_en: serviceName,
        service_name_ar: serviceNameAr ?? serviceName,
        service_type_id: serviceTypeId,
        service_category_id: serviceCategoryId,
        capacity_hp: capacityHp,
        cost_price: costPrice,
        cash_price: cash.price, cash_covered: cash.covered,
        co_price:   co.price,   co_covered:   co.covered,
        cw_price:   cw.price,   cw_covered:   cw.covered,
        cwc_price:  cwc.price,  cwc_covered:  cwc.covered,
        ug_price:   ug.price,   ug_covered:   ug.covered,
      };

      if (errors.length > 0) {
        prepared.push({
          row_number: row.row_number,
          raw: rawWithSheet(sheet.sheet_name, cells),
          resolved: resolved as unknown as Json,
          errors,
          action: 'error',
          target_table: 'service_pricing',
          apply: null,
        });
        continue;
      }

      const apply = async (db: SupabaseClient<Database>) => {
        const services = new ServicesMasterRepository(db);
        const pricing = new ServicePricingRepository(db);

        let service = await services.findByName(serviceTypeId!, serviceName);
        if (!service) {
          service = await services.create({
            service_type_id: serviceTypeId!,
            name_en: serviceName,
            name_ar: serviceNameAr ?? serviceName,
            capacity_hp: capacityHp,
            unit: 'service',
          });
        }

        const existing = await pricing.findForServiceAndCategory(service.id, null);
        const payload = {
          service_id: service.id,
          machine_category_id: null,
          cost_price: costPrice,
          cash_price: cash.price, cash_covered: cash.covered,
          co_price:   co.price,   co_covered:   co.covered,
          cw_price:   cw.price,   cw_covered:   cw.covered,
          cwc_price:  cwc.price,  cwc_covered:  cwc.covered,
          ug_price:   ug.price,   ug_covered:   ug.covered,
        };
        const r = existing
          ? await pricing.update(existing.id, payload as any)
          : await pricing.create(payload as any);
        return { id: r.id };
      };

      let action: PreparedRow['action'] = 'insert';
      if (serviceTypeId) {
        const existingService = await repos.services.findByName(serviceTypeId, serviceName);
        if (existingService) {
          const existingPricing = await repos.pricing.findForServiceAndCategory(existingService.id, null);
          if (existingPricing) action = 'update';
        }
      }

      prepared.push({
        row_number: row.row_number,
        raw: rawWithSheet(sheet.sheet_name, cells),
        resolved: resolved as unknown as Json,
        errors: [],
        action,
        target_table: 'service_pricing',
        apply,
      });
    }

    return prepared;
  }
}
