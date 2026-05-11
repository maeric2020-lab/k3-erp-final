import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@k3/shared-types';
import {
  ContractsRepository,
  ContractMachinesRepository,
  ContractClausesRepository,
  ContractClauseTemplatesRepository,
  CustomersRepository,
  CustomerSitesRepository,
  CustomerMachinesRepository,
  MachineCategoriesRepository,
  MachineBrandsRepository,
  RefrigerantTypesRepository,
  type Contract,
  type ContractClause,
  type ContractMachine,
  type Customer,
  type CustomerSite,
} from '@k3/repositories';

export interface ContractDocumentMachine {
  id: string;
  category_ar: string;
  category_en: string;
  brand: string | null;
  refrigerant: string | null;
  outdoor_model: string | null;
  indoor_model: string | null;
  capacity_hp: number | null;
  serial_number: string | null;
  unit_price_at_signing: number;
}

export interface ContractDocument {
  contract: Contract;
  customer: Customer | null;
  site: CustomerSite | null;
  clauses: ContractClause[];
  machines: ContractDocumentMachine[];
  total_amount: number;
}

/**
 * ContractDocumentService — assembles the data needed to render a contract
 * document (print page or PDF). Also handles materialising clauses from
 * templates when a draft contract is first opened.
 *
 * Per-machine prices are NOT printed in the customer-facing PDF (decision: the
 * customer sees the totals, not the breakdown). The renderer should respect
 * this. Only contract.total_amount and aggregate machine count are shown.
 */
export class ContractDocumentService {
  private readonly contracts: ContractsRepository;
  private readonly cm: ContractMachinesRepository;
  private readonly clauses: ContractClausesRepository;
  private readonly templates: ContractClauseTemplatesRepository;
  private readonly customers: CustomersRepository;
  private readonly sites: CustomerSitesRepository;
  private readonly machines: CustomerMachinesRepository;
  private readonly cats: MachineCategoriesRepository;
  private readonly brands: MachineBrandsRepository;
  private readonly refrs: RefrigerantTypesRepository;

  constructor(private readonly db: SupabaseClient<Database>) {
    this.contracts = new ContractsRepository(db);
    this.cm = new ContractMachinesRepository(db);
    this.clauses = new ContractClausesRepository(db);
    this.templates = new ContractClauseTemplatesRepository(db);
    this.customers = new CustomersRepository(db);
    this.sites = new CustomerSitesRepository(db);
    this.machines = new CustomerMachinesRepository(db);
    this.cats = new MachineCategoriesRepository(db);
    this.brands = new MachineBrandsRepository(db);
    this.refrs = new RefrigerantTypesRepository(db);
  }

  /**
   * Materialise default clauses for a contract that has no clauses yet.
   * Idempotent: only inserts clauses for codes that don't already exist on
   * the contract.
   */
  async materialiseClauses(contractId: string): Promise<ContractClause[]> {
    const contract = await this.contracts.getById(contractId);
    if (!contract) throw new Error('Contract not found');

    const existing = await this.clauses.listForContract(contractId);
    const existingCodes = new Set(existing.map((c) => c.code));

    const templates = await this.templates.listOrdered();
    const toCreate = templates
      .filter((tpl) => !existingCodes.has(tpl.code))
      .filter((tpl) => tpl.applies_to.length === 0 || tpl.applies_to.includes(contract.contract_type));

    const inserted: ContractClause[] = [];
    for (const tpl of toCreate) {
      const created = await this.clauses.create({
        contract_id: contractId,
        template_id: tpl.id,
        code: tpl.code,
        display_order: tpl.display_order,
        title_ar: tpl.title_ar,
        title_en: tpl.title_en,
        body_ar: tpl.body_ar,
        body_en: tpl.body_en,
      } as any);
      inserted.push(created);
    }

    return [...existing, ...inserted].sort((a, b) => a.display_order - b.display_order);
  }

  async assemble(contractId: string): Promise<ContractDocument> {
    const contract = await this.contracts.getById(contractId);
    if (!contract) throw new Error('Contract not found');

    const [customer, site, clauses, links, allCats, allBrands, allRefrs] = await Promise.all([
      this.customers.getById(contract.customer_id),
      contract.site_id ? this.sites.getById(contract.site_id) : Promise.resolve(null),
      this.clauses.listForContract(contractId),
      this.cm.listForContract(contractId),
      this.cats.list({ active_only: true, limit: 200 }),
      this.brands.list({ active_only: true, limit: 500 }),
      this.refrs.list({ active_only: true, limit: 100 }),
    ]);

    const catById = new Map(allCats.map((c) => [c.id, c]));
    const brandById = new Map(allBrands.map((b) => [b.id, b]));
    const refrById = new Map(allRefrs.map((r) => [r.id, r]));

    const customerMachineIds = links.map((l) => l.customer_machine_id);
    const customerMachines = await Promise.all(
      customerMachineIds.map((id) => this.machines.getById(id).catch(() => null))
    );
    const machineById = new Map(
      customerMachines
        .filter((m): m is NonNullable<typeof m> => !!m)
        .map((m) => [m.id, m])
    );

    const machines: ContractDocumentMachine[] = links.map((link) => {
      const m = machineById.get(link.customer_machine_id);
      const cat = m ? catById.get(m.category_id) : null;
      const brand = m?.brand_id ? brandById.get(m.brand_id) : null;
      const refr = m?.refrigerant_id ? refrById.get(m.refrigerant_id) : null;
      return {
        id: link.id,
        category_ar: cat?.name_ar ?? '—',
        category_en: cat?.name_en ?? '—',
        brand: brand?.name ?? null,
        refrigerant: refr?.name ?? null,
        outdoor_model: m?.outdoor_model ?? null,
        indoor_model: m?.indoor_model ?? null,
        capacity_hp: m?.capacity_hp ?? null,
        serial_number: m?.serial_number ?? null,
        unit_price_at_signing: Number(link.unit_price_at_signing),
      };
    });

    return {
      contract,
      customer,
      site,
      clauses,
      machines,
      total_amount: Number(contract.total_amount),
    };
  }
}
