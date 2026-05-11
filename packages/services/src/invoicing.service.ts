import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@k3/shared-types';
import { InvoicesRepository, type Invoice } from '@k3/repositories';

/**
 * InvoicingService — wraps the `fn_generate_invoice_for_job` RPC.
 *
 * Decision #3: every completed job auto-generates an invoice. Zero-charge
 * invoices are created for fully-covered work (UG, or all lines is_covered).
 *
 * Workflow:
 *   1. The technician submits signatures → JobsService advances job to 'completed'
 *   2. JobsService calls InvoicingService.generateForJob(jobId)
 *   3. The RPC clones the job's document_lines into a new invoice and links
 *      jobs.invoice_id back. The trigger trg_invoices_zero_charge auto-marks
 *      zero-charge invoices as 'paid'.
 *   4. JobsService advances the job to 'invoiced'.
 */
export class InvoicingService {
  private readonly invoices: InvoicesRepository;

  constructor(private readonly db: SupabaseClient<Database>) {
    this.invoices = new InvoicesRepository(db);
  }

  /**
   * Generate (or fetch existing) invoice for a completed job.
   * Idempotent — calling twice returns the same invoice.
   */
  async generateForJob(jobId: string): Promise<Invoice> {
    const { data: invoiceId, error } = await this.db.rpc('fn_generate_invoice_for_job' as any, {
      p_job_id: jobId,
    });
    if (error) throw error;
    if (!invoiceId) throw new Error('Invoice generation returned no id');
    const inv = await this.invoices.getById(invoiceId as string);
    if (!inv) throw new Error('Generated invoice not retrievable');
    return inv;
  }

  async voidInvoice(invoiceId: string, reason?: string): Promise<Invoice> {
    const updated = await this.invoices.update(invoiceId, {
      status: 'void' as any,
      notes: reason ? `[VOIDED] ${reason}` : '[VOIDED]',
    } as any);
    return updated;
  }
}
