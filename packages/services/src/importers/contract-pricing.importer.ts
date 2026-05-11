import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@k3/shared-types';
import {
  MachineCategoriesRepository,
  MachineBrandsRepository,
  RefrigerantTypesRepository,
  MachinesMasterRepository,
  ContractPricingRepository,
} from '@k3/repositories';
import {
  asNumber,
  asString,
  findHeader,
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
 * Contract pricing importer — matches the production K3 file:
 *   قائمة_تسعيير_العقود.xlsx
 *
 * Real headers (after lower-case + whitespace-normalization, "\n" collapsed
 * to a single space by the parser):
 *   "category section" | "machine category" | "unit brand" | "refregration type"
 *   "outddor unit model" | "indoor unit model"
 *   "capacity (hp)" | "capacity (tr)" | "btu/h" | "cfm" | "kw" | "qty"
 *   "co unit price" | "co price"
 *   "cw unit price" | "cw price"
 *   "cwc unit price" | "cwc price"
 *   "cog unit price" | "cog price"
 *   "cwg unit price" | "cwg price"
 *   "cwcg unit price" | "cwcg price"
 *
 * We use the per-UNIT prices ("CO UNIT PRICE" etc.) — the trailing "PRICE"
 * columns in the sheet are unit × QTY totals which we can recompute.
 *
 * Notes:
 *   - Row 2 is an Arabic header translation; col B = "فئة الماكينة". We skip it.
 *   - "REFREGRATION TYPE" may contain "ANY" (compressor not refrigerant-bound)
 *     — we map to NULL in that case.
 *   - Unknown brands are auto-created so the catalog stays consistent.
 *   - Some category labels in the sheet are higher-level than our seed (e.g.
 *     "AIR COOLED CHILLER" → CHILLER). We map known synonyms.
 */

const CATEGORY_SYNONYMS: Record<string, string> = {
  'splt': 'SPLT',
  'split': 'SPLT',
  'pkg': 'PKG',
  'package': 'PKG',
  'air cooled chiller': 'CHILLER',
  'water cooled chiller': 'CHILLER',
  'chiller': 'CHILLER',
  'fcu': 'FCU',
  'ahu': 'AHU',
  'pump': 'OTHER',
  'vrv': 'VRV',
  'vrf': 'VRV',
  'window': 'WINDOW',
  'cassette': 'CASSETTE',
  'ducted': 'DUCTED',
};

export class ContractPricingImporter implements Importer {
  template = 'contract_pricing' as const;

  detect(sheets: ParsedSheet[]): boolean {
    if (sheets.length === 0) return false;
    const s = sheets[0];
    const hasUnit = !!findHeader(s.headers, ['co unit price', 'cw unit price', 'cwc unit price']);
    const hasCog = !!findHeader(s.headers, ['cog unit price', 'cog price']);
    const hasCwcg = !!findHeader(s.headers, ['cwcg unit price', 'cwcg price']);
    const hasCat = !!findHeader(s.headers, ['machine category', 'category', 'category section']);
    return hasUnit && hasCog && hasCwcg && hasCat;
  }

  async prepare(sheets: ParsedSheet[], ctx: ImporterContext): Promise<PreparedRow[]> {
    const sheet = sheets[0];
    if (!sheet) return [];

    const h = {
      category: findHeader(sheet.headers, ['machine category', 'category', 'category section', 'type']),
      brand: findHeader(sheet.headers, ['unit brand', 'brand', 'manufacturer']),
      refrigerant: findHeader(sheet.headers, ['refregration type', 'refrigerant', 'refrigeration type', 'gas', 'gas type']),
      outdoor: findHeader(sheet.headers, ['outddor unit model', 'outdoor unit model', 'outdoor model', 'outdoor']),
      indoor: findHeader(sheet.headers, ['indoor unit model', 'indoor model', 'indoor']),
      capacity_hp: findHeader(sheet.headers, ['capacity (hp)', 'capacity hp', 'hp', 'capacity']),
      capacity_tr: findHeader(sheet.headers, ['capacity (tr)', 'capacity tr', 'tr']),
      btu: findHeader(sheet.headers, ['btu/h', 'btu', 'btuh']),
      cfm: findHeader(sheet.headers, ['cfm']),
      kw: findHeader(sheet.headers, ['kw']),
      // Use UNIT prices — the "PRICE" columns are unit×qty totals
      co: findHeader(sheet.headers, ['co unit price']),
      cw: findHeader(sheet.headers, ['cw unit price']),
      cwc: findHeader(sheet.headers, ['cwc unit price']),
      cog: findHeader(sheet.headers, ['cog unit price']),
      cwg: findHeader(sheet.headers, ['cwg unit price']),
      cwcg: findHeader(sheet.headers, ['cwcg unit price']),
    };

    const required = ['category', 'co', 'cw', 'cwc', 'cog', 'cwg', 'cwcg'] as const;
    for (const k of required) {
      if (!h[k]) {
        return [
          {
            row_number: 1,
            raw: rawWithSheet(sheet.sheet_name, { __error: `Missing required column: ${k}` }),
            resolved: null,
            errors: [{ field: k, message: `Required column "${k}" not found` }],
            action: 'error',
            target_table: 'contract_pricing',
            apply: null,
          },
        ];
      }
    }

    const repos = {
      cats: new MachineCategoriesRepository(ctx.db),
      brands: new MachineBrandsRepository(ctx.db),
      refr: new RefrigerantTypesRepository(ctx.db),
      machines: new MachinesMasterRepository(ctx.db),
      pricing: new ContractPricingRepository(ctx.db),
    };

    const allCats = await repos.cats.list({ active_only: true });

    const prepared: PreparedRow[] = [];

    for (const row of sheet.rows) {
      const cells = row.cells;
      const errors: ValidationError[] = [];

      const categoryName = asString(cells[h.category!]);
      // Skip Arabic translation row (col "machine category" = "فئة الماكينة")
      if (categoryName && /^فئة\s*الماكينة/.test(categoryName)) {
        prepared.push({
          row_number: row.row_number,
          raw: rawWithSheet(sheet.sheet_name, cells),
          resolved: null,
          errors: [{ field: '__row', message: 'Header translation row — skipped' }],
          action: 'skip',
          target_table: 'contract_pricing',
          apply: null,
        });
        continue;
      }

      if (!categoryName) {
        prepared.push({
          row_number: row.row_number,
          raw: rawWithSheet(sheet.sheet_name, cells),
          resolved: null,
          errors: [{ field: 'category', message: 'Category is required' }],
          action: 'error',
          target_table: 'contract_pricing',
          apply: null,
        });
        continue;
      }

      const brandName = h.brand ? asString(cells[h.brand]) : null;
      const refrigerantNameRaw = h.refrigerant ? asString(cells[h.refrigerant]) : null;
      const refrigerantName =
        refrigerantNameRaw && refrigerantNameRaw.toLowerCase() !== 'any' ? refrigerantNameRaw : null;
      const outdoor = h.outdoor ? asString(cells[h.outdoor]) : null;
      const indoor = h.indoor ? asString(cells[h.indoor]) : null;
      const capacityHp = h.capacity_hp ? asNumber(cells[h.capacity_hp]) : null;
      const capacityTr = h.capacity_tr ? asNumber(cells[h.capacity_tr]) : null;
      const btuH = h.btu ? asNumber(cells[h.btu]) : null;
      const cfm = h.cfm ? asNumber(cells[h.cfm]) : null;
      const kw = h.kw ? asNumber(cells[h.kw]) : null;
      const co = asNumber(cells[h.co!]) ?? 0;
      const cw = asNumber(cells[h.cw!]) ?? 0;
      const cwc = asNumber(cells[h.cwc!]) ?? 0;
      const cog = asNumber(cells[h.cog!]) ?? 0;
      const cwg = asNumber(cells[h.cwg!]) ?? 0;
      const cwcg = asNumber(cells[h.cwcg!]) ?? 0;

      // Resolve category by code → synonym → name; fall back to OTHER
      const lower = categoryName.toLowerCase().trim();
      const synonym = CATEGORY_SYNONYMS[lower];
      let category =
        (synonym ? allCats.find((c) => c.code === synonym) : null) ??
        allCats.find((c) => c.code.toLowerCase() === lower) ??
        allCats.find((c) => c.name_en.toLowerCase() === lower) ??
        allCats.find((c) => c.name_ar === categoryName) ??
        null;
      if (!category) category = allCats.find((c) => c.code === 'OTHER') ?? null;
      if (!category) {
        errors.push({ field: 'category', message: `Category "${categoryName}" not found and no OTHER fallback exists` });
      }

      // Resolve / auto-create brand
      let brandId: string | null = null;
      if (brandName) {
        let brand = await repos.brands.getByName(brandName);
        if (!brand) brand = await repos.brands.create({ name: brandName });
        brandId = brand.id;
      }

      // Resolve refrigerant (NULL is OK)
      let refrigerantId: string | null = null;
      if (refrigerantName) {
        const r = await repos.refr.getByCode(refrigerantName);
        if (r) refrigerantId = r.id;
        else errors.push({ field: 'refrigerant', message: `Refrigerant "${refrigerantName}" not in catalog` });
      }

      const resolved = {
        category_code: category?.code,
        category_id: category?.id,
        brand_id: brandId,
        refrigerant_id: refrigerantId,
        outdoor_model: outdoor,
        indoor_model: indoor,
        capacity_hp: capacityHp,
        capacity_tr: capacityTr,
        btu_h: btuH,
        cfm,
        kw,
        co_unit_price: co,
        cw_unit_price: cw,
        cwc_unit_price: cwc,
        cog_unit_price: cog,
        cwg_unit_price: cwg,
        cwcg_unit_price: cwcg,
      };

      if (errors.length > 0 || !category) {
        prepared.push({
          row_number: row.row_number,
          raw: rawWithSheet(sheet.sheet_name, cells),
          resolved: resolved as unknown as Json,
          errors,
          action: 'error',
          target_table: 'contract_pricing',
          apply: null,
        });
        continue;
      }

      const apply = async (db: SupabaseClient<Database>) => {
        const machines = new MachinesMasterRepository(db);
        const pricing = new ContractPricingRepository(db);

        // Best-effort: keep machines_master in sync with contract_pricing
        try {
          const existingMachine = await machines.findByBusinessKey({
            category_id: category!.id,
            brand_id: brandId,
            refrigerant_id: refrigerantId,
            outdoor_model: outdoor,
            indoor_model: indoor,
          });
          if (!existingMachine) {
            await machines.create({
              category_id: category!.id,
              brand_id: brandId,
              refrigerant_id: refrigerantId,
              outdoor_model: outdoor,
              indoor_model: indoor,
              capacity_hp: capacityHp,
              capacity_tr: capacityTr,
              btu_h: btuH,
              cfm,
              kw,
            });
          }
        } catch {
          /* non-blocking */
        }

        const existingPricing = await pricing.findByBusinessKey({
          machine_category_id: category!.id,
          brand_id: brandId,
          refrigerant_id: refrigerantId,
          outdoor_model: outdoor,
          indoor_model: indoor,
          capacity_hp: capacityHp,
        });
        const payload = {
          machine_category_id: category!.id,
          brand_id: brandId,
          refrigerant_id: refrigerantId,
          outdoor_model: outdoor,
          indoor_model: indoor,
          capacity_hp: capacityHp,
          capacity_tr: capacityTr,
          btu_h: btuH,
          cfm,
          kw,
          co_unit_price: co,
          cw_unit_price: cw,
          cwc_unit_price: cwc,
          cog_unit_price: cog,
          cwg_unit_price: cwg,
          cwcg_unit_price: cwcg,
        };
        const r = existingPricing
          ? await pricing.update(existingPricing.id, payload as any)
          : await pricing.create(payload as any);
        return { id: r.id };
      };

      let action: PreparedRow['action'] = 'insert';
      const existingPricing = await repos.pricing.findByBusinessKey({
        machine_category_id: category.id,
        brand_id: brandId,
        refrigerant_id: refrigerantId,
        outdoor_model: outdoor,
        indoor_model: indoor,
        capacity_hp: capacityHp,
      });
      if (existingPricing) action = 'update';

      prepared.push({
        row_number: row.row_number,
        raw: rawWithSheet(sheet.sheet_name, cells),
        resolved: resolved as unknown as Json,
        errors: [],
        action,
        target_table: 'contract_pricing',
        apply,
      });
    }

    return prepared;
  }
}
