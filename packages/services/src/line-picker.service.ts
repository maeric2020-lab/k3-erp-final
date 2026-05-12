import type { K3SupabaseClient, Database, RequestType } from '@k3/shared-types';
import {
  ServicesMasterRepository,
  SparePartsMasterRepository,
  GasTypesMasterRepository,
  CustomerMachinesRepository,
  PricingRepository,
  type ComputedPrice,
} from '@k3/repositories';

/**
 * LinePickerService — generates the catalog of services/parts/gas the
 * technician can pick on a job, each priced via compute_line_pricing.
 *
 * The technician's mobile UI calls listForJob() once per category tab. The
 * result includes the live priced unit_price and an is_covered flag so the
 * UI can clearly distinguish "free under your CWC contract" from "billable".
 */
export interface PricedServiceOption {
  service_id: string;
  name_ar: string;
  name_en: string;
  unit: string;
  capacity_hp: number | null;
  service_type_id: string;
  unit_price: number;
  cost_price: number;
  is_covered: boolean;
  pricing_source: string;
}

export interface PricedPartOption {
  part_id: string;
  part_code: string;
  name_ar: string;
  name_en: string;
  unit: string;
  unit_price: number;
  cost_price: number;
  is_covered: boolean;
}

export interface PricedGasOption {
  gas_id: string;
  refrigerant_name: string;
  unit_price: number;
  cost_price: number;
}

export class LinePickerService {
  private readonly services: ServicesMasterRepository;
  private readonly parts: SparePartsMasterRepository;
  private readonly gases: GasTypesMasterRepository;
  private readonly machines: CustomerMachinesRepository;
  private readonly pricing: PricingRepository;

  constructor(private readonly db: K3SupabaseClient) {
    this.services = new ServicesMasterRepository(db);
    this.parts = new SparePartsMasterRepository(db);
    this.gases = new GasTypesMasterRepository(db);
    this.machines = new CustomerMachinesRepository(db);
    this.pricing = new PricingRepository(db);
  }

  /**
   * Services available for a given job context, each priced.
   * Used for the "Add service" tab.
   */
  async listServicesForJob(args: {
    customer_machine_id: string | null;
    request_type: RequestType;
    search?: string;
    limit?: number;
  }): Promise<PricedServiceOption[]> {
    // Pull the services catalog (the master is small enough to fetch fully;
    // for K3 we expect ~400 entries)
    const services = await this.services.list({ search: args.search, limit: args.limit ?? 200, active_only: true });

    const out: PricedServiceOption[] = [];
    for (const s of services) {
      const priced = await this.pricing.compute({
        line_type: 'service',
        service_id: s.id,
        customer_machine_id: args.customer_machine_id,
        request_type: args.request_type,
      });
      out.push({
        service_id: s.id,
        name_ar: s.name_ar,
        name_en: s.name_en,
        unit: s.unit,
        capacity_hp: s.capacity_hp,
        service_type_id: s.service_type_id,
        unit_price: priced.unit_price,
        cost_price: priced.cost_price,
        is_covered: priced.is_covered,
        pricing_source: priced.pricing_source,
      });
    }
    return out;
  }

  async listPartsForJob(args: {
    customer_machine_id: string | null;
    search?: string;
    limit?: number;
  }): Promise<PricedPartOption[]> {
    const parts = await this.parts.list({ search: args.search, limit: args.limit ?? 200, active_only: true });

    // Filter parts by compatibility with the machine's category
    let filtered = parts;
    if (args.customer_machine_id) {
      const machine = await this.machines.getById(args.customer_machine_id);
      if (machine) {
        filtered = parts.filter(
          (p) =>
            !p.compatible_categories ||
            p.compatible_categories.length === 0 ||
            p.compatible_categories.includes(machine.category_id)
        );
      }
    }

    const out: PricedPartOption[] = [];
    for (const p of filtered) {
      const priced = await this.pricing.compute({
        line_type: 'spare_part',
        part_id: p.id,
        customer_machine_id: args.customer_machine_id,
        request_type: 'CASH', // request_type doesn't matter for parts
      });
      out.push({
        part_id: p.id,
        part_code: p.part_code,
        name_ar: p.name_ar,
        name_en: p.name_en,
        unit: p.unit,
        unit_price: priced.unit_price,
        cost_price: priced.cost_price,
        is_covered: priced.is_covered,
      });
    }
    return out;
  }

  async listGasOptions(): Promise<PricedGasOption[]> {
    const gases = await this.gases.list({ active_only: true });
    const out: PricedGasOption[] = [];
    for (const g of gases) {
      const priced = await this.pricing.compute({
        line_type: 'gas',
        gas_id: g.id,
        request_type: 'CASH',
      });
      // refrigerant_name comes from the description in compute_line_pricing
      const name = priced.description_en || priced.description_ar || '';
      out.push({
        gas_id: g.id,
        refrigerant_name: name.replace(/^Gas - /, ''),
        unit_price: priced.unit_price,
        cost_price: priced.cost_price,
      });
    }
    return out;
  }
}
