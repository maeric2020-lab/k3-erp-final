// Phase 1
export { PermissionsService } from './permissions.service';
export { SetupService, SetupAlreadyCompleteError } from './setup.service';

// Phase 2 — Excel and import infrastructure
export {
  readWorkbookFromBuffer,
  parseSheet,
  parseAllSheets,
  workbookToArrayBuffer,
  asString,
  asNumber,
  asBoolean,
  isCoveredSentinel,
  findHeader,
  normalizeHeader,
  type ParsedSheet,
  type ParsedRow,
  type CellValue,
} from './excel';

export {
  ImportService,
  rawWithSheet,
  type Importer,
  type ImporterContext,
  type ImportTemplate,
  type PreparedRow,
  type RowAction,
  type ValidationError,
} from './import.service';

export {
  ServicePricingImporter,
  ContractPricingImporter,
  CustomersImporter,
  MachinesImporter,
  PartsImporter,
  GasImporter,
} from './importers';

export { generateTemplate, listTemplates } from './template-generator';

// Phase 3 — operations services
export { JobsService } from './jobs.service';
export {
  LinePickerService,
  type PricedServiceOption,
  type PricedPartOption,
  type PricedGasOption,
} from './line-picker.service';

// Phase 4 — sales/finance services
export { InvoicingService } from './invoicing.service';
export {
  ContractDocumentService,
  type ContractDocument,
  type ContractDocumentMachine,
} from './contract-document.service';

// Phase 5 — admin services
export { UserInvitationService } from './user-invitation.service';

// Helper: build an ImportService with all importers registered
import { ImportService } from './import.service';
import {
  ServicePricingImporter,
  ContractPricingImporter,
  CustomersImporter,
  MachinesImporter,
  PartsImporter,
  GasImporter,
} from './importers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@k3/shared-types';

export function createImportService(db: SupabaseClient<Database>): ImportService {
  const svc = new ImportService(db);
  svc.registerMany([
    new ServicePricingImporter(),
    new ContractPricingImporter(),
    new CustomersImporter(),
    new MachinesImporter(),
    new PartsImporter(),
    new GasImporter(),
  ]);
  return svc;
}

/**
 * Resolve an Importer instance from a stored run's template_type.
 * Used during commit, when the route handler has only the run id.
 */
export function getImporterForTemplate(template: string) {
  switch (template) {
    case 'service_pricing': return new ServicePricingImporter();
    case 'contract_pricing': return new ContractPricingImporter();
    case 'customers': return new CustomersImporter();
    case 'machines': return new MachinesImporter();
    case 'parts': return new PartsImporter();
    case 'gas': return new GasImporter();
    default: throw new Error(`Unknown import template: ${template}`);
  }
}
