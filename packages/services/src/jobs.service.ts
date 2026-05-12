import type { K3SupabaseClient, Database, JobStatus, RequestType, LineType } from '@k3/shared-types';
import {
  JobsRepository,
  DocumentLinesRepository,
  MaintenanceRequestsRepository,
  PricingRepository,
  type Job,
  type DocumentLine,
  type JobStep,
  type ComputePricingArgs,
} from '@k3/repositories';

/**
 * JobsService — single entry point for everything jobs-related.
 *
 * The technician UI never updates jobs.status directly; it always calls
 * `applyStep(jobId, step, payload)`, which:
 *   1. Validates required payload for the step (e.g., signature required for
 *      submit_signatures).
 *   2. Calls JobsRepository.advanceStep(), which triggers the DB-level status
 *      machine.
 *   3. Updates parent maintenance_request status if the job reaches a terminal
 *      stage.
 *
 * Pricing for any line added to a job goes through PricingRepository.compute,
 * which calls the compute_line_pricing PG function — never a hand-rolled
 * lookup in the app code.
 */
export class JobsService {
  private readonly jobs: JobsRepository;
  private readonly lines: DocumentLinesRepository;
  private readonly requests: MaintenanceRequestsRepository;
  private readonly pricing: PricingRepository;

  constructor(private readonly db: K3SupabaseClient) {
    this.jobs = new JobsRepository(db);
    this.lines = new DocumentLinesRepository(db);
    this.requests = new MaintenanceRequestsRepository(db);
    this.pricing = new PricingRepository(db);
  }

  // ---------------------------------------------------------------------------
  // Job creation
  // ---------------------------------------------------------------------------
  async createFromRequest(args: {
    request_id: string;
    technician_id?: string | null;
    created_by?: string | null;
  }): Promise<Job> {
    const req = await this.requests.getById(args.request_id);
    if (!req) throw new Error('Maintenance request not found');

    const job = await this.jobs.create({
      request_id: req.id,
      customer_id: req.customer_id,
      site_id: req.site_id,
      customer_machine_id: req.customer_machine_id,
      contract_id: req.contract_id,
      request_type: req.request_type,
      technician_id: args.technician_id ?? null,
      status: 'assigned',
      created_by: args.created_by ?? null,
    } as any);

    // Move the parent request to in_progress
    await this.requests.update(req.id, { status: 'in_progress' } as any);
    return job;
  }

  // ---------------------------------------------------------------------------
  // Step transitions
  // ---------------------------------------------------------------------------
  async applyStep(args: {
    job_id: string;
    step: JobStep;
    payload?: {
      arrived_lat?: number | null;
      arrived_lng?: number | null;
      inspection_notes?: string | null;
      technician_notes?: string | null;
      customer_signature_name?: string | null;
      customer_signature_path?: string | null;
      technician_signature_path?: string | null;
    };
  }): Promise<Job> {
    const job = await this.jobs.getById(args.job_id);
    if (!job) throw new Error('Job not found');

    // Step-specific validation
    if (args.step === 'arrived') {
      if (args.payload?.arrived_lat == null || args.payload?.arrived_lng == null) {
        throw new Error('GPS coordinates required for arrival');
      }
    }
    if (args.step === 'submit_signatures') {
      if (!args.payload?.technician_signature_path) {
        throw new Error('Technician signature is required to complete the job');
      }
    }
    if (args.step === 'mark_complete') {
      // Must have at least one line before completing (guard against empty work)
      const lines = await this.lines.listForJob(args.job_id);
      if (lines.length === 0) {
        throw new Error('At least one work line is required before marking complete');
      }
    }

    // Build the patch
    const extras: Partial<Job> = {};
    if (args.payload) {
      const p = args.payload;
      if (p.arrived_lat != null) extras.arrived_lat = p.arrived_lat;
      if (p.arrived_lng != null) extras.arrived_lng = p.arrived_lng;
      if (p.inspection_notes != null) extras.inspection_notes = p.inspection_notes;
      if (p.technician_notes != null) extras.technician_notes = p.technician_notes;
      if (p.technician_signature_path) extras.technician_signature_path = p.technician_signature_path;
      if (p.customer_signature_path) extras.customer_signature_path = p.customer_signature_path;
      if (p.customer_signature_name) extras.customer_signature_name = p.customer_signature_name;
    }

    const updated = await this.jobs.advanceStep(args.job_id, args.step, extras);

    // If we just completed (submit_signatures → completed), auto-generate
    // the invoice and advance the job to 'invoiced'. Zero-charge invoices
    // are created for fully-covered work; the trg_invoices_zero_charge
    // trigger marks them as 'paid' automatically.
    if (updated.status === 'completed') {
      try {
        const { InvoicingService } = await import('./invoicing.service');
        const invoicing = new InvoicingService(this.db);
        await invoicing.generateForJob(updated.id);
        // Advance: completed → invoiced. The fn_jobs_status_transition
        // trigger explicitly allows this transition, so a direct update is
        // the cleanest path here (no step maps to it).
        const invoiced = await this.jobs.update(updated.id, { status: 'invoiced' } as any);
        return invoiced as Job;
      } catch (e) {
        // Don't fail the whole step if invoice generation hiccups; the office
        // can re-run via the API. The job stays at 'completed'.
        console.error('Auto-invoicing failed:', e);
      }
    }

    // If we just cancelled, close the parent request as well.
    if (updated.status === 'cancelled') {
      const otherJobs = await this.jobs.listForRequest(updated.request_id);
      const allDone = otherJobs.every((j) => j.status === 'cancelled' || j.status === 'closed');
      if (allDone) {
        await this.requests.update(updated.request_id, { status: 'cancelled' } as any);
      }
    }

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Line items — pricing flows through compute_line_pricing only
  // ---------------------------------------------------------------------------
  async addLine(args: {
    job_id: string;
    line_type: LineType;
    service_id?: string | null;
    part_id?: string | null;
    gas_id?: string | null;
    customer_machine_id?: string | null;
    machine_master_id?: string | null;
    quantity?: number;
    description_ar?: string;
    description_en?: string | null;
    notes?: string | null;
    display_order?: number;
    /**
     * Admin-only override for custom lines: when line_type='custom', the caller
     * may pass an explicit unit_price; for any other type this argument is
     * ignored — pricing is whatever compute_line_pricing returns.
     */
    custom_unit_price?: number | null;
  }): Promise<DocumentLine> {
    const job = await this.jobs.getById(args.job_id);
    if (!job) throw new Error('Job not found');

    // Resolve machine context: prefer the explicitly-passed machine, fall back
    // to the job's own customer_machine
    const customerMachineId = args.customer_machine_id ?? job.customer_machine_id;

    // Compute pricing via the DB function (single source of truth)
    const pricingArgs: ComputePricingArgs = {
      line_type: args.line_type,
      service_id: args.service_id ?? null,
      part_id: args.part_id ?? null,
      gas_id: args.gas_id ?? null,
      customer_machine_id: customerMachineId ?? null,
      machine_master_id: args.machine_master_id ?? null,
      request_type: job.request_type,
      quantity: args.quantity ?? 1,
    };
    const priced = await this.pricing.compute(pricingArgs);

    let unit_price = priced.unit_price;
    let pricing_source = priced.pricing_source;
    // تجاوز السعر يدوياً عند تمرير custom_unit_price (لأي نوع سطر)
    if (args.custom_unit_price != null) {
      if (args.custom_unit_price < 0) {
        throw new Error('custom_unit_price must be non-negative');
      }
      unit_price = args.custom_unit_price;
      pricing_source = 'custom:override';
    }

    const line = await this.lines.create({
      job_id: args.job_id,
      line_type: args.line_type,
      service_id: args.service_id ?? null,
      part_id: args.part_id ?? null,
      gas_id: args.gas_id ?? null,
      customer_machine_id: customerMachineId ?? null,
      machine_master_id: args.machine_master_id ?? null,
      description_ar: args.description_ar ?? priced.description_ar,
      description_en: args.description_en ?? priced.description_en,
      unit: priced.unit,
      quantity: args.quantity ?? 1,
      request_type: job.request_type,
      unit_price,
      cost_price: priced.cost_price,
      is_covered: priced.is_covered,
      pricing_source,
      pricing_computed_at: new Date().toISOString(),
      notes: args.notes ?? null,
      display_order: args.display_order ?? 0,
    } as any);

    return line;
  }

  async removeLine(lineId: string): Promise<void> {
    await this.lines.hardDelete(lineId);
  }

  async listLines(jobId: string): Promise<DocumentLine[]> {
    return this.lines.listForJob(jobId);
  }
}
