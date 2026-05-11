# K3 ERP — Phase 4 Completion Notes

Phase 4 (Sales / Finance) is complete. This phase closes the financial loop: contract documents with bilingual letterhead, quotations, automatic invoices on job completion, payments, and the compressor-bracket pricing rules.

## What Phase 4 delivers

### Database (4 new migrations)

| File | Adds |
| --- | --- |
| `019_contract_clauses.sql` | `contract_clause_templates` (admin-edited library, bilingual title + body, `applies_to[]` for per-type filtering), `contract_clauses` (per-contract editable snapshot), seeded **7 default bilingual clauses** (preamble, coverage, exclusions, payment, liability, term, signatures) covering K. Three Co.'s standard contract language, RLS that gates editing on `contracts:edit` |
| `020_quotations_invoices_payments.sql` | `quotations` (auto `QUO-NNNNN`, status enum, subtotal/discount/total), `invoices` (auto `INV-NNNNN`, generated `balance` column, `is_zero_charge` flag, status enum), `payments` (auto `PAY-NNNNN`, method enum, FK to invoices), recalc triggers on `document_lines` for quotations/invoices/contracts, `fn_payments_recalc_invoice` keeping invoice status in sync, `fn_invoices_zero_charge_paid` auto-marking covered invoices as paid. **`fn_generate_invoice_for_job(p_job_id)`** — the SECURITY DEFINER RPC that clones a completed job's lines into a new invoice, sets `is_zero_charge` if every line is covered, and links `jobs.invoice_id` back. RLS for all three tables and updated `document_lines` policies to include invoices/quotations |
| `021_compressor_brackets.sql` | `compressor_install_brackets` table (HP min/max/base price/K3-supplied surcharge %), seeded with the 4 brackets per locked decision #9: ≤6 HP=70 KD, 6.5–10=80, 10.5–15=100, 15.5–20=125, +10% when K3 supplies. **`fn_compressor_bracket_price(hp, k3_supplied)`** RPC for the line picker to look up the right price |
| `022_seed_phase4_screens.sql` | Seeds `quotations` (sales), `invoices`/`payments` (finance), `contract_clause_templates`/`compressor_brackets` (admin) screens |

### TypeScript layer

- `@k3/shared-types` — added `QuotationStatus`, `InvoiceStatus`, `PaymentMethod` aliases plus row types for clause templates, clauses, quotations, invoices, payments, compressor brackets. Function signatures for `fn_generate_invoice_for_job` and `fn_compressor_bracket_price`.
- `@k3/validators` — `quotationSchema`, `invoiceSchema`, `paymentSchema` (`amount > 0`), `contractClauseTemplateSchema`, `contractClauseSchema`, `compressorBracketSchema` (with `hp_max ≥ hp_min` cross-field guard).
- `@k3/repositories` — `QuotationsRepository` (with `listForCustomer`, `getByQuotationNo`), `InvoicesRepository` (with `listOutstanding`, `listByStatus`, `getByJobId`), `PaymentsRepository` (with `listForInvoice`, `listForCustomer`), `ContractClauseTemplatesRepository`, `ContractClausesRepository`, `CompressorBracketsRepository` with **`lookupPrice(hp, k3Supplied)`** wrapping the RPC.
- `@k3/services`:
  - `InvoicingService.generateForJob(jobId)` — wraps the RPC, idempotent.
  - `ContractDocumentService.materialiseClauses(contractId)` — pulls in default clauses for any missing codes, filtered by contract type.
  - `ContractDocumentService.assemble(contractId)` — returns `{ contract, customer, site, clauses, machines, total_amount }` for the renderer.
  - `JobsService.applyStep` — extended: when a step transitions a job to `completed`, the service auto-imports `InvoicingService`, generates the invoice, and advances `completed → invoiced` directly via a status update. Failures are logged but don't break the technician's workflow; the office can re-run.

### API (Phase 4)

- `/api/quotations` (GET/POST) + `[id]` (GET/PATCH/DELETE) + `[id]/lines` (GET/POST → uses `PricingRepository.compute`) + `[id]/lines/[lineId]` (PATCH/DELETE)
- `/api/invoices` (GET with `status=outstanding` filter, POST for accounting-only stand-alones) + `[id]` (GET returns invoice + lines + payments, PATCH) + `[id]/payments` (GET/POST with overpayment rejection: `الدفعة تتجاوز رصيد الفاتورة`)
- `/api/payments` (GET across all) + `[id]` (GET/DELETE)
- `/api/contracts/[id]/clauses` (GET with `?materialise=true` for default-clause generation, POST) + `[id]/clauses/[clauseId]` (PATCH/DELETE)
- `/api/contracts/[id]/document` (GET — assembled document data for the renderer)
- `/api/admin/compressor-brackets` (GET/POST) + `[id]` (PATCH/DELETE, hard delete)
- `/api/admin/contract-clause-templates` (GET/POST) + `[id]` (PATCH/DELETE)

### UI (Phase 4)

**Sales** — `/sales/quotations` list with status pills + `/sales/quotations/new` form + `/sales/quotations/[id]` detail with line picker, status transition buttons (draft → sent → accepted/rejected), custom line entry. Status updates are gated on `quotations:edit`.

**Finance** — `/finance/invoices` list with **All / Outstanding** toggle, status + zero-charge badges. `/finance/invoices/[id]` detail shows lines, payments timeline, **Record payment dialog** (POST to `/api/invoices/[id]/payments`, server rejects overpayment), **Void invoice** action. Linked back to the originating job via `Briefcase` icon. `/finance/payments` global payments list with filter by reference/customer/invoice. The job admin page now shows a **"View invoice INV-XXXXX"** link when `job.invoice_id` is set, with a green "covered" badge for zero-charge invoices.

**Contracts** — Existing `/contracts/[id]` detail page now has a **"Print contract"** button in the header. `/contracts/[id]/print` is a dedicated server-rendered page that materialises default clauses on first open, then renders the bilingual A4 contract document with K3 letterhead (logo from `company_settings.logo_path`), parties, covered units table (NO per-machine prices per locked decision — only the aggregate total), and every clause rendered Arabic-primary with English mirror. The client uses a print stylesheet that hides app chrome and sizes to A4 with 14mm margins. The user prints to PDF via the browser.

**Admin** — `/admin/compressor-brackets` SimpleMasterClient for HP min/max + base price + K3 surcharge %. `/admin/contract-clause-templates` custom client with bilingual title/body textareas, multi-select `applies_to` (CO/CW/CWC), and a list view showing the AR body preview.

**Sidebar wiring** — Phase 4 routes added to `SCREEN_HREFS`: quotations, invoices, payments, contract_clause_templates, compressor_brackets.

### i18n

Full `finance` section added to `ar.json` and `en.json` covering quotations (statuses + actions), invoices (statuses + zeroCharge + outstanding + recordPayment + void), payments (methods enum), compressorBrackets, contractClauseTemplates, and contractDocument. Plus `common.details` to support the job admin page.

## Architectural invariants (preserved)

- **No app-side pricing.** Quotation lines and the line picker still flow through `compute_line_pricing` via `PricingRepository`. Compressor bracket lookups are a separate RPC, called only from the line picker and surfaced as a custom-line override (admin gating in Phase 5).
- **Auto-invoice on completion** is a single SECURITY DEFINER RPC. The client never writes invoices directly for jobs — the trigger does. Idempotent.
- **Per-machine prices are hidden** from the printed contract per the locked decision. The data is in `contract_machines.unit_price_at_signing` (used for office-side editing), but the printed PDF only shows the total.
- **Zero-charge handling** is fully automatic: covered jobs produce 0 KWD invoices that the trigger marks `paid` immediately. They appear in `/finance/invoices` with a green "covered" badge.
- **Overpayment rejection** is a server-side check in the payments API, not a client-side limitation.

## Production deploy

1. Apply migrations 019-022:
   ```bash
   supabase db push
   ```
2. Verify:
   ```sql
   SELECT proname FROM pg_proc WHERE proname IN ('fn_generate_invoice_for_job','fn_compressor_bracket_price');
   SELECT count(*) FROM public.contract_clause_templates;     -- expect 7
   SELECT count(*) FROM public.compressor_install_brackets;   -- expect 4
   ```
3. Grant the appropriate roles:
   - Sales: `quotations:view`/`add`/`edit`
   - Finance: `invoices:view`/`edit`, `payments:view`/`add`
   - Admin: `compressor_brackets:*`, `contract_clause_templates:*`

## What's next — Phase 5 (Permissions UI)

- Users CRUD (admin-side) with permission grid (screen × action checkboxes).
- Role templates: `template_items` bulk-grant to users.
- Audit log viewer (already populated from Phase 1) with filters by user/entity/action.
- Custom-line admin override gating: only admins with explicit `quotations:override_price` (or similar) can set unit_price > 0 on custom lines.
- Super-admin escape hatch.
