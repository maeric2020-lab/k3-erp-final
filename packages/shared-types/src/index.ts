export type { Database, Json, Tables, TablesInsert, TablesUpdate } from './database.types';

// -----------------------------------------------------------------------------
// Domain-level enums (mirror DB CHECK constraints; one source of truth here)
// -----------------------------------------------------------------------------

export const SCREEN_ACTIONS = [
  'view',
  'add',
  'edit',
  'delete',
  'print',
  'export',
  'approve',
  'assign',
  'import',
] as const;
export type ScreenAction = (typeof SCREEN_ACTIONS)[number];

export const CONTRACT_TYPES = ['co', 'cw', 'cwc', 'ug'] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const REQUEST_TYPES = ['cash', 'co', 'cw', 'cwc', 'ug'] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const JOB_STATUSES = [
  'assigned',
  'accepted',
  'on_way',
  'arrived',
  'inspection_started',
  'work_started',
  'report_pending',
  'completed',
  'invoiced',
  'closed',
  'cancelled',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const LINE_TYPES = ['service', 'spare_part', 'gas', 'fee'] as const;
export type LineType = (typeof LINE_TYPES)[number];

export const PROBLEM_CODES = [
  'no_cooling',
  'weak_cooling',
  'water_leak',
  'gas_leak',
  'compressor_issue',
  'fan_motor_issue',
  'electrical_issue',
  'sensor_issue',
  'thermostat_issue',
  'noise',
  'bad_smell',
  'drainage_issue',
  'other',
] as const;
export type ProblemCode = (typeof PROBLEM_CODES)[number];

export const COVERAGE_REASONS = [
  'cw_contract',
  'cwc_contract',
  'cwg_contract',
  'cwcg_contract',
  'co_contract',
  'cog_contract',
  'ug_warranty',
  'manual_admin',
] as const;
export type CoverageReason = (typeof COVERAGE_REASONS)[number];
