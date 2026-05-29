# Property Basket — Claude Context File

This file is read automatically by Claude Code at the start of every session.
Keep it current. Update it whenever a phase completes or the stack changes.

---

## Project Overview

**Property Basket** is a South African proptech SaaS platform.
Multi-sided marketplace: Agencies → Agents → Listings → Leads → Tenants/Buyers.

**Stack**
- Laravel 12 (PHP 8.2) + MySQL 8 — API/SSR backend
- Inertia.js v3 + React 19 + TypeScript — SPA frontend (no separate API)
- Tailwind CSS v4 — utility-first styling
- Vite 7 + `@vitejs/plugin-react` v5 (pinned — v6 requires Vite 8)
- Spatie Laravel Permission v6 — role/permission gate

**Local environment**
- XAMPP on Windows: `C:\xampp\htdocs\property-basket\`
- Dev server: `http://localhost` (Apache) or `php artisan serve`
- DB: MySQL 8 · database `property_basket`
- Run frontend: `npm run dev` (Vite HMR)
- Build: `npm run build`
- Seed: `php artisan db:seed`

**Dev gotchas (read before debugging "site broken" reports)**
- **MySQL must be running** — start it from XAMPP Control Panel or `C:\xampp\mysql_start.bat`. `[2002] connection refused on 127.0.0.1:3306` = MySQL is down.
- **Vite hot file** (`public/hot`) — present while `npm run dev` runs. If Vite crashes or HMR goes stale but the hot file lingers, every page renders a blank white screen because Laravel tries to fetch assets from `http://127.0.0.1:5173` and they never come back. Fix: stop `npm run dev` (Ctrl+C) and delete `public/hot`; Laravel will fall back to the built bundle in `public/build/`.
- **For routine testing prefer the built bundle** — run `npm run build` once, leave `npm run dev` stopped. Only start the dev server when actively editing TSX.
- **Vite must bind to IPv4** — `vite.config.js` pins `server.host = '127.0.0.1'`. If it ever drifts back to `[::1]:5173`, the browser can't reach it and you get the same white screen.

---

## Roles

| Enum value    | Description                              |
|---------------|------------------------------------------|
| `super_admin` | Platform owner — full access             |
| `agency_admin`| Agency owner/manager                     |
| `agent`       | Field agent under an agency              |
| `landlord`    | Property owner listing through an agency |
| `tenant`      | Renter/buyer searching properties        |
| `contractor`  | Maintenance/repair contractor            |

---

## Key Architecture Patterns

**Inertia rendering** — every controller returns `Inertia::render('Folder/Page', [...props])`.
The React page lives at `resources/js/Pages/Folder/Page.tsx`.

**Layouts** — wrap pages in `<AgentLayout>` / `<AgencyLayout>` / `<PublicLayout>` / `<AuthLayout>`.
All layouts use `<AppLogo>` component (see below).

**Agent scoping** — `ResolvesAgent` trait in `app/Http/Controllers/Agent/Concerns/`.
Finds `AgencyAgent` pivot record. Abort 403 if not linked.

**Agency scoping** — `ResolvesAgency` trait (same pattern).

**Commission math** — `App\Services\CommissionService`.

**Logo** — `resources/js/Components/AppLogo.tsx`.
- `variant="dark"` (default) → `public/images/logo.png` (full, black, light bg)
- `variant="white"` → icon-only white + white text span (dark bg)

---

## Demo Credentials (password: `password` for all)

| Role          | Email                            | Notes                         |
|---------------|----------------------------------|-------------------------------|
| super_admin   | admin@propertybasket.local       | Full platform access          |
| agency_admin  | owner@sandton-realty.test        | Sandton Realty                |
| agent         | sipho@sandton-realty.test        | Phase 4 demo data loaded      |
| agent         | aisha@sandton-realty.test        | Sandton Realty                |
| agency_admin  | owner@atlantic-seaboard.test     | Atlantic Seaboard Properties  |
| agency_admin  | owner@winelands.test             | Winelands Estates             |
| landlord      | lerato@example.test              |                               |
| tenant        | tshepo.khumalo@example.test      |                               |
| contractor    | themba@plumbpro.test             |                               |

---

## File Map — Key Files

```
app/
  Enums/Role.php                          — Role enum
  Models/                                 — Eloquent models
  Http/Controllers/
    Admin/                                — 11 super admin controllers
                                              (Overview, Agencies, Landlords, Contractors, Users,
                                               Roles, Subscriptions, Transactions, Announcements,
                                               Settings, System)
    Contractor/                           — 7 contractor controllers
                                              (Dashboard, Requests, Jobs, Quotes, Invoices,
                                               Finance, Messages)
    Agent/                                — 8 agent controllers
    Agency/                               — Agency admin controllers
    Landlord/                             — 6 landlord controllers
    Auth/                                 — Login / Register / Invite
    Public/                               — Public-facing pages
  Services/
    CommissionService.php
    PaystackService.php (stub)
  
database/
  migrations/                             — All migrations (run ✓)
  seeders/
    DatabaseSeeder.php                    — Calls all seeders
    RolesAndPermissionsSeeder.php
    SuperAdminSeeder.php
    DemoDataSeeder.php
    Phase3DemoSeeder.php
    Phase4DemoSeeder.php
    Phase5DemoSeeder.php
    Phase6DemoSeeder.php
    Phase7DemoSeeder.php
    Phase8DemoSeeder.php

resources/js/
  Components/
    AppLogo.tsx                           — Shared logo (icon + 2-line wordmark)
    ListingForm.tsx                       — Shared 6-step listing wizard
                                              (used by Agency/Agent/Landlord create pages)
    InviteAgentModal.tsx                  — Shared invite modal (Agency Overview + Agents page)
    NewLeadModal.tsx                      — Add-deal modal opened from Agent pipeline columns
                                              + Agent overview "New Lead"
    LeadDetailsModal.tsx                  — Click any kanban card / table row →
                                              contact details + listing context + quick actions
    NotificationBell.tsx                  — Shared bell + unread dropdown (Agent/Agency/Landlord)
    InviteTenantModal.tsx                 — Shared (Agent + Landlord via submitUrlBase prop)
    LandlordInviteTenantModal.tsx         — Wraps above; resend-vs-new modes
    AddContractorModal.tsx                — Agency private contractor add
    ScheduleViewingModal.tsx              — Viewings calendar create
    DebitOrderModal.tsx                   — Tenant debit-order mandate
    NewQuoteModal.tsx                     — Contractor quote builder
    NewInvoiceModal.tsx                   — Contractor invoice w/ locked quote + deviations
    RequestDetailsModal.tsx               — Contractor job viewer (photos + embedded quote form)
    ErrorBoundary.tsx                     — Class boundary (variant="global"|"section")
    NetworkErrorToast.tsx                 — Inertia error toast (mounted near root)
    Skeleton.tsx                          — Spinner + skeleton primitives
  Layouts/
    AdminLayout.tsx                       — Super admin sidebar layout
    AgentLayout.tsx                       — Agent sidebar layout
    ContractorLayout.tsx                  — Contractor sidebar layout
    AgencyLayout.tsx                      — Agency sidebar layout
    LandlordLayout.tsx                    — Landlord sidebar layout
    TenantLayout.tsx                      — Tenant sidebar layout
    PublicLayout.tsx                      — Public nav layout
    AuthLayout.tsx                        — Auth split-panel layout
  Pages/
    Contractor/                           — 7 pages (Phase 7 ✓)
      Overview.tsx
      Requests.tsx
      Jobs.tsx                — 4-column kanban
      Quotes.tsx
      Invoices.tsx
      Finance.tsx             — earnings + payouts
      Messages.tsx
    Admin/                                — 11 pages (Phase 8 ✓)
      Overview.tsx
      Agencies.tsx
      Landlords.tsx
      Contractors.tsx
      Users.tsx
      Roles.tsx               — permissions matrix
      Subscriptions.tsx       — plan tier cards
      Transactions.tsx        — Paystack charges + KPIs
      Announcements.tsx       — broadcast composer + recent
      Settings.tsx            — tabbed platform settings
      System.tsx              — health + incidents
    Landlord/                             — 6 pages (Phase 6 ✓)
      Overview.tsx
      Properties.tsx
      Tenants.tsx
      Maintenance.tsx
      Finance.tsx
      Messages.tsx
    Tenant/                               — 6 pages (Phase 5 ✓)
      Overview.tsx
      Lease.tsx
      Payments.tsx
      Maintenance.tsx
      Documents.tsx
      Messages.tsx
    Agent/                                — 8 pages (Phase 4 ✓)
      Overview.tsx
      Pipeline.tsx
      Listings.tsx
      Viewings.tsx
      Inspections.tsx
      Messages.tsx
      Commission.tsx
      Analytics.tsx
    Agency/                               — 9 pages (Phase 3 ✓)
    Public/                               — Home, Properties, Agencies
    Auth/                                 — Login, Register, AcceptInvite

routes/web.php                            — All routes (public + agency + agent)
```

---

## Phases Status

| Phase | Scope                              | Status      |
|-------|------------------------------------|-------------|
| 1     | Auth, roles, invite flow           | ✅ Complete |
| 2     | Public site, listings, inquiries   | ✅ Complete |
| 3     | Agency Admin dashboard (9 views)   | ✅ Complete |
| 4     | Agent dashboard (8 views)          | ✅ Complete |
| 5     | Tenant dashboard (6 views)         | ✅ Complete |
| 6     | Landlord dashboard (6 views)       | ✅ Complete |
| 7     | Contractor dashboard (7 views)     | ✅ Complete |
| 8     | Super Admin dashboard (11 views)   | ✅ Complete |
| 9     | Polish, tests, deployment          | ✅ Complete |

---

## Agent Pipeline — drag-and-drop

`resources/js/Pages/Agent/Pipeline.tsx` is a Kanban ↔ Table dual view backed by `Inquiry` rows scoped to the logged-in agent.

- **Kanban view** — 5 columns (`new`, `qualified`, `viewing`, `offer`, `closed`). Cards are HTML5-draggable; dropping on a column calls `PATCH /agent/pipeline/leads/{inquiry}/status` (`Agent\PipelineController::updateLeadStatus`). UI updates optimistically via `moveCardLocally()`; on server error a `router.reload({ only: ['columns'] })` rolls back.
- **Table view** — flat list with an inline status `<select>` that calls the same PATCH endpoint.
- **Click vs drag disambiguation** — after a drop, browsers fire a synthetic `click` on the underlying card. Without suppression that click pops the LeadDetailsModal on the wrong card. Mitigation: `dragEndAtRef` timestamp set by `markDragEnd()` from **both** `onCardDragEnd` AND `onColumnDrop` (the drag-end handler may not fire if the source DOM node was unmounted by the optimistic move). Clicks within 500 ms of either event are ignored. If you add another drop path, call `markDragEnd()` from it too.
- **New leads** — `+ Add deal` per column + global `Add Deal` button open `<NewLeadModal>`; POST `/agent/pipeline/leads` creates an `Inquiry` with `source='agent_manual'`, `allocation_method='manual'`, `assigned_to=$user->id`.
- **Cross-dashboard sync** — agent-side status changes write to the same `inquiries` table the agency pipeline reads from, so the agency view updates on next reload.

---

## Conventions

- Currency: ZAR (`R`), format with `R X,XXX` (no decimals for display)
- Timezone: `Africa/Johannesburg` (SAST = UTC+2)
- Font: Plus Jakarta Sans
- Brand purple: `#5B3DF5` → Tailwind token `brand-500`
- Ink scale: `ink-50` … `ink-900` (grays)
- `success` = `#10B981`, `warning` = `#F59E0B`, `danger` = `#EF4444`
- Always use `shadow-soft` on cards, `shadow-lift` on hover
- Money helper pattern: `fmtMoney(n)` — `>= 1m` → `R X.Xm`, `>= 1k` → `R Xk`

---

## Paystack Integration

`App\Services\PaystackService` is dual-mode:

- **Stub** — default when `PAYSTACK_SECRET_KEY` is empty. Returns deterministic fake identifiers so the platform demos end-to-end without network access. `verifyTransaction` marks the matching `RentPayment` paid instantly.
- **Live** — set `PAYSTACK_SECRET_KEY=sk_test_xxx` (or `sk_live_xxx`) and `PAYSTACK_STUB=false` in `.env`. All methods call the real `https://api.paystack.co` REST API via Laravel's `Http` facade.

`isStub()` returns the current mode. Service auto-detects but you can force either via env.

### Rent payment flow

1. Tenant clicks "Pay now" on `/tenant/payments`
2. `POST /tenant/payments/pay` → `PaystackController::initialize` → `PaystackService::initializePayment()` returns Paystack `authorization_url`
3. Browser redirected to Paystack hosted checkout (or in stub mode, straight to the callback URL with `?stub=1`)
4. After payment, Paystack redirects to `GET /payments/paystack/callback?reference=…`
5. Callback verifies the reference; on success marks `RentPayment.status=paid` + fires `RentPaymentReceived` notification (which attaches the PDF receipt)
6. User lands back on `/tenant/payments` with a flash banner

### Webhook (server-to-server)

`POST /webhooks/paystack` — Paystack signs with HMAC SHA512 in `X-Paystack-Signature`. `verifyWebhook()` checks against `PAYSTACK_SECRET_KEY`. CSRF excluded in `bootstrap/app.php`. Handles `charge.success`, `transfer.success`, `transfer.failed/reversed`.

### Commission payouts

`Agency\CommissionController::runPayout` → `PaystackService::runPayoutBatch(batch)` → POST `/transfer/bulk` in live mode. Each agent's `paystack_recipient_code` must be set first via `createTransferRecipient(user, ['account_number'=>..., 'bank_code'=>...])`.

### Conventions

- Money on Paystack API is **integer kobo** (× 100). Service handles conversion.
- Currency hard-coded to `ZAR`.
- Channel mapping: `card` → `paystack_card`; `bank`/`bank_transfer`/`ussd` → `paystack_eft`.
- Failed verify keeps `RentPayment.status=pending` so the tenant can retry.

### Tests

Use Laravel's `Http::fake()` to mock Paystack:
```php
config(['services.paystack.secret_key' => 'sk_test_X', 'services.paystack.stub' => false]);
Http::fake([
    'api.paystack.co/transaction/initialize' => Http::response([
        'status' => true,
        'data'   => ['authorization_url' => '...', 'access_code' => 'a', 'reference' => 'R'],
    ], 200),
]);
```
See `tests/Feature/PaystackIntegrationTest.php` for stub-mode, live-mode, webhook-signature, and bulk-transfer examples.

---

## Email Notifications

All notifications live in `app/Notifications/`. Each extends Laravel's `Notification`, implements `via()` (typically `['mail', 'database']`) and `toMail()` (returns a `MailMessage`).

| Notification | Triggered from | Recipient(s) |
|---|---|---|
| `WelcomeUser` | `Auth\RegisterController::store`, `Auth\InvitationController::accept` | New user (role-specific body) |
| `UserInvited` | `Agency\AgentsController::invite` | Anonymous, routed by email |
| `InquiryReceived` | `InquiryService::createFromWebsite` | Assigned agent |
| `RentPaymentReceived` | *(not wired yet — call from wherever rent gets marked paid)* | Tenant — PDF receipt attached |
| `CommissionApproved` | `Agency\CommissionController::approve` | Each affected agent |
| `CommissionPaid` | `Agency\CommissionController::runPayout` | Each agent in the batch |
| `MaintenanceRequestSubmitted` | `Tenant\MaintenanceController::store` | Lease's agent + landlord |
| `MaintenanceJobAccepted` | `Contractor\JobsController::start` | Tenant |
| `MaintenanceJobCompleted` | `Contractor\JobsController::complete` | Tenant + agent + landlord |
| `MaintenanceInvoicePaid` | *(not wired — call when invoice is marked paid)* | Contractor |
| `InspectionCompleted` | *(not wired — call when both signatures captured + status=completed)* | Tenant + agent/landlord — PDF report attached |

Default driver is `MAIL_MAILER=log` so rendered HTML lands in `storage/logs/laravel.log` for dev/test. Swap to `smtp`/`ses`/`mailgun` in `.env` for production.

The default Laravel notification template is themed via `resources/views/vendor/mail/` (purple action buttons, "🏡 Property Basket" header pill, brand from-name).

To attach a PDF to a `MailMessage`:
```php
$pdfBinary = app(PdfService::class)->rentReceipt($payment, download: true)->getContent();
$message->attachData($pdfBinary, "filename.pdf", ['mime' => 'application/pdf']);
```

`Notification::route('mail', $email)->notify(new X(...))` sends to an anonymous address (useful for invitations to people without a User row).

In tests, prepend `Notification::fake();` then assert with `Notification::assertSentTo($user, X::class)` or `Notification::assertSentOnDemand(X::class, $closure)`.

---

## PDF Generation

Uses `barryvdh/laravel-dompdf` (pure PHP, no external binaries). The shared `App\Services\PdfService` exposes four methods, each loads a Blade template from `resources/views/pdfs/` wrapped in the `<x-pdf-layout>` anonymous component (`resources/views/components/pdf-layout.blade.php`).

| Method | Template | Endpoint |
|--------|----------|----------|
| `rentReceipt(RentPayment)` | `pdfs.rent-receipt` | `GET /tenant/payments/{payment}/receipt.pdf` |
| `maintenanceInvoice(MaintenanceInvoice)` | `pdfs.maintenance-invoice` | `GET /contractor/invoices/{invoice}/pdf` |
| `leaseAgreement(Lease)` | `pdfs.lease-agreement` | `GET /tenant/lease/agreement.pdf` |
| `inspectionReport(Inspection)` | `pdfs.inspection-report` | `GET /agent/inspections/{inspection}/pdf` |

All return `application/pdf` inline. Append `?download=1` to force a download.

Per-role guards in each controller: tenant only sees own lease/payments; contractor only sees own invoices; agent only sees inspections for their agency.

The shared layout sets A4 + 28mm margins, a header with the Property Basket brand line + doc metadata, a footer with page numbers + generation timestamp + POPIA notice. Uses `DejaVu Sans` (built into dompdf, supports Unicode/R rand symbol).

To add a new PDF: write `views/pdfs/x.blade.php` using `<x-pdf-layout :title="..." :docMeta="...">...</x-pdf-layout>`, add a method to `PdfService`, expose a controller endpoint, wire the UI link.

> **DB portability heads-up:** ORDER BY in controllers must avoid MySQL's `FIELD()` because the test suite runs on SQLite. Use `CASE WHEN ... THEN 1 WHEN ... THEN 2 ELSE 99 END` instead. Several controllers were patched during the PDF work; remaining `FIELD()` calls should be migrated when touched.

---

## Error Handling

Three layers — all are always-on once mounted.

1. **`<ErrorBoundary variant="global">`** wraps the root `<App />` in `app.tsx`. Any uncaught React error in any page renders a clean "Something went wrong" page with **Reload** and **Go home** buttons. Stack trace logs to console.

2. **`<NetworkErrorToast />`** mounts once near the root. Listens to `router.on('error')` (network failures), `router.on('exception')` (5xx responses), and `router.on('invalid')` (rejected requests). Pops a dismissable bottom-right toast. Auto-dismisses after 6 seconds. Validation errors are explicitly ignored (forms already render those inline).

3. **`<ErrorBoundary variant="section" label="...">`** — drop around risky widgets inside a page so a broken chart/table doesn't take down the whole dashboard. Renders a compact red card with a "Try again" button:

```tsx
import ErrorBoundary from '@/Components/ErrorBoundary';

<ErrorBoundary variant="section" label="earnings chart">
    <Chart data={trend} />
</ErrorBoundary>
```

Currently applied to: Admin Overview growth chart, Contractor Finance earnings chart. Extend to any other widget when needed — particularly charts and anything that crunches dynamic data shapes.

## Loading States

Three layers, in order of "always available" → "where you need it":

1. **Inertia progress bar** — top-of-page purple bar appears automatically during any navigation. Configured in `app.tsx`. Nothing to opt into.

2. **`useInertiaLoading()` hook** — returns `true` while a navigation/partial-reload is in flight. Wrap any container in `opacity-50 pointer-events-none transition-opacity` while loading is true. Used on filter-driven pages (Transactions, Users, Quotes, Invoices).

3. **`<Spinner />` component** (from `@/Components/Skeleton`) — small inline spinner for button-internal loading. Pair with a local `useState` for the action's in-flight flag. Used on Messages Send, Commission Approve, Run Payout.

For initial-render skeletons (rarely needed since Inertia ships data with the page), use `<Skeleton.KpiCard />`, `<Skeleton.ListItem />`, `<Skeleton.TableRows columns={5} rows={6} />`, etc.

```tsx
// Typical filter-page pattern
import { useInertiaLoading } from '@/Hooks/useInertiaLoading';

const loading = useInertiaLoading();
<div className={loading ? 'opacity-50 pointer-events-none transition-opacity' : ''}>
    <table>...</table>
</div>
```

```tsx
// Typical action-button pattern
import { Spinner } from '@/Components/Skeleton';

const [sending, setSending] = useState(false);

function send() {
    setSending(true);
    router.post(url, data, { onFinish: () => setSending(false) });
}

<button disabled={sending} className="... min-w-[88px] justify-center">
    {sending ? <><Spinner size={14} />Sending…</> : <>Send</>}
</button>
```

## Mobile Layout Pattern

All 7 dashboard layouts (`Admin/Agency/Agent/Contractor/Landlord/Tenant/Public`) use the same responsive pattern:

- **Sidebar** — `fixed lg:static` slide-in drawer below 1024px, controlled by `useState(navOpen)` + tap-backdrop dismiss
- **Header** — hamburger button (`lg:hidden`) toggles drawer
- **Search bar** — hidden below `md:` (768px)
- **Breadcrumb** — section label hides below `sm:` (640px), only crumb shows
- **Spacer div** — `flex-1 md:hidden` pushes notifications icon to the right when search is hidden

When adding a new dashboard layout, copy this pattern from `AdminLayout.tsx` (lines 123-203).

## Feature Test Suite

42 feature tests in `tests/Feature/` covering auth, inquiry allocation, commission calc. Uses SQLite `:memory:` so it's safe to run any time:

```bash
./vendor/bin/phpunit tests/Feature/             # all 42
./vendor/bin/phpunit tests/Feature/AuthTest.php # 19 auth tests
./vendor/bin/phpunit --testdox                  # human-readable list
```

`RolesAndPermissionsSeeder` is auto-run in each test's `setUp()` so Spatie role assignments work.

## Common Commands

```bash
# Start dev
npm run dev

# Build (check for TS errors)
npm run build

# Fresh seed (wipes DB)
php artisan migrate:fresh --seed

# Re-run a single seeder
php artisan db:seed --class=Phase4DemoSeeder

# Check routes
php artisan route:list --path=agent
php artisan route:list --path=agency

# Tinker
php artisan tinker
```

---

## Production Deployment

The full deployment runbook lives in `DEPLOYMENT.md` (root of repo). It covers three paths in increasing manual-ops order: **Laravel Forge**, **Ploi**, and **manual Ubuntu 24.04 VPS**. Includes Nginx config, Supervisor queue worker setup, Certbot SSL, backups, rollback, and a post-deploy verification checklist.

Production config template: `.env.production.example` — copy to `.env` on the server, fill in real values. Key prod differences from dev:
- `APP_ENV=production`, `APP_DEBUG=false`, force HTTPS
- `CACHE_STORE`, `SESSION_DRIVER`, `QUEUE_CONNECTION` all `redis`
- `FILESYSTEM_DISK=s3`
- `MAIL_MAILER=resend` (or `smtp`/`ses`/`mailgun`)
- `PAYSTACK_STUB=false` + real keys
- Hardened session cookies (`SESSION_ENCRYPT=true`, `SESSION_SECURE_COOKIE=true`)

Zero-downtime deploys: `deploy.sh` in the repo root. Pulls latest, installs deps, builds assets, migrates, re-caches, restarts queue + FPM. Use on manual-VPS hosts. Forge/Ploi users paste the inner commands into their host's deploy-script panel.

PDF-attaching notifications (`RentPaymentReceived`, `InspectionCompleted`) `implements ShouldQueue` so they don't block HTTP requests — requires a queue worker running in production. See DEPLOYMENT.md §4.7 for Supervisor config.

## FFC / EAAB Compliance Gating (two layers)

South African real-estate agents need a valid PPRA "Fidelity Fund Certificate" (FFC). The platform enforces it server-side with middleware aliases registered in `bootstrap/app.php`.

| Middleware | Alias | Blocks |
|---|---|---|
| `EnsureValidFfc` | `ffc` | All write routes under `/agent` when the logged-in agent's `agency_agents.ffc_certificate_path` is missing or `ffc_expires_at` has passed. |
| `EnsureValidAgencyFfc` | `agency_ffc` | Listing-create / publish / Invite-Tenant routes under `/agent` AND `/agency` when the agency's FFC is missing/expired. |

Both middlewares return a 422 redirect-back with a flash error when they trip, so direct POSTs are also rejected.

`HandleInertiaRequests` shares `ffc` and `agency_ffc` objects to every page (`{ valid, expires_at, days_remaining }`) so layouts can show a top-of-page warning banner. See `AgentLayout.tsx` + `AgencyLayout.tsx`.

`SendFfcReminders` console command (`php artisan ffc:remind`, scheduled daily 08:00) sends `FfcExpiring` + `AgencyFfcExpiring` 30 days before expiry. Idempotent via `*_reminder_sent_at` columns so it can run multiple times.

Files: `app/Http/Middleware/EnsureValidFfc.php`, `EnsureValidAgencyFfc.php`, `app/Http/Controllers/Agent/FfcController.php`, `Agency/EaabController.php`, `app/Console/Commands/SendFfcReminders.php`, `app/Notifications/FfcExpiring.php`, `AgencyFfcExpiring.php`.

---

## Contractor Quote-First Workflow

Contractors cannot schedule a job until the agency has approved their quote.

1. Contractor sees job on `/contractor/requests` (assigned or marketplace). Stage chip shows `marketplace` → `needs_quote` → `awaiting_approval` → `quote_accepted` (or `quote_rejected`).
2. **View & quote** → `<RequestDetailsModal>` opens with photo lightbox + embedded line-item quote form.
3. Quote POSTed → status flips to `awaiting_approval`.
4. Agency reviews on `/agency/maintenance/quotes`. Accept rejects competing quotes on the same job. Reject leaves the job re-quotable.
5. Once accepted, the contractor sees **View & schedule**. Server enforces this via 422 in `Contractor\RequestsController::accept` when no accepted quote exists.
6. After completing the job, contractor opens `<NewInvoiceModal>` from `/contractor/invoices`. Picking a quoted job **locks** the quoted lines and exposes a separate "+ Add deviation" section for adjustments.

Server normalisation: `Contractor\InvoicesController::normaliseQuoteLines()` translates older seed shape (`desc`/`unit`) → modern (`label`/`unit_price`) and scales line totals when raw math drifts from the recorded subtotal.

Key files:
- Controllers: `Contractor/QuotesController.php`, `Contractor/InvoicesController.php`, `Contractor/RequestsController.php`, `Agency/QuotesController.php`.
- Pages: `Contractor/Requests.tsx`, `Contractor/Quotes.tsx`, `Contractor/Invoices.tsx`, `Agency/MaintenanceQuotes.tsx`.
- Components: `RequestDetailsModal.tsx`, `NewQuoteModal.tsx`, `NewInvoiceModal.tsx`.

---

## DB-Driven Platform Plans

`platform_plans` table is the single source of truth for subscription pricing.

- Admin edits inline on `/admin/subscriptions` via `<PlanEditor>` → `Admin\SubscriptionsController::update($key)`.
- Agencies see the same numbers on `/agency/billing` (controller: `Agency\BillingController`).
- `App\Support\PlatformPlans` reads from DB with the hard-coded PHP constants as fallback if the table is empty.
- `App\Models\PlatformPlan` is a normal Eloquent model.

---

## Shared NotificationBell

`resources/js/Components/NotificationBell.tsx` is the single source. Mounted by `AgentLayout`, `AgencyLayout`, `LandlordLayout` (extend to Tenant/Contractor/Admin when needed).

- Reads `notifications` shared prop (formatted via `HandleInertiaRequests::formatNotification()`).
- Red dot only when `unread_count > 0`.
- Click → dropdown lists unread first. Each item POSTs to `NotificationsController::markRead`; "Mark all as read" POSTs to `markAllRead`.
- Shared prop shape: `notifications: { items: [...], unread_count: N }`.

---

## Trust Account, Banking, Debit Orders

- **Agency trust account** — `agencies` table has `trust_account_holder`, `trust_account_type`, `trust_account_auditor`, `trust_practice_number`, `trust_account_verified_at`. Set via `/agency/trust-account`. Required by Section 54 PPA.
- **Landlord banking** — `landlords` table extended with bank fields. `Landlord::hasBankingDetails()` gates downstream payout flows.
- **Tenant debit orders** — `debit_orders` table (mandate + status). `<DebitOrderModal>` posts to `Tenant\DebitOrderController`.
- **Agency private contractors** — `contractors.created_by_agency_id` lets an agency keep a private roster, filtered against the marketplace on `/agency/contractors`.

---

## Inertia Shared Props

Set in `app/Http/Middleware/HandleInertiaRequests.php` — available to every page:

| Prop | Shape | Use |
|---|---|---|
| `auth.user` | user record + roles | identity |
| `ffc` | `{ valid, expires_at, days_remaining }` or null | agent FFC banner |
| `agency_ffc` | same shape | agency FFC banner |
| `notifications` | `{ items: NotificationItem[], unread_count: number }` | `<NotificationBell>` |
| `unread_messages` | int | sidebar badge |
| `flash` | `{ success, error }` | toast/banner |

---

## Demo Data Wrinkle

Some demo users land at `status=pending` after `migrate:fresh --seed` (Lerato the landlord, some tenants). They cannot log in until reactivated. Fix in tinker:

```php
\App\Models\User::where('email', 'lerato@example.test')->update([
    'status' => 'active',
    'password' => bcrypt('password'),
]);
```

TODO: fold this into `DemoDataSeeder` so a fresh seed lands every demo account at `active`.

---

## Mockup Reference

All UI mockups are in `_mockups/` at the project root:
- `property-basket-agent-dashboard.html` — Phase 4 reference
- Additional mockups for future phases will be added here

Always open the relevant mockup HTML file before building a new phase.
