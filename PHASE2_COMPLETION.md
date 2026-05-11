# K3 ERP — Phase 2 Completion Notes

Phase 2 (Master Data) is production-ready. This document captures what was built, how to deploy it, and how to load the initial data from the team's Excel files.

## What Phase 2 delivers

### Database (7 new migrations)

| File | Adds |
| --- | --- |
| `008_customers.sql` | `customers`, `customer_sites` (Kuwait address structure), trigram indexes, primary-site enforcement trigger, RLS |
| `009_machines.sql` | `machine_categories`, `machine_brands`, `refrigerant_types` (seeded R22/R410A/R407C/R32/R134A), `machines_master` with UNIQUE business key, RLS |
| `010_services.sql` | `service_categories`, `service_types`, `spare_part_categories`, `services_master` (auto-codes via `fn_next_doc_no('SRV')`), RLS |
| `011_parts_and_gas.sql` | `spare_parts_master` (auto-codes `PRT-NNNNN`, `compatible_categories uuid[]`), `gas_types_master` (per-refrigerant kg pricing), RLS |
| `012_pricing.sql` | **`service_pricing`** and **`contract_pricing`** — the pricing source-of-truth tables with CHECK constraints enforcing the "covered ⇒ price = 0" invariant; RLS |
| `013_imports.sql` | `import_runs`, `import_run_rows` for the two-stage preview→commit pipeline; RLS |
| `014_seed_categories.sql` | Seeds 10 machine categories, 14 spare-part categories, 28 service types, 12 brands, and zeroed gas pricing rows |

### TypeScript layer

- `@k3/shared-types` — extended with all Phase 2 row types
- `@k3/validators` — Zod schemas for every master, including `servicePricingSchema` with `superRefine` enforcing `covered ⇒ price = 0`
- `@k3/repositories` — base `CrudRepository<T>` plus 12 typed repositories: `Customers`, `CustomerSites`, `MachineCategories`, `MachineBrands`, `RefrigerantTypes`, `MachinesMaster`, `ServiceCategories`, `ServiceTypes`, `SparePartCategories`, `ServicesMaster`, `SparePartsMaster`, `GasTypesMaster`, `ServicePricing`, `ContractPricing`, `Imports`
- `@k3/services` — `ImportService` orchestrator + 6 importers (one per template) + `template-generator` for downloadable Excel templates

### UI

- 14 master pages under `/masters/*` plus customer pages — all routed through the sidebar
- Reusable `DataTable` component (RTL-aware, search, pagination)
- Generic `SimpleMasterClient` for code/name_ar/name_en/order/active masters
- `ImportsClient` with upload, preview, commit, cancel, and run history

### API

- 12 master CRUD route pairs (`/api/masters/*` + `[id]`)
- 5 customer routes
- 6 import routes: `templates/[t]`, `preview`, `commit`, `cancel`, `runs`, `[runId]/rows`

## Production deploy

1. Apply migrations 008-014 to the live Supabase project (in numeric order):
   ```bash
   supabase db push
   ```
2. Confirm RLS is enabled on every new table:
   ```sql
   SELECT relname, relrowsecurity FROM pg_class
   WHERE relnamespace = 'public'::regnamespace
     AND relname IN ('customers','customer_sites','machine_categories',
                     'machine_brands','refrigerant_types','machines_master',
                     'service_categories','service_types','spare_part_categories',
                     'services_master','spare_parts_master','gas_types_master',
                     'service_pricing','contract_pricing','import_runs',
                     'import_run_rows');
   ```
   All `relrowsecurity` should be `t`.
3. Grant the appropriate users the new screen permissions (super-admins automatically have all). Use `/admin/permissions` (Phase 5) or run the bootstrap.

## Loading the initial Excel data

Two production Excel files must be loaded:

1. `قائمة_انواع_خدمات_الصيانة_واسعارها.xlsx` → `service_pricing` (414 data rows)
2. `قائمة_تسعيير_العقود.xlsx` → `contract_pricing` (444 data rows)

### Option A — via the UI (recommended)

1. Sign in as a user with `service_pricing.import` and `contract_pricing.import` permissions.
2. Navigate to **Masters → Imports**.
3. Choose template **Service pricing**, upload the file, click **Preview**.
4. Verify the preview shows ~414 inserts and 0 errors.
5. Click **Commit import**.
6. Repeat with template **Contract pricing** for the second file.

The importer:
- Skips the Arabic translation row that follows each English header
- Recognises `Include`/`Included`/`Covered`/`مشمول` → `covered = true, price = 0`
- Forces `ug_covered = true` (decision #1: UG always covered)
- Auto-creates missing brands and service types
- Maps category synonyms (e.g. `AIR COOLED CHILLER` → `CHILLER`)

### Option B — via the CLI script

```bash
export NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

pnpm tsx scripts/load-initial-masters.ts \
  --service-pricing  ./uploads/قائمة_انواع_خدمات_الصيانة_واسعارها.xlsx \
  --contract-pricing ./uploads/قائمة_تسعيير_العقود.xlsx
# Run again with --commit when the preview looks correct:
pnpm tsx scripts/load-initial-masters.ts \
  --service-pricing  ./uploads/قائمة_انواع_خدمات_الصيانة_واسعارها.xlsx \
  --contract-pricing ./uploads/قائمة_تسعيير_العقود.xlsx \
  --commit
```

The CLI uses the same `createImportService` pipeline as the UI — no separate code path.

## What's next

- **Phase 3 — Operations**: maintenance requests, jobs, technician workflow, document_lines, the **`compute_line_pricing()`** Postgres function that consumes `service_pricing` + `contract_pricing` + `gas_types_master` as the sole source of pricing truth.
- **Phase 4 — Sales/Finance**: contracts (with the Arabic+EN letterhead), quotations, invoices, payments, compressor-bracket pricing.
- **Phase 5 — Permissions UI**, **Phase 6 — Reports/Chat/Dashboard**, **Phase 7 — Hardening**.
