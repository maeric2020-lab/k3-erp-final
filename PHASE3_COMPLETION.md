# K3 ERP — Phase 3 Completion Notes

Phase 3 (Operations) is production-ready. This phase introduces the heart of the system: maintenance requests, jobs, the technician workflow, and the central pricing engine.

## What Phase 3 delivers

### Database (4 new migrations)

| File | Adds |
| --- | --- |
| `015_customer_machines_contracts.sql` | `customer_machines` (machine instances at customer sites with snapshot fields), `contracts` (minimal — full Phase 4), `contract_machines` junction with `unit_price_at_signing` snapshot, RLS |
| `016_requests_and_jobs.sql` | `maintenance_requests` (auto `REQ-NNNNN`, problem-code enum, "other" gated by company setting), `jobs` (auto `JOB-NNNNN`, full status machine, GPS + signature columns), **`fn_jobs_status_transition` trigger** that polices every status change and stamps `*_at` timestamps, RLS that lets technicians read/edit their own jobs |
| `017_document_lines_and_pricing.sql` | **`document_lines`** polymorphic (job/quotation/invoice/contract), **`compute_line_pricing()`** PG function — the SOLE source of pricing truth, `fn_jobs_recalc_total` to keep `jobs.total_amount` synced, REQ/JOB numbering sequences |
| `018_seed_phase3_screens.sql` | Seeds `maintenance_requests`, `jobs`, `jobs_my`, `jobs_dispatch`, `customer_machines`, `contracts` screens |

### TypeScript layer

- `@k3/shared-types` — extended with all Phase 3 row types and the `compute_line_pricing` function signature
- `@k3/validators` — `customerMachineSchema`, `maintenanceRequestSchema` (with cross-field guards: `problem_code='other'` ⇒ description required; non-CASH ⇒ contract required), `jobCreateSchema`, `jobAssignTechSchema`, `jobStepSchema` (UI sends a `step`, never a raw status), `documentLineSchema`, `contractSchema`, `contractMachineSchema`
- `@k3/repositories` — `CustomerMachinesRepository`, `ContractsRepository`, `ContractMachinesRepository`, `MaintenanceRequestsRepository`, `JobsRepository` (with `listForTechnician` and `advanceStep`), `DocumentLinesRepository`, **`PricingRepository`** wrapping the `compute_line_pricing` RPC
- `@k3/services` — `JobsService` (orchestrates step transitions, line creation through pricing), `LinePickerService` (lists priced services/parts/gas for the technician's mobile UI)

### API

- `/api/operations/requests` + `[id]`
- `/api/operations/jobs`, `[id]`, `[id]/step` (the SOLE technician advancement path), `[id]/lines`, `[id]/lines/[lineId]`, `[id]/assign`
- `/api/operations/customer-machines` + `[id]`
- `/api/operations/line-picker/{services,parts,gas}`
- `/api/contracts` + `[id]`, `[id]/machines`, `[id]/machines/[machineId]`
- `/api/signatures/upload`

### UI

**Mobile-first technician view** — `/my-jobs` and `/my-jobs/[id]`:
- The job page renders a single contextual "next step" button matching the current state.
- Tapping advances the DB-level status machine via `/step`.
- A line picker modal with three tabs (services / parts / gas) shows priced options with "Covered" badges.
- A signature pad captures the technician's required signature plus the customer's optional signature, uploaded to the `signatures` storage bucket.
- GPS is captured on "Arrived" via the browser's geolocation API.

**Office-side**:
- `/operations/requests` — list + new + detail with "Convert to job" action.
- `/operations/jobs` — Kanban-style dispatch board grouped by status.
- `/operations/jobs/[id]` — admin job detail with full timeline, line items table, signatures, and reassign control.
- `/contracts` + `/contracts/new` + `/contracts/[id]` — minimal contract management with attached-machines panel; pricing pulls automatically from `contract_pricing`.
- Customer detail page now embeds a `CustomerMachinesPanel` for managing machine instances.

## Architectural invariants (preserved from earlier phases)

- **No app-side pricing.** Every line on every document is priced by the `compute_line_pricing` PG function. The `PricingRepository.compute()` wrapper is the only client-side caller, and `JobsService.addLine()` is the only orchestrator that uses it.
- **No raw status writes from the UI.** The technician UI exclusively sends `step` values to `/api/operations/jobs/[id]/step`. The DB trigger `fn_jobs_status_transition` enforces that only legal transitions are accepted.
- **RLS with technician self-access.** Technicians can `SELECT`/`UPDATE` their own jobs without the `jobs:view`/`jobs:edit` permissions; office staff with those perms can do the same on every job.
- **No mock data, no shortcuts.** Every Phase 3 table has RLS; every importer-relevant decision flows through `compute_line_pricing`; every action that creates a numbered document calls `fn_next_doc_no`.

## Production deploy

1. Apply migrations 015-018 in order:
   ```bash
   supabase db push
   ```
2. Confirm the new RLS / trigger / function:
   ```sql
   SELECT relname, relrowsecurity FROM pg_class
   WHERE relnamespace = 'public'::regnamespace
     AND relname IN ('customer_machines','contracts','contract_machines',
                     'maintenance_requests','jobs','document_lines');
   -- All should return t
   SELECT tgname FROM pg_trigger WHERE tgname IN ('trg_jobs_status_transition','trg_dl_recalc_job_total');
   SELECT proname FROM pg_proc WHERE proname = 'compute_line_pricing';
   ```
3. Re-apply screen seeds and grant permissions to the appropriate roles. Technicians get `jobs_my:view` + the implicit RLS clause; dispatch staff get `jobs:view`/`edit`/`add` + `maintenance_requests:add`/`edit`.

## What's next — Phase 4 (Sales/Finance)

- Contract document generation: bilingual letterhead PDF, clause editor, 7-step wizard, contract number format `(NNN/YY) TYPE` (e.g., `(123/26) CW`).
- Quotations and invoices: similar polymorphic line items, pricing via `compute_line_pricing`, auto-generation on job completion.
- Compressor install bracket pricing with the +10% K3-supplied surcharge.
- Payments and receivables.
