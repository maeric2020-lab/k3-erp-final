/**
 * @k3/repositories
 *
 * طبقة المستودعات — هي الطبقة الوحيدة في المشروع التي تلامس Supabase client مباشرةً.
 *
 * قاعدة معمارية: كل نوع/كلاس يُصدَّر من **ملف مصدر واحد فقط** ومن خلال هذا الـ index.
 * أي تكرار يكسر الـ build (TS2308: Module has already exported a member).
 */

// -----------------------------------------------------------------------------
// Phase 1 — هياكل أساسية
// -----------------------------------------------------------------------------
export { CompanySettingsRepository, type CompanySettings } from './company-settings.repository';
export { ScreensRepository, type Screen } from './screens.repository';
export { PermissionsRepository, type UserScreenPermission } from './permissions.repository';
export { UsersProfileRepository, type UserProfile } from './users-profile.repository';
export { BootstrapRepository } from './bootstrap.repository';

// -----------------------------------------------------------------------------
// Phase 2 — masters
// -----------------------------------------------------------------------------
export { CrudRepository, type ListOptions } from './_base';
export {
  CustomersRepository,
  CustomerSitesRepository,
  type Customer,
  type CustomerSite,
} from './customers.repository';
export {
  MachineCategoriesRepository,
  MachineBrandsRepository,
  RefrigerantTypesRepository,
  MachinesMasterRepository,
  type MachineCategory,
  type MachineBrand,
  type RefrigerantType,
  type MachineMaster,
} from './machines.repository';
export {
  ServiceCategoriesRepository,
  ServiceTypesRepository,
  SparePartCategoriesRepository,
  ServicesMasterRepository,
  type ServiceCategory,
  type ServiceType,
  type SparePartCategory,
  type ServiceMaster,
} from './services.repository';
export {
  SparePartsMasterRepository,
  GasTypesMasterRepository,
  type SparePartMaster,
  type GasTypeMaster,
} from './parts-gas.repository';
export {
  ServicePricingRepository,
  ContractPricingRepository,
  type ServicePricing,
  type ContractPricing,
} from './pricing.repository';

// -----------------------------------------------------------------------------
// Phase 2 — imports
// -----------------------------------------------------------------------------
export { ImportsRepository, type ImportRun, type ImportRunRow } from './imports.repository';

// -----------------------------------------------------------------------------
// Phase 3 — operations
// -----------------------------------------------------------------------------
export {
  CustomerMachinesRepository,
  ContractsRepository,
  ContractMachinesRepository,
  MaintenanceRequestsRepository,
  JobsRepository,
  DocumentLinesRepository,
  PricingRepository,
  type CustomerMachine,
  type Contract,
  type ContractMachine,
  type MaintenanceRequest,
  type Job,
  type DocumentLine,
  type JobStep,
  type ComputedPrice,
  type ComputePricingArgs,
} from './operations.repository';

// -----------------------------------------------------------------------------
// Phase 4 — sales/finance
// -----------------------------------------------------------------------------
export {
  QuotationsRepository,
  InvoicesRepository,
  PaymentsRepository,
  ContractClauseTemplatesRepository,
  ContractClausesRepository,
  CompressorBracketsRepository,
  type Quotation,
  type Invoice,
  type Payment,
  type ContractClauseTemplate,
  type ContractClause,
  type CompressorBracket,
} from './finance.repository';

// -----------------------------------------------------------------------------
// Phase 5 — admin (users, permissions, audit)
// ملاحظة: ScreensRepository و Screen يُصدَّران من screens.repository (Phase 1)
// و UserScreenPermission من permissions.repository (Phase 1) — لا تكرار هنا.
// -----------------------------------------------------------------------------
export {
  UserPermissionsAdminRepository,
  PermissionTemplatesRepository,
  PermissionTemplateItemsRepository,
  AuditLogRepository,
  type PermissionTemplate,
  type PermissionTemplateItem,
  type AuditLog,
  type PermissionGridRow,
  type AuditLogFilters,
} from './admin.repository';

// -----------------------------------------------------------------------------
// Phase 6a — dashboard
// -----------------------------------------------------------------------------
export {
  DashboardRepository,
  type DashboardTodayJobs,
  type DashboardOpenRequests,
  type DashboardOverdueInvoices,
  type DashboardRevenueMtd,
} from './dashboard.repository';

// -----------------------------------------------------------------------------
// Phase 6b — reports
// -----------------------------------------------------------------------------
export {
  ReportsRepository,
  type SalesReportRow,
  type PaymentAgingRow,
  type TechnicianPerfRow,
  type JobsByTechRow,
  type PartsConsumptionRow,
  type GasConsumptionRow,
  type CustomerBalanceRow,
  type ActiveContractRow,
} from './reports.repository';

// -----------------------------------------------------------------------------
// Phase 6c — chat
// -----------------------------------------------------------------------------
export {
  ChatThreadsRepository,
  ChatMessagesRepository,
  type ChatThread,
  type ChatThreadMember,
  type ChatMessage,
  type ChatAttachment,
  type ChatThreadSummary,
  type ChatMessageWithSender,
} from './chat.repository';

// -----------------------------------------------------------------------------
// Phase 8c — multi-tenancy + notifications
// -----------------------------------------------------------------------------
export {
  NotificationsRepository,
  type Notification,
  type NotificationPreferences,
} from './notifications.repository';
