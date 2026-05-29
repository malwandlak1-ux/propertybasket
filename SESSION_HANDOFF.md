# Session Handoff — Property Basket

**Last updated:** 2026-05-26
**Status:** Phases 1-9 + two follow-on sessions complete. All sidebar stubs across the agent, agency, landlord, tenant and contractor dashboards are now wired to real flows. No in-flight bugs.

---

## What this session shipped (most-recent work first)

### A. Contractor quote-first workflow + agency approval ✅

**The big new flow.** A contractor can no longer just "Accept & Schedule" a job — they must quote first, the agency must approve the quote, only then can the contractor schedule.

- `resources/js/Components/RequestDetailsModal.tsx` — full job viewer: description, photo gallery with click-to-lightbox, property + tenant info, stage badge, contextual action.
- `resources/js/Pages/Contractor/Requests.tsx` — fully rewritten. Cards now show a stage chip (`Marketplace` / `Needs quote` / `Awaiting approval` / `Quote accepted` / `Quote rejected`) and one contextual button per stage that opens the modal.
- `Contractor\RequestsController::accept()` is now two-pronged:
  - **Marketplace claim** → self-assign, status stays `open`.
  - **Schedule** (already assigned) → **aborts 422 unless an `accepted` quote exists** from this contractor on this job. The gate works even when the UI is bypassed.
- New `Agency\QuotesController` with `accept` / `reject` endpoints on `/agency/maintenance/quotes`. Accepting a quote auto-rejects competing `sent`/`draft` quotes on the same job so the workflow stays clean.
- New `Agency/MaintenanceQuotes.tsx` page with **Awaiting approval** / **Recently decided** sections.

### B. Contractor: New Quote & New Invoice modals ✅

- `NewQuoteModal.tsx` — opens from the Quotes page button. Job picker (disables already-quoted jobs), repeatable line items, live VAT + total, draft / send.
- `NewInvoiceModal.tsx` — the smart one. Two modes:
  - **Quoted job picked** → quote's line items render in a purple **"Quoted on QT-…"** card as a locked baseline. A separate **Deviation items** section lets the contractor add extras. Live totals show Quoted / Deviations / Subtotal / VAT / Total + a coloured comparison row ("Over quote +R X (+N%)").
  - **Un-quoted job** → free-form line items.
  - **Deviation note is required** when the total differs from the quote — gate enforced both client-side (button disabled) and server-side (returns a validation error).
- `Contractor\InvoicesController::normaliseQuoteLines()` — translates legacy seed-data keys (`desc`/`unit`) into the canonical `{ label, qty, unit_price, line_total }` shape and scales values when raw line math drifts from the recorded quote subtotal.

### C. FFC compliance, end-to-end (agent + agency) ✅

Two parallel FFC enforcement chains — both block writes when the certificate is missing / expired, and both fire 30-day reminder emails.

- **Agent FFC** — `agency_agents.ffc_number / ffc_expires_at / ffc_certificate_path / ffc_reminder_sent_at`. `Agent\FfcController` (`/agent/ffc`), `EnsureValidFfc` middleware gates **all** agent writes. Notification `FfcExpiring`, console command `ffc:remind`, scheduled daily 08:00.
- **Agency FFC** — `agencies.eaab_ffc_expires_at / eaab_ffc_certificate_path / eaab_reminder_sent_at`. `Agency\EaabController` (`/agency/compliance`), `EnsureValidAgencyFfc` middleware applied **only to listing-write routes** on both `/agent` and `/agency` (the agency-level certificate blocks listing creation across the whole agency regardless of which agent is acting).
- Both certificates uploaded to the **`local` disk** (`storage/app/private/ffc/…`), streamed back via authenticated routes.
- Both states share via Inertia (`ffc` + `agency_ffc`) and drive global banners in `AgentLayout` + `AgencyLayout`.

### D. Sidebar wiring across all dashboards ✅

Every sidebar item that was previously a stub now points at a real page:

- Agent: `Tenants`, `FFC & Compliance`, `Settings`.
- Agency: `Tenants`, `Contractors`, `Trust Account`, `EAAB & Compliance`, `Billing & Plan`.
- Landlord: `Settings`.
- Tenant: `Settings`.

### E. Notifications bell (shared) ✅

`resources/js/Components/NotificationBell.tsx` is a single component that reads the `notifications: { unread_count, recent }` shared Inertia prop. Wired into **AgentLayout, AgencyLayout, LandlordLayout** — all three previously had a hardcoded permanent red dot. Click → dropdown lists 10 most-recent notifications with mark-all-read; clicking a row marks it read and navigates to the deep link.

Endpoints: `POST /notifications/{id}/read`, `POST /notifications/read-all`.

`HandleInertiaRequests::formatNotification()` maps each notification class to a friendly `{ title, body, href, tone }` — currently knows `FfcExpiring`, `AgencyFfcExpiring`, `InquiryReceived`, `UserInvited`, `CommissionApproved`, `CommissionPaid`.

### F. Agency dashboard pages built out ✅

- `Agency/Tenants.tsx` — Active / Archived tabs across all leases at the agency, with the **Listed-by-agent** column for remarketing handoff.
- `Agency/Contractors.tsx` — **Marketplace** vs **My Contractors** tabs; new `AddContractorModal` creates a private contractor tied to the agency via `contractors.created_by_agency_id`.
- `Agency/TrustAccount.tsx` — bank account holder/type/account/branch + IRBA auditor name + practice number. Changing the bank fields invalidates platform verification.
- `Agency/Settings.tsx` — added a **logo upload** to the General tab (multipart POST with `_method=patch`).
- `Agency/Billing.tsx` — picks the agency-audience plans from the new `platform_plans` table. Switch-plan POST. Plans driven by the DB now, edited by super-admins on `/admin/subscriptions` (each card has an inline editor for name/price/headline/features/popular).

### G. Agent dashboard fills ✅

- `Agent/Viewings.tsx` — fully working Day / Week / Month calendar with Prev / Today / Next nav. `ScheduleViewingModal` creates a new viewing inquiry. Routes: `GET /agent/viewings`, `POST /agent/viewings`.
- `Agent/Listings.tsx` — primary image renders on each card; cards link to a new `Agent/EditListing.tsx` page that reuses `ListingForm` in edit mode. **Invite Tenant** button + per-card actions. **Reactivate listing** action on leased listings. The whole listing flow is now create / edit / invite-tenant / reactivate.
  - Side-fix: latent bug in `Agent\ListingsController::store` where the placeholder `units` row caused silent validation failures. Added a `transform()` in `ListingForm` to strip empty units; added a top-level error banner.
  - Inquiries source enum migrated to include `agent_manual` (was silently truncating).
- `Agent/Inspections.tsx` — `Agent/CreateInspection.tsx` + `Agent/ShowInspection.tsx`. Inspections become read-only on save (no update endpoint). Listing primary image renders on the cards.
- `Agent/Tenants.tsx` — Active / Archived tenants page with search filter and Remarketing-pool banner on the archived tab.
- `Agent/FfcCompliance.tsx` — see §C above.
- Settings page is shared via the standard Inertia layout pattern.

### H. Landlord dashboard fills ✅

- `Landlord/Settings.tsx` — Profile + Banking tabs. Banking lives on `landlords.bank_name / bank_account_holder / bank_account_number / bank_branch_code / bank_account_type / bank_verified_at`. Same "change resets verification" pattern as agency trust account.
- `Landlord/Properties.tsx` + `Overview.tsx` — property cards now render the listing's `primary_image`.
- `LandlordInviteTenantModal` — landlord can either (a) **resend the portal invite** to a tenant on an existing active lease whose user hasn't accepted yet, or (b) **invite a new tenant** to an available rental. The Invite Tenant button is enabled when either is possible. New endpoint: `POST /landlord/leases/{lease}/resend-invite`.

### I. Tenant dashboard fills ✅

- `Tenant/Settings.tsx` — Contact details + Password tabs.
- `DebitOrderModal` — captures bank name / holder / account / branch / type + debit day 1-28. Creating a new mandate auto-cancels any active one. New table `debit_orders`. Overview button label flips to **"Manage debit order"** with an **ACTIVE** chip once a mandate exists.
- **Pay Rent** header button on the Payments page is now wired — picks the most urgent unpaid period (overdue first, then soonest), bumps to red `bg-danger` styling when overdue, fires the existing Paystack flow.

### J. Admin: editable plans ✅

- `platform_plans` table seeded from the existing `PlatformPlans::defaults()` constants.
- `PlatformPlan` model.
- `PlatformPlans::all()` reads from the DB (with the constants as fallback).
- `Admin\SubscriptionsController::update($key)` — admin can edit price / name / headline / features / popular flag inline on `/admin/subscriptions`. Changes propagate to every agency's Billing tab on next load.

---

## Files added or rewritten this session

### Backend (controllers)

- New: `Agent\FfcController`, `Agency\EaabController`, `Agency\TrustAccountController`, `Agency\ContractorsController`, `Agency\TenantsController`, `Agency\BillingController`, `Agency\QuotesController`, `Landlord\SettingsController`, `Tenant\SettingsController`, `Tenant\DebitOrderController`, `NotificationsController` (top-level).
- Rewritten: `Agent\ListingsController` (added edit/update/inviteTenant/reactivate), `Agent\ViewingsController` (day/week/month + store), `Agent\InspectionsController` (create/store/show), `Agent\TenantsController`, `Contractor\QuotesController` (added store + quotableJobs), `Contractor\InvoicesController` (added store + invoiceableJobs + normaliseQuoteLines), `Contractor\RequestsController` (stage detection + gated accept), `Landlord\TenantsController` (invite + resend), `Landlord\DashboardController` + `PropertiesController` (primary_image), `Admin\SubscriptionsController` (added update), `Agency\SettingsController` (logo upload), `Auth\InvitationController` (handles pre-existing users).

### Backend (middleware, models, services)

- New middleware: `EnsureValidFfc`, `EnsureValidAgencyFfc`. Aliases `ffc` and `agency_ffc` in `bootstrap/app.php`.
- New models: `DebitOrder`, `PlatformPlan`.
- Existing models updated: `AgencyAgent` (+ `hasValidFfc()`), `Agency` (+ `hasValidFfc()` + trust + FFC + banking + EAAB columns), `Landlord` (+ `hasBankingDetails()` + bank columns), `Contractor` (+ `created_by_agency_id`).
- `HandleInertiaRequests` now shares `ffc`, `agency_ffc`, `notifications`, `unread_messages`.
- `App\Console\Commands\SendFfcReminders` (`ffc:remind`) — daily at 08:00, idempotent via `*_reminder_sent_at` columns. Handles both agent + agency FFCs.
- New notifications: `FfcExpiring`, `AgencyFfcExpiring`.

### Backend (migrations)

| Date | Purpose |
|------|---------|
| `2026_05_24_000001_extend_inquiries_source_enum` | Adds `agent_manual` to `inquiries.source` enum |
| `2026_05_24_000002_add_ffc_certificate_to_agency_agents` | Adds `ffc_certificate_path` + `ffc_reminder_sent_at` |
| `2026_05_25_000001_add_created_by_agency_id_to_contractors` | FK on contractors → agencies (for private lists) |
| `2026_05_25_000002_extend_agencies_trust_account` | Adds holder / account_type / auditor / practice_number / verified_at |
| `2026_05_25_000003_add_ffc_certificate_to_agencies` | Adds agency-level FFC expiry + path + reminder |
| `2026_05_25_000004_create_platform_plans_table` | DB-driven plans |
| `2026_05_25_000005_add_banking_to_landlords` | bank_name / holder / account / branch / type / verified_at + paystack_recipient_code |
| `2026_05_25_000006_create_debit_orders_table` | Tenant debit-order mandates |

### Frontend (new components)

- `Components/NotificationBell.tsx` (shared across 3 layouts)
- `Components/InviteTenantModal.tsx` (with `submitUrlBase` for agent / landlord reuse)
- `Components/LandlordInviteTenantModal.tsx` (wraps the above + adds resend-pending mode)
- `Components/AddContractorModal.tsx`
- `Components/ScheduleViewingModal.tsx`
- `Components/DebitOrderModal.tsx`
- `Components/NewQuoteModal.tsx`
- `Components/NewInvoiceModal.tsx` (locked-quote + explicit deviation items)
- `Components/RequestDetailsModal.tsx` (contractor job detail viewer + embedded quote form)

### Frontend (new pages)

- `Pages/Agent/EditListing.tsx`, `Pages/Agent/CreateInspection.tsx`, `Pages/Agent/ShowInspection.tsx`, `Pages/Agent/Tenants.tsx`, `Pages/Agent/FfcCompliance.tsx`
- `Pages/Agency/Tenants.tsx`, `Pages/Agency/Contractors.tsx`, `Pages/Agency/TrustAccount.tsx`, `Pages/Agency/Compliance.tsx`, `Pages/Agency/Billing.tsx`, `Pages/Agency/MaintenanceQuotes.tsx`
- `Pages/Landlord/Settings.tsx`
- `Pages/Tenant/Settings.tsx`

---

## Project status

All 9 planned phases shipped. Real Paystack integration in dual mode (stub/live).

**No known bugs.** Compliance gates (agent FFC + agency FFC) and the contractor quote-first workflow have been verified end-to-end including direct-POST bypass attempts.

---

## Open follow-ups — see TODO.md

Top items:
- Wire `MaintenanceInvoicePaid` notification trigger (class exists, no caller).
- Wire `InspectionCompleted` notification trigger (class exists, no caller).
- Remaining MySQL `FIELD()` ORDER BYs need migration to `CASE WHEN` for SQLite tests (`rg "orderByRaw\(.*FIELD" app/`).
- Mobile polish across new pages (some grids assume desktop widths).

---

## Demo accounts (password: `password`)

| Role          | Email                              | Notes                                                  |
|---------------|------------------------------------|--------------------------------------------------------|
| super_admin   | admin@propertybasket.local         | Full platform access                                   |
| agency_admin  | owner@sandton-realty.test          | Sandton Realty — has FFC, trust account, contractors   |
| agent         | sipho@sandton-realty.test          | Best for pipeline + listings + viewings testing        |
| landlord      | lerato@example.test                | Has a Soweto rental, banking set up, pending tenant    |
| tenant        | tshepo.khumalo@example.test        | Has an active lease, debit order, paid rent            |
| contractor    | themba@plumbpro.test               | Has multiple jobs, quotes, invoices in various states  |

⚠ Several demo users were seeded with `status='pending'`. If a login returns 422, run:
```bash
php artisan tinker --execute="App\Models\User::where('email','EMAIL_HERE')->update(['status' => 'active', 'password' => bcrypt('password')]);"
```

---

## Quick commands

```bash
# Day-to-day
php artisan serve            # Laravel on :8000  (XAMPP MySQL must be running)
npm run build                # Builds public/build/ — what Laravel serves when public/hot is absent
npm run dev                  # Vite HMR on :5173 — only when actively editing TSX

# DB
php artisan migrate                              # Apply pending migrations
php artisan migrate:fresh --seed                 # Wipe + reseed everything
php artisan db:seed --class=PlatformPlansSeeder  # Seed only one

# FFC reminder cron (daily 08:00 via schedule:work, but you can fire manually)
php artisan ffc:remind

# Tests
./vendor/bin/phpunit tests/Feature/
```
