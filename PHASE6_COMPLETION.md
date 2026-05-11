# K3 ERP — Phase 6 Completion Notes

Phase 6 (Dashboard, Reports, Chat) is complete. The system now has the daily-driver pieces: a dashboard that greets users when they log in, eight reports for office use with CSV export, and an internal chat module with realtime, file attachments, and voice messages.

## Phase 6a — Dashboard widgets

### Database (migration 024)

Four SECURITY INVOKER aggregation RPCs:

- **`fn_dashboard_today_jobs()`** — counts of today's jobs by status group (in_field, working, completed_today, pending_assignment).
- **`fn_dashboard_open_requests()`** — count of open/in-progress requests by priority (urgent → emergency in the UI, high, normal, low).
- **`fn_dashboard_overdue_invoices()`** — count of overdue invoices, count due in the next 7 days, total outstanding, total overdue.
- **`fn_dashboard_revenue_mtd()`** — month-to-date invoiced total, previous month total, invoice count, and a daily JSONB series for sparkline rendering.

All four lean on RLS so technicians see only their own data while office staff see organisation-wide totals.

### TypeScript and repository

`@k3/shared-types` extended with the four function signatures. `@k3/repositories/dashboard.repository.ts` wraps all four with typed return interfaces (`DashboardTodayJobs`, `DashboardOpenRequests`, `DashboardOverdueInvoices`, `DashboardRevenueMtd`), exported from index.

### UI

- **`StatWidget`** — reusable widget shell with title/value/subtitle/icon/href/tone (brand/green/amber/red) and a children slot for sparklines or sub-stats.
- **`Sparkline`** — pure SVG, no chart libraries. Renders a green stroke + faint area fill from a `{date, amount}[]` series.
- **`/dashboard/page.tsx`** — replaces the Phase 1 placeholder. 4-widget grid with per-widget perm gating (`canViewJobs`, `canViewMyJobs`, `canViewRequests`, `canViewInvoices`). MTD vs prev-month delta computed inline. Locale-aware formatting (ar-KW vs en-US) for dates and counts; KWD with `.toFixed(3)` throughout.

i18n: full `dashboard` namespace in AR and EN.

## Phase 6b — Reports infrastructure

### Database (migration 025)

Eight SECURITY INVOKER report RPCs plus eight screen seeds in the `reports` module:

| RPC | Inputs | Output |
| --- | --- | --- |
| `fn_report_sales` | `from_date`, `to_date` | invoiced/paid/outstanding by day |
| `fn_report_payment_aging` | — | per-customer outstanding bucketed current/1-30/31-60/61-90/90+ days |
| `fn_report_technician_perf` | `from_date`, `to_date` | jobs completed/cancelled, avg arrival-to-complete minutes, total invoiced (joined via `jobs.invoice_id`) |
| `fn_report_jobs_by_tech` | — | live status breakdown per technician |
| `fn_report_parts_consumption` | `from_date`, `to_date` | quantity, value, distinct job count per part |
| `fn_report_gas_consumption` | `from_date`, `to_date` | quantity, value, distinct job count per gas (joined via `gas_types_master → refrigerant_types` for the name) |
| `fn_report_customer_balances` | — | per-customer invoiced/paid/outstanding (HAVING balance > 0) |
| `fn_report_active_contracts` | — | active contracts with days_remaining sorted ASC |

Snapshot reports (no date params) and date-ranged reports are mixed; the UI surfaces this via the `isSnapshot` prop on `ReportShell`.

### TypeScript and repository

`@k3/shared-types` extended with all eight RPC signatures. `@k3/repositories/reports.repository.ts` provides eight typed methods and eight row interfaces (`SalesReportRow`, `PaymentAgingRow`, `TechnicianPerfRow`, `JobsByTechRow`, `PartsConsumptionRow`, `GasConsumptionRow`, `CustomerBalanceRow`, `ActiveContractRow`).

### API

Eight routes under `/api/reports/*`. Each is thin: parse search params, call the repo method, return rows.

### UI — `ReportShell` component

The architectural centerpiece of Phase 6b. Generic over `T`, takes:

```ts
interface Props<T> {
  title: string;
  rows: T[];
  columns: ReportColumn<T>[];
  hasDateRange?: boolean;
  fromDate?: string;
  toDate?: string;
  isSnapshot?: boolean;
  summaryRow?: React.ReactNode;
}
```

`ReportColumn<T>` separates `cell` (rendered React) from optional `csv` (export string) — display formatting and CSV formatting stay independent. Five date presets: MTD, last 30, QTD, last 90, YTD. Each preset round-trips through URL search params, so deep links survive refresh.

CSV export is client-side via `rowsToCsv`: properly escaped (quote-doubling, comma/newline detection), prepended with UTF-8 BOM (`\ufeff`) so Excel-Arabic opens it without mojibake. Triggered via `Blob` + `URL.createObjectURL` + a programmatic `<a download>` click.

### UI — eight report pages

All eight built. Each is a server component: `requireScreen(...)` → repo call → `<ReportShell>` with row-typed columns. Date-ranged reports (sales, technician-perf, parts-consumption, gas-consumption) default to MTD. Snapshot reports (payment-aging, jobs-by-tech, customer-balances, active-contracts) show a "live snapshot" notice instead of date pickers.

Cell formatting choices: KWD totals always shown with three decimals; aging buckets get colour gradients (current → red at 90+); days-remaining on active contracts gets red <30, amber <90, neutral otherwise; technician completed jobs in green; cancelled in red. Each report has a tfoot summary row with totals.

`SCREEN_HREFS` extended with all eight reports routes. The `reports` module was already in `MODULE_ORDER` from Phase 1.

i18n: full `reports` namespace in AR and EN — top-level keys (fromDate, toDate, refresh, exportCsv, presets, snapshot, noRows) plus per-report sub-namespaces with column headers.

## Phase 6c — Internal chat

### Database (migration 026 + 027)

**Migration 026** ships the chat schema:

- **`chat_threads`** — id, optional name (required for groups via check constraint), `is_group`, `last_message_at`. Bumped automatically by trigger on every message insert.
- **`chat_thread_members`** — `thread_id × user_id` (unique), `joined_at`, `last_read_at`, `is_muted`. The `last_read_at` column is the basis for the unread badge.
- **`chat_messages`** — `thread_id`, `sender_id`, `body`, `attachments` JSONB (array of `{name, mime, size, storage_path}`), `is_deleted`, `edited_at`. Two check constraints: must have body OR ≥1 attachment, and at most 10 attachments.

Trigger `fn_chat_messages_bump_thread` updates `chat_threads.last_message_at` and `updated_at` after every insert.

**RLS** (the centerpiece of chat security):
- Threads, members, messages are all visible only to thread members.
- A user can join a thread (insert into `chat_thread_members`) only as themselves (`user_id = auth.uid()`) or as the thread creator adding others.
- Messages: insert requires `sender_id = auth.uid()` AND membership.
- Soft-delete (`UPDATE is_deleted=true`) restricted to sender or super-admin.

Two helper RPCs:
- **`fn_chat_create_or_get_dm(other_user_id)`** — idempotent: returns the existing 2-member non-group thread between caller and target, or creates one. Refuses to DM yourself. Refuses if target is inactive/archived.
- **`fn_chat_thread_summary()`** — returns the thread list visible to caller in one query (no N+1): last-message preview (truncated at 120 chars or 📎 placeholder for attachment-only), unread count (messages from others past `last_read_at`), other-user identity for 1-to-1 threads, member counts.

**Migration 027** creates the `chat-attachments` Supabase storage bucket (private, 25 MB file limit) with three RLS policies: read requires thread membership; insert requires the path to start `{threadId}/{auth.uid()}/...` AND membership; delete restricted to uploader or super-admin. Path enforcement uses `(storage.foldername(name))[N]`.

### TypeScript and validators

`@k3/shared-types` extended with `chat_threads`, `chat_thread_members`, `chat_messages` row/insert/update types and the two chat RPC signatures. `@k3/validators/chat.ts`: `chatAttachmentSchema` (with the 25 MB cap as a Zod refinement message), `chatMessageInputSchema` (refined to require body OR ≥1 attachment), `chatGroupCreateSchema`, `MAX_ATTACHMENTS_PER_MESSAGE = 10`, `MAX_ATTACHMENT_SIZE_BYTES = 25*1024*1024` constants.

### Repository

`@k3/repositories/chat.repository.ts` exports two repos:
- **`ChatThreadsRepository`** — `summary` (RPC), `getById`, `createOrGetDm` (RPC), `createGroup` (transaction over insert + member rows), `listMembers` (joined to user_profile for display names), `markRead`, `setMuted`.
- **`ChatMessagesRepository`** — `list` (cursor-paginated by `before` timestamp, joined to user_profile for sender name, `is_deleted=false` filter, returned chronologically), `send`, `softDelete`.

Both exported from index alongside their type aliases.

### API

- `GET /api/chat/threads` — calls `summary` RPC.
- `POST /api/chat/threads` — creates a group (validated by `chatGroupCreateSchema`).
- `POST /api/chat/dm` — creates or gets a 1-to-1 DM.
- `GET/POST /api/chat/threads/[id]/messages` — list (cursor by `before` query param) / send (validated by `chatMessageInputSchema`).
- `POST /api/chat/threads/[id]/read` — marks thread read.
- `GET /api/chat/threads/[id]/members` — for group member display.
- `POST /api/chat/upload` — multipart, validates 25 MB cap, uploads to `chat-attachments` bucket with the canonical `{threadId}/{userId}/{ts}_{filename}` path. Returns the attachment record `{name, mime, size, storage_path}` for inclusion in the next message.

### UI

**Chat list page** (`/chat`) — server component fetches `summary()` + active users list. `ChatListClient` renders thread cards with avatar (Users icon for groups, first letter for DMs), bold-when-unread last message preview, relative time ("now", "5m ago", "today HH:MM", "Mon", "Apr 12"), unread badge. Includes "New chat" picker and "New group" form (multi-select members, name input, validates ≥1 member).

**Chat thread page** (`/chat/[threadId]`) — server component loads thread, members (for header + "show members" panel), 50 most recent messages, marks thread read on entry. `ChatThreadClient` is the architectural centerpiece:

- **Realtime**: subscribes to `supabase.channel(`chat:${threadId}`).on('postgres_changes', {event: 'INSERT/UPDATE', filter: 'thread_id=eq.${threadId}'}, ...)`. New messages append to local state with deduplication on id. Updates (e.g. soft-delete from another tab) propagate via UPDATE handler. RLS makes this safe — realtime respects row-level visibility.
- **Auto-scroll**: scrolls to bottom only if user is already near bottom (within 200px), so reading older messages isn't disrupted by incoming traffic.
- **Mark read**: on focus and on entry. Window focus listener calls `/read`.
- **File attachments**: click paperclip → file picker → client-side validation against the 25 MB / 10-files limits → upload to bucket → pending chip shown with status (uploading/uploaded/error) → on send, attachments array is included in the message JSON. Removing a pending chip discards client-side; the upload is not deleted server-side (orphan, cleaned periodically out of scope here).
- **Voice recording**: `MediaRecorder` API. Picks the best supported mime type (`audio/webm;codecs=opus` → `audio/webm` → `audio/mp4`). Records, on stop turns the chunks into a `Blob` → `File` → upload via the same path as files. Cancel button discards chunks before stop.
- **Message rendering**: bubble layout with mine right (brand) vs others left (white). Group threads show sender name in coloured header. Soft-deleted messages show "this message was deleted" in italic gray. Attachments render as clickable rows with mic-icon for audio (labelled "Voice message") or download-icon for files. Click → fetches a 60-second signed URL and opens it in a new tab.
- **Composer**: textarea with auto-grow, Enter sends (Shift+Enter newline), send button disabled when no body and no uploaded attachments.

i18n: full `chat` namespace in AR and EN.

`SCREEN_HREFS.chat = '/chat'`. The `communication` module was already in `MODULE_ORDER`.

## Phase 6 cleanup migration 028

The original `users_profile.technician_id` column (declared in migration 002) was typed as `uuid` with the comment "FK added in later migration once technicians table exists". Phase 5's user form treated it as a text code (e.g. "TECH-01"), which would have failed type checks at runtime. Migration 028 adds a proper `technician_code text` column and updates the validator/UI/services/reports to use it. The `technician_id` uuid column is left in place for future use.

## Architectural invariants (preserved across Phase 6)

- **No raw SQL from the UI.** Every page/API route goes through a typed repository → Postgres. RPCs encapsulate aggregations.
- **RLS is the source of truth.** Both dashboard widgets and report data scope automatically by user permissions; no parallel access logic in the UI.
- **CSV exports preserve Arabic.** UTF-8 BOM is non-negotiable for Excel compatibility — confirmed by the Egyptian/Kuwaiti finance team's prior pain with mojibake.
- **No N+1 in the chat list.** A single RPC call returns thread metadata + last message + unread count + other-party identity.
- **No third-party chart libraries.** The sparkline is hand-rolled SVG (~30 lines) — keeps the bundle small and the visual consistent.
- **Realtime respects RLS.** The Supabase realtime subscription on `chat_messages` only delivers rows the user could SELECT, so privacy is preserved without extra checks in the client.

## Production deploy

1. Apply migrations 024–028 in order:
   ```bash
   supabase db push
   ```
2. Verify:
   ```sql
   SELECT proname FROM pg_proc WHERE proname LIKE 'fn_dashboard_%' OR proname LIKE 'fn_report_%' OR proname LIKE 'fn_chat_%';
   SELECT id FROM storage.buckets WHERE id = 'chat-attachments';
   SELECT code FROM public.screens WHERE module IN ('reports','communication');
   ```
3. Grant the `report_*:view`, `report_*:export`, `chat:view`, `chat:add` permissions through the Phase 5 admin UI to the relevant role templates.
4. Enable Realtime on the `chat_messages` table in the Supabase dashboard (Database → Replication).
5. Set the storage bucket to private if not already.

## What's next — Phase 7 (Hardening)

- E2E tests covering the technician mobile flow, the office dispatch board, the contract-print round-trip, the auto-invoice flow, and the chat realtime path.
- RLS audit: enumerate every table, every policy, and every role; assert no permissive-by-default policies leaked through.
- Performance profiling: explain-analyze the 8 report RPCs against 10k+ row datasets; add indexes where the planner reaches for sequential scans.
- Push notifications for chat (Web Push API + service worker; partial work deferred from Phase 6c).
- Backup/restore drill on a staging DB. UAT with the K3 office team in Kuwait.
