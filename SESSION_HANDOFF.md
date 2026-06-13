# Session Handoff — Property Basket

**Last updated:** 2026-06-14
**Status:** Phases 1-9 complete. Since the May handoff the platform gained a full **commission & payout system**, **maintenance boards with contractor allocation + ratings**, **tenant lease sign-off**, and several **public-site additions** (mortgage calculator, schedule-a-tour). Latest session locked down **commission permissions (agency-only)** and added a **move-in-inspection gate** on rental commissions (§0.0, shipped to live). A batch of public-facing work (legal pages, demo-request form, calculator route, admin overview PDF) is still **in progress in the working tree — uncommitted**. See §0.

---

## 0. Work since the May handoff (2026-05-29 → 2026-06-14)

### 0. Commission permissions + move-in-inspection gate ✅ (2026-06-14 — live)

Shipped to `manage.propertybasket.co.za` via `deploy-hostinger.sh` (backend-only; commits `5ebd56e` + `7a3939c` on `main`).

- **Commission money-actions are agency-admin only.** `/agency/*` is `auth`-only and `ResolvesAgency` resolves an agency for *linked agents* too, so an agent could POST directly to the payout / approve / pay-invoice / rate-edit endpoints. Added `CommissionController::authorizeAgencyAdmin()` (allows `agency_admin` / `super_admin`) on all four. Verified: agent → 403, agency admin → 200.
- **Rental commission held until move-in inspection.** A rental `Commission` with a `lease_id` is held (`status=blocked`, `blocked_reason=awaiting_move_in_inspection`) until a **completed `move_in` `Inspection`** exists for that lease. `CommissionService::blockIfNonCompliant()` enforces the gate (via `hasCompletedMoveInInspection()`); `Agent\InspectionsController::store()` re-evaluates and releases the commission to `pending` when the move-in inspection is saved. Sales and lease-less pipeline rentals are unaffected; **no migration** (reuses the `blocked` status + reason string). Existing pending/approved rows are not retroactively held.
- **UI:** `Agency/Commission.tsx` renders the hold as an amber "awaiting move-in inspection" note (not a red compliance error). *Frontend not yet rebuilt for live — the current live bundle shows the reason in red; amber ships on the next frontend build.*

### A. Commission & payout system ✅ (the major new thread)

End-to-end agent-commission generation and an agency payout queue.

- **`App\Services\CommissionService`** now has three trigger paths, all idempotent:
  - `recordForLead(Inquiry $lead)` — **the authoritative trigger.** Fires when an agency moves a pipeline lead into the new **`registered`** status. Derives deal type (`sale` if listing is `for_sale`, else `rental`) and value (sale price, or 12× monthly rent) from the listing. Idempotent per `(listing, agent, deal_type)`.
  - `recordRental(Lease, $agent)` — rental commission when a property is rented out; idempotent per lease.
  - `recordSale(Listing, $agent)` — sale commission; idempotent per listing.
- **Per-agency commission rates** — migration `2026_06_12_000001_add_commission_rates_to_agencies` adds `sale_commission_percent` (default 6.00) + `rental_commission_percent` (default 7.50) on `agencies`. `CommissionService` reads these (falling back to 6%/7.5%). Agent's cut comes from `agency_agents.commission_split_percent`; VAT applied when `agency.vat_registered`.
- **`registered` pipeline stage** — migration `2026_06_13_000001_add_registered_to_inquiries_status`. **Agency-only** stage (set from `Agency\PipelineController`, not the agent kanban) that triggers the agent's commission. Surfaced in `Agency/Pipeline.tsx`; `Agent/Pipeline.tsx` shows it read-only.
- **`blockIfNonCompliant()`** — a commission is marked `blocked` if the agent has **no payout method** (`User::hasPayoutDetails()` — true on EITHER a Paystack recipient code OR local banking details) or an **expired FFC**. Capturing banking details later auto-lifts a stale block back to `pending`.
- **Agency payout queue** (`Agency/Commission.tsx` + `Agency\CommissionController`) — now also lists **contractor invoices** alongside agent commissions, each with a **Pay** action. Payout labels clarified.
- **Contractor payment modal** — pay a contractor invoice from the queue.

### B. Maintenance boards + contractor allocation + ratings ✅

- **`Components/MaintenanceBoard.tsx`** — shared board used by agency + agent maintenance pages.
- **`Agency\MaintenanceController`** allocates a request to a contractor; **`MaintenanceJobAssigned`** notification fires to the contractor.
- **`Agent\MaintenanceController`** — agent view is **read-only** (agency owns allocation).
- **`Components/RateContractorModal.tsx`** — tenant **and** agency can rate a contractor after a completed job.
- **Tenant maintenance** — photo upload on request submission; responsive notification bell in `TenantLayout`.

### C. Tenant lease sign-off + per-room inspections ✅

- **Tenant lease sign-off** — migration `2026_06_11_000001_add_tenant_signature_to_leases`; tenant signs from `Tenant/Documents.tsx`; **`LeaseSigned`** notification.
- **Per-room inspection photos** — `Agent/CreateInspection.tsx` + `ShowInspection.tsx` now capture/show photos room-by-room.

### D. Public-site additions ✅

- **Mortgage calculator** on for-sale listing pages.
- **Schedule-a-tour** form on public listing pages (deploy script extended to carry the tour-request files + `route:clear`).
- Listing amenities display fix + agent avatar on public listing pages.

### E. Invitations / email ✅

- Agency adding a contractor now **emails an account invitation** (`UserInvited` reused from `Agency\ContractorsController`).
- Email templates redesigned (black header, pill button, centered layout).
- Fixed: agent-invitation 403 + re-invite after admin delete; 500 when inviting a tenant whose email belongs to a soft-deleted user.

### F. Deploy / infra ✅

- **`deploy-hostinger.sh`** — rsync-style sync for no-git shared-hosting (Hostinger) deploys.
- `platform_settings` table (migration `2026_05_30_000001`); recent migrations made **idempotent** (guard on `Schema::hasColumn`) so they're safe to re-run against the live DB.

### G. ⚠ In progress — uncommitted in the working tree

A public-facing / admin batch is staged but **not yet committed** (see `git status`):

- **Public:** `Public/CalculatorController` + `Pages/Public/Calculator.tsx` (standalone calculator route); `Public/DemoRequestController` + `DemoRequested` notification (request-a-demo form); `Public/LegalController` + `Pages/Public/Legal/` (legal/POPIA pages) + `PrivacyRequestSubmitted` notification; `PublicLayout` + `Home.tsx` updates.
- **Admin:** edits across most `Admin\*Controllers` + pages; new `Models/PlatformSetting`; `Settings`/`System` wiring; **admin overview PDF** (`resources/views/pdfs/admin-overview-report.blade.php` + `PdfService` method).
- **Error pages:** `public/error/` + `resources/views/errors/` custom error views.
- `DatabaseSeeder` changes; `public/.htaccess` + `app.blade.php` tweaks.

**Next session: review, test, and commit this batch** (it spans public + admin + error handling). Nothing here is known-broken, but it's unreviewed and unbuilt.

---

## Earlier work (May 2026 handoff — retained for reference)

### What that session shipped (most-recent work first)

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

All 9 planned phases shipped, plus the commission/payout, maintenance-board, and lease-sign-off systems above. Real Paystack integration in dual mode (stub/live).

**One open item:** the public/admin batch in §0.G is uncommitted — review, build, and commit it next.

---

## Open follow-ups — see TODO.md

Top items:
- **Commit the §0.G working-tree batch** (public calculator/demo/legal + admin PDF + error pages). Run `npm run build` and the feature suite first.
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
