# K3 ERP — Phase 5 Completion Notes

Phase 5 (Permissions UI & Audit Viewer) is complete. Until now, granting a user access to screens required SQL. This phase ships a proper users CRUD, an interactive permission grid (screen × action), role templates with bulk grant, and an audit log viewer with filters and before/after diffs.

## What Phase 5 delivers

### Database (1 new migration)

**`023_permissions_and_audit.sql`** adds three SECURITY DEFINER RPCs and seeds three new admin screens:

- **`fn_apply_template_to_user(p_user_id, p_template_id, p_replace)`** — bulk-grants the template's items to a user. With `p_replace=true` it deletes all existing grants first; with `p_replace=false` it merges (adds missing grants without disturbing others). Items with `granted=false` are skipped — granting requires explicit positive intent. Audited.
- **`fn_user_permission_grid(p_user_id)`** — efficient `screens × default_actions` lookup. Returns one row per (screen × action) pair with `granted=true` if the user has an explicit grant. The UI uses this to render the permission editor instead of fetching screens + permissions separately.
- **`fn_set_user_active(p_user_id, p_active)`** — toggles activation with two guards: you cannot deactivate yourself, and you cannot deactivate the last active super-admin.

The migration also seeds the screens `users`, `permission_templates`, `audit_log` and relaxes the `audit_log` SELECT policy from super-admin-only to anyone with `audit_log:view`.

### TypeScript layer

- `@k3/shared-types` — added function signatures for `fn_apply_template_to_user`, `fn_user_permission_grid`, `fn_set_user_active`. The existing row types for `users_profile`, `screens`, `user_screen_permissions`, `audit_log`, `permission_templates`, and `permission_template_items` from Phase 1 are reused.
- `@k3/validators/permissions.ts` — `userProfileSchema` (with email immutability via `userProfileUpdateSchema = userProfileSchema.partial().extend({ email: z.never().optional() })`), `permissionGrantSchema`, `permissionTemplateSchema`, `permissionTemplateItemSchema`, `applyTemplateSchema`, plus the canonical `PERMISSION_ACTIONS` const.
- `@k3/repositories`:
  - `UsersProfileRepository` extended with `listAll(opts)` (admin-side, can include archived), `count`, `create`, `archive`.
  - New `admin.repository.ts` (separate file to avoid colliding with the existing runtime `PermissionsRepository`): `ScreensRepository` (read-only listing), `UserPermissionsAdminRepository` (`grid`, `setGrant`, `replaceForUser`, `applyTemplate`, `setUserActive`), `PermissionTemplatesRepository` (extends `CrudRepository`), `PermissionTemplateItemsRepository` (`listForTemplate`, `setItem`, `replaceItems`), `AuditLogRepository` (`list` with filters, `distinctEntityTypes`, `distinctActions`).
- `@k3/services/user-invitation.service.ts` — wraps the Supabase admin auth API. `invite()` calls `auth.admin.inviteUserByEmail`, then upserts the `users_profile` row, with rollback on profile-insert failure. `archive()` deactivates the profile and deletes the auth record (best-effort).

### API

- `/api/admin/users` (GET list, POST invite via `UserInvitationService`)
- `/api/admin/users/[id]` (GET, PATCH, DELETE → archive)
- `/api/admin/users/[id]/permissions` (GET grid, PUT bulk replace, POST single toggle)
- `/api/admin/users/[id]/apply-template` (POST with `{template_id, replace}`)
- `/api/admin/users/[id]/active` (POST `{active}`)
- `/api/admin/permission-templates` (GET, POST) + `[id]` (PATCH, DELETE)
- `/api/admin/permission-templates/[id]/items` (GET, PUT bulk replace)
- `/api/admin/audit-log` (GET with filters)

API routes use `PermissionsRepository.hasScreenPermission` for friendly 403 errors before hitting RLS-protected operations. RLS remains the source of truth.

### UI

- **`/admin/users`** — list with search, status badges (active/inactive/super-admin), inline activate/deactivate and archive actions. Super-admins are flagged with a shield icon. The archive action is hidden for super-admins.
- **`/admin/users/new`** — invitation form using `userProfileSchema`. The user receives an email with a password-set link. Super-admin and active toggles are surfaced explicitly.
- **`/admin/users/[id]`** — split layout: profile editor (full name AR/EN, phone, technician ID, super-admin and active toggles) + the permission grid. Super-admins see a banner explaining they have all permissions; the grid is hidden. Apply-template control surfaces template choice + merge/replace mode. Each toggle saves optimistically with rollback on error.
- **`/admin/permission-templates`** — list with inline create form. Each template links to its detail page.
- **`/admin/permission-templates/[id]`** — meta editor (name, description, active) + items grid (same `PermissionGrid` component reused). Toggles persist via the items PUT endpoint with mutate-and-replace semantics.
- **`/admin/audit-log`** — filter form (user, entity type, entity ID, action, from/to date) + expandable rows showing before/after JSON diffs in red/green pre blocks.
- **`PermissionGrid` component** at `apps/web/components/admin/permission-grid.tsx` — the centerpiece. Groups by module → screen, shows only the actions that exist in the supplied grid (different screens have different default_actions), renders a checkbox matrix with optimistic toggles and per-cell loading state. Reused for both user permissions and template items.

### Sidebar

`SCREEN_HREFS` extended with `users: '/admin/users'`, `permission_templates: '/admin/permission-templates'`, `audit_log: '/admin/audit-log'`.

### i18n

Full `admin` section in both Arabic and English, covering users (with invite/activate/archive/applyTemplate strings), permissionTemplates, auditLog, plus an `admin.actions` map for the permission grid column headers (view/add/edit/delete/print/export/approve/assign/import).

## Architectural invariants (preserved)

- **No raw SQL from the UI.** Every permission mutation goes through a typed API → repository → Postgres. The `fn_*` RPCs are SECURITY DEFINER but check the caller's perms inside before doing anything privileged.
- **Self-defense.** You cannot deactivate yourself; you cannot deactivate the last active super-admin. Both enforced by `fn_set_user_active`.
- **Append-only audit.** The `audit_log` is append-only via triggers and SECURITY DEFINER paths. The viewer is read-only — no DELETE policy on `audit_log` exists.
- **Email is immutable.** Once created, a user's email cannot be changed via the admin UI (the `userProfileUpdateSchema` rejects it). Email changes need a separate flow (auth-level identity migration, out of scope for Phase 5).
- **Absence is the deny.** `user_screen_permissions` rows with `granted=false` are never persisted. Toggling off deletes the row.

## Production deploy

1. Apply migration 023:
   ```bash
   supabase db push
   ```
2. Verify:
   ```sql
   SELECT proname FROM pg_proc WHERE proname IN
     ('fn_apply_template_to_user','fn_user_permission_grid','fn_set_user_active');
   SELECT code FROM public.screens WHERE code IN ('users','permission_templates','audit_log');
   ```
3. Grant the `users:*`, `permission_templates:*`, and `audit_log:view` permissions to your operations-admin role template, or to specific staff. Super-admins get them implicitly via `fn_is_super_admin()`.
4. Set `SUPABASE_SERVICE_ROLE_KEY` in the production environment — `UserInvitationService` requires it to call `auth.admin.inviteUserByEmail`.

## What's next — Phase 6 (Reports / Chat / Dashboard)

- 11 reports (sales, expense, profit, contracts active, jobs by tech, parts consumption, gas consumption, customer balances, payment aging, technician performance, KPIs).
- 1-to-1 + group chat with attachments (10 files × 25MB) + voice messages.
- Dashboard widgets (today's jobs, open requests, overdue invoices, revenue MTD).
- Push notifications.
