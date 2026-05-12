import type { K3SupabaseClient, Database, Json } from '@k3/shared-types';
import {
  CustomersRepository,
  MachineCategoriesRepository,
  MachineBrandsRepository,
  RefrigerantTypesRepository,
  MachinesMasterRepository,
  SparePartCategoriesRepository,
  SparePartsMasterRepository,
  GasTypesMasterRepository,
} from '@k3/repositories';
import { asNumber, asString, findHeader, type ParsedSheet } from './../excel';
import {
  rawWithSheet,
  type Importer,
  type ImporterContext,
  type PreparedRow,
  type ValidationError,
} from './../import.service';

// -----------------------------------------------------------------------------
// CustomersImporter
// -----------------------------------------------------------------------------
export class CustomersImporter implements Importer {
  template = 'customers' as const;

  detect(sheets: ParsedSheet[]): boolean {
    if (sheets.length === 0) return false;
    const s = sheets[0];
    const hasName = !!findHeader(s.headers, ['name', 'customer name', 'name_ar', 'name_en', 'الاسم']);
    const hasPhone = !!findHeader(s.headers, ['phone', 'phone primary', 'mobile', 'الهاتف']);
    return hasName && hasPhone;
  }

  async prepare(sheets: ParsedSheet[], ctx: ImporterContext): Promise<PreparedRow[]> {
    const sheet = sheets[0];
    if (!sheet) return [];

    const h = {
      name_ar: findHeader(sheet.headers, ['name ar', 'name_ar', 'الاسم', 'الاسم بالعربية', 'name']),
      name_en: findHeader(sheet.headers, ['name en', 'name_en', 'name english', 'name (en)']),
      type: findHeader(sheet.headers, ['type', 'customer type']),
      civil_id: findHeader(sheet.headers, ['civil id', 'civil_id', 'الرقم المدني']),
      email: findHeader(sheet.headers, ['email']),
      phone1: findHeader(sheet.headers, ['phone', 'phone primary', 'mobile', 'الهاتف']),
      phone2: findHeader(sheet.headers, ['phone secondary', 'phone 2', 'mobile 2', 'phone_2']),
      notes: findHeader(sheet.headers, ['notes', 'remarks', 'ملاحظات']),
    };

    if (!h.name_ar) {
      return [
        {
          row_number: 1,
          raw: rawWithSheet(sheet.sheet_name, { __error: 'Missing required column: name' }),
          resolved: null,
          errors: [{ field: 'name', message: 'Required column "name" not found' }],
          action: 'error',
          target_table: 'customers',
          apply: null,
        },
      ];
    }

    const customers = new CustomersRepository(ctx.db);
    const out: PreparedRow[] = [];

    for (const row of sheet.rows) {
      const errors: ValidationError[] = [];
      const cells = row.cells;
      const nameAr = asString(cells[h.name_ar!]);
      if (!nameAr) {
        out.push({
          row_number: row.row_number,
          raw: rawWithSheet(sheet.sheet_name, cells),
          resolved: null,
          errors: [{ field: 'name_ar', message: 'Name is required' }],
          action: 'error',
          target_table: 'customers',
          apply: null,
        });
        continue;
      }
      const nameEn = h.name_en ? asString(cells[h.name_en]) : null;
      const typeRaw = (h.type ? asString(cells[h.type])?.toLowerCase() : null) ?? 'individual';
      const customer_type = (['individual', 'company', 'government'].includes(typeRaw) ? typeRaw : 'individual') as
        | 'individual'
        | 'company'
        | 'government';
      const resolved = {
        name_ar: nameAr,
        name_en: nameEn,
        customer_type,
        civil_id: h.civil_id ? asString(cells[h.civil_id]) : null,
        email: h.email ? asString(cells[h.email]) : null,
        phone_primary: h.phone1 ? asString(cells[h.phone1]) : null,
        phone_secondary: h.phone2 ? asString(cells[h.phone2]) : null,
        notes: h.notes ? asString(cells[h.notes]) : null,
      };
      const apply = async (db: K3SupabaseClient) => {
        const repo = new CustomersRepository(db);
        const created = await repo.create(resolved as any);
        return { id: created.id };
      };
      out.push({
        row_number: row.row_number,
        raw: rawWithSheet(sheet.sheet_name, cells),
        resolved: resolved as unknown as Json,
        errors,
        action: 'insert',
        target_table: 'customers',
        apply,
      });
    }
    return out;
  }
}

// -----------------------------------------------------------------------------
// MachinesImporter — populates machines_master from a catalog sheet
// -----------------------------------------------------------------------------
export class MachinesImporter implements Importer {
  template = 'machines' as const;

  detect(sheets: ParsedSheet[]): boolean {
    if (sheets.length === 0) return false;
    const s = sheets[0];
    const hasCat = !!findHeader(s.headers, ['category', 'machine category', 'type']);
    const hasOutdoor = !!findHeader(s.headers, ['outdoor model', 'outdoor', 'outdoor unit']);
    // Distinguish from contract_pricing by ABSENCE of price columns
    const hasCo = !!findHeader(s.headers, ['co', 'co price']);
    return hasCat && hasOutdoor && !hasCo;
  }

  async prepare(sheets: ParsedSheet[], ctx: ImporterContext): Promise<PreparedRow[]> {
    const sheet = sheets[0];
    if (!sheet) return [];
    const h = {
      category: findHeader(sheet.headers, ['category', 'machine category', 'type']),
      brand: findHeader(sheet.headers, ['brand', 'manufacturer']),
      refrigerant: findHeader(sheet.headers, ['refrigerant', 'gas']),
      outdoor: findHeader(sheet.headers, ['outdoor model', 'outdoor']),
      indoor: findHeader(sheet.headers, ['indoor model', 'indoor']),
      hp: findHeader(sheet.headers, ['capacity hp', 'hp']),
      tr: findHeader(sheet.headers, ['capacity tr', 'tr']),
      btu: findHeader(sheet.headers, ['btu/h', 'btu']),
      cfm: findHeader(sheet.headers, ['cfm']),
      kw: findHeader(sheet.headers, ['kw']),
      country: findHeader(sheet.headers, ['country origin', 'country', 'origin']),
    };
    if (!h.category) {
      return [{
        row_number: 1,
        raw: rawWithSheet(sheet.sheet_name, { __error: 'Missing category column' }),
        resolved: null,
        errors: [{ field: 'category', message: 'Required column "category" not found' }],
        action: 'error', target_table: 'machines_master', apply: null,
      }];
    }
    const cats = new MachineCategoriesRepository(ctx.db);
    const brands = new MachineBrandsRepository(ctx.db);
    const refr = new RefrigerantTypesRepository(ctx.db);
    const machines = new MachinesMasterRepository(ctx.db);
    const allCats = await cats.list({ active_only: true });

    const out: PreparedRow[] = [];
    for (const row of sheet.rows) {
      const cells = row.cells;
      const errors: ValidationError[] = [];
      const catName = asString(cells[h.category!]);
      const brandName = h.brand ? asString(cells[h.brand]) : null;
      const refrName = h.refrigerant ? asString(cells[h.refrigerant]) : null;
      const outdoor = h.outdoor ? asString(cells[h.outdoor]) : null;
      const indoor = h.indoor ? asString(cells[h.indoor]) : null;
      const hp = h.hp ? asNumber(cells[h.hp]) : null;
      const tr = h.tr ? asNumber(cells[h.tr]) : null;
      const btu = h.btu ? asNumber(cells[h.btu]) : null;
      const cfm = h.cfm ? asNumber(cells[h.cfm]) : null;
      const kw = h.kw ? asNumber(cells[h.kw]) : null;
      const country = h.country ? asString(cells[h.country]) : null;

      let cat = catName ? allCats.find((c) =>
        c.code.toLowerCase() === catName.toLowerCase() ||
        c.name_en.toLowerCase() === catName.toLowerCase() ||
        c.name_ar === catName) : null;
      if (!cat) cat = allCats.find((c) => c.code === 'OTHER') ?? null;
      if (!cat) errors.push({ field: 'category', message: `Category "${catName}" not found` });

      let brandId: string | null = null;
      if (brandName) {
        let b = await brands.getByName(brandName);
        if (!b) b = await brands.create({ name: brandName });
        brandId = b.id;
      }
      let refrId: string | null = null;
      if (refrName) {
        const r = await refr.getByCode(refrName);
        if (r) refrId = r.id;
      }

      const resolved = {
        category_id: cat?.id,
        brand_id: brandId,
        refrigerant_id: refrId,
        outdoor_model: outdoor,
        indoor_model: indoor,
        capacity_hp: hp,
        capacity_tr: tr,
        btu_h: btu,
        cfm,
        kw,
        country_origin: country,
      };

      if (errors.length > 0 || !cat) {
        out.push({
          row_number: row.row_number, raw: rawWithSheet(sheet.sheet_name, cells),
          resolved: resolved as unknown as Json, errors,
          action: 'error', target_table: 'machines_master', apply: null,
        });
        continue;
      }

      const apply = async (db: K3SupabaseClient) => {
        const repo = new MachinesMasterRepository(db);
        const existing = await repo.findByBusinessKey({
          category_id: cat!.id, brand_id: brandId, refrigerant_id: refrId,
          outdoor_model: outdoor, indoor_model: indoor,
        });
        if (existing) {
          const upd = await repo.update(existing.id, {
            capacity_hp: hp, capacity_tr: tr, btu_h: btu ?? undefined,
            cfm: cfm ?? undefined, kw, country_origin: country,
          } as any);
          return { id: upd.id };
        }
        const created = await repo.create({
          category_id: cat!.id,
          brand_id: brandId,
          refrigerant_id: refrId,
          outdoor_model: outdoor,
          indoor_model: indoor,
          capacity_hp: hp,
          capacity_tr: tr,
          btu_h: btu,
          cfm,
          kw,
          country_origin: country,
        } as any);
        return { id: created.id };
      };

      const existing = await machines.findByBusinessKey({
        category_id: cat.id, brand_id: brandId, refrigerant_id: refrId,
        outdoor_model: outdoor, indoor_model: indoor,
      });
      out.push({
        row_number: row.row_number, raw: rawWithSheet(sheet.sheet_name, cells),
        resolved: resolved as unknown as Json, errors: [],
        action: existing ? 'update' : 'insert',
        target_table: 'machines_master', apply,
      });
    }
    return out;
  }
}

// -----------------------------------------------------------------------------
// PartsImporter — spare_parts_master
// -----------------------------------------------------------------------------
export class PartsImporter implements Importer {
  template = 'parts' as const;

  detect(sheets: ParsedSheet[]): boolean {
    if (sheets.length === 0) return false;
    const s = sheets[0];
    const hasPart = !!findHeader(s.headers, ['part name', 'part', 'name_en', 'الاسم']);
    const hasCat = !!findHeader(s.headers, ['part category', 'category']);
    const hasCost = !!findHeader(s.headers, ['cost price', 'cost']);
    return hasPart && hasCat && hasCost;
  }

  async prepare(sheets: ParsedSheet[], ctx: ImporterContext): Promise<PreparedRow[]> {
    const sheet = sheets[0];
    if (!sheet) return [];
    const h = {
      name_en: findHeader(sheet.headers, ['part name', 'part', 'name_en', 'name']),
      name_ar: findHeader(sheet.headers, ['name ar', 'name_ar', 'الاسم']),
      category: findHeader(sheet.headers, ['part category', 'category']),
      brand: findHeader(sheet.headers, ['brand', 'manufacturer']),
      model: findHeader(sheet.headers, ['model']),
      cost: findHeader(sheet.headers, ['cost price', 'cost']),
      selling: findHeader(sheet.headers, ['selling price', 'price']),
      country: findHeader(sheet.headers, ['country', 'origin']),
      unit: findHeader(sheet.headers, ['unit']),
    };
    const cats = new SparePartCategoriesRepository(ctx.db);
    const brands = new MachineBrandsRepository(ctx.db);
    const allCats = await cats.list({ active_only: true });

    const out: PreparedRow[] = [];
    for (const row of sheet.rows) {
      const cells = row.cells;
      const errors: ValidationError[] = [];
      const nameEn = h.name_en ? asString(cells[h.name_en]) : null;
      if (!nameEn) {
        out.push({
          row_number: row.row_number, raw: rawWithSheet(sheet.sheet_name, cells),
          resolved: null, errors: [{ field: 'name_en', message: 'Part name required' }],
          action: 'error', target_table: 'spare_parts_master', apply: null,
        });
        continue;
      }
      const catName = h.category ? asString(cells[h.category]) : null;
      let cat = catName ? allCats.find((c) =>
        c.code.toLowerCase() === catName.toLowerCase() ||
        c.name_en.toLowerCase() === catName.toLowerCase() ||
        c.name_ar === catName) : null;
      if (!cat) cat = allCats.find((c) => c.code === 'OTHER') ?? null;
      if (!cat) errors.push({ field: 'category', message: `Category "${catName}" not found` });

      const brandName = h.brand ? asString(cells[h.brand]) : null;
      let brandId: string | null = null;
      if (brandName) {
        let b = await brands.getByName(brandName);
        if (!b) b = await brands.create({ name: brandName });
        brandId = b.id;
      }
      const cost = h.cost ? asNumber(cells[h.cost]) ?? 0 : 0;
      const selling = h.selling ? asNumber(cells[h.selling]) ?? 0 : 0;
      const unitRaw = h.unit ? asString(cells[h.unit])?.toLowerCase() : null;
      const unit = (['piece', 'meter', 'kg', 'set', 'liter'].includes(unitRaw ?? '') ? unitRaw : 'piece') as any;

      const resolved = {
        category_id: cat?.id,
        name_en: nameEn,
        name_ar: h.name_ar ? asString(cells[h.name_ar]) ?? nameEn : nameEn,
        brand_id: brandId,
        model: h.model ? asString(cells[h.model]) : null,
        country_origin: h.country ? asString(cells[h.country]) : null,
        unit,
        cost_price: cost,
        selling_price: selling,
      };
      if (errors.length > 0 || !cat) {
        out.push({
          row_number: row.row_number, raw: rawWithSheet(sheet.sheet_name, cells),
          resolved: resolved as unknown as Json, errors,
          action: 'error', target_table: 'spare_parts_master', apply: null,
        });
        continue;
      }
      const apply = async (db: K3SupabaseClient) => {
        const repo = new SparePartsMasterRepository(db);
        const created = await repo.create(resolved as any);
        return { id: created.id };
      };
      out.push({
        row_number: row.row_number, raw: rawWithSheet(sheet.sheet_name, cells),
        resolved: resolved as unknown as Json, errors: [],
        action: 'insert', target_table: 'spare_parts_master', apply,
      });
    }
    return out;
  }
}

// -----------------------------------------------------------------------------
// GasImporter — gas_types_master pricing
// -----------------------------------------------------------------------------
export class GasImporter implements Importer {
  template = 'gas' as const;

  detect(sheets: ParsedSheet[]): boolean {
    if (sheets.length === 0) return false;
    const s = sheets[0];
    const hasRefr = !!findHeader(s.headers, ['refrigerant', 'gas', 'gas type']);
    const hasPrice = !!findHeader(s.headers, ['price per kg', 'selling price', 'kg price']);
    return hasRefr && hasPrice;
  }

  async prepare(sheets: ParsedSheet[], ctx: ImporterContext): Promise<PreparedRow[]> {
    const sheet = sheets[0];
    if (!sheet) return [];
    const h = {
      refr: findHeader(sheet.headers, ['refrigerant', 'gas', 'gas type']),
      cost: findHeader(sheet.headers, ['cost price per kg', 'cost per kg', 'cost']),
      selling: findHeader(sheet.headers, ['selling price per kg', 'price per kg', 'selling price', 'kg price']),
    };
    const refr = new RefrigerantTypesRepository(ctx.db);
    const gas = new GasTypesMasterRepository(ctx.db);

    const out: PreparedRow[] = [];
    for (const row of sheet.rows) {
      const cells = row.cells;
      const refrName = h.refr ? asString(cells[h.refr]) : null;
      if (!refrName) {
        out.push({
          row_number: row.row_number, raw: rawWithSheet(sheet.sheet_name, cells),
          resolved: null, errors: [{ field: 'refrigerant', message: 'Refrigerant required' }],
          action: 'error', target_table: 'gas_types_master', apply: null,
        });
        continue;
      }
      const r = await refr.getByCode(refrName);
      if (!r) {
        out.push({
          row_number: row.row_number, raw: rawWithSheet(sheet.sheet_name, cells),
          resolved: null,
          errors: [{ field: 'refrigerant', message: `Refrigerant "${refrName}" not in catalog` }],
          action: 'error', target_table: 'gas_types_master', apply: null,
        });
        continue;
      }
      const cost = h.cost ? asNumber(cells[h.cost]) ?? 0 : 0;
      const selling = h.selling ? asNumber(cells[h.selling]) ?? 0 : 0;
      const apply = async (db: K3SupabaseClient) => {
        const repo = new GasTypesMasterRepository(db);
        const existing = await repo.getByRefrigerantId(r.id);
        if (existing) {
          const upd = await repo.update(existing.id, {
            cost_price_per_kg: cost,
            selling_price_per_kg: selling,
          } as any);
          return { id: upd.id };
        }
        const created = await repo.create({
          refrigerant_id: r.id,
          cost_price_per_kg: cost,
          selling_price_per_kg: selling,
        } as any);
        return { id: created.id };
      };
      const existing = await gas.getByRefrigerantId(r.id);
      out.push({
        row_number: row.row_number, raw: rawWithSheet(sheet.sheet_name, cells),
        resolved: { refrigerant_id: r.id, cost_price_per_kg: cost, selling_price_per_kg: selling } as unknown as Json,
        errors: [],
        action: existing ? 'update' : 'insert',
        target_table: 'gas_types_master', apply,
      });
    }
    return out;
  }
}
