# Property Basket — TODO

Priority order. Top = do next. Phases 1–9 + post-phase enhancements are complete.

---

## 🟢 Recently shipped (May 2026 session)

### Contractor workflow
- [x] **Quote-first job workflow** — contractor must submit a quote before scheduling. Agency approves/rejects via `/agency/maintenance/quotes`. Server-side guard returns 422 if a job is scheduled without an accepted quote.
- [x] **`<RequestDetailsModal>`** — full job viewer with photo lightbox + embedded quote form + stage-aware CTA (View & claim / quote / schedule / re-quote).
- [x] **`<NewQuoteModal>`** — populated from accepted jobs, VAT-aware totals.
- [x] **`<NewInvoiceModal>`** — locks the originally quoted line items, separate "+ Add deviation" section.
- [x] **Server-side line normalisation** — `InvoicesController::normaliseQuoteLines()` translates `desc`/`unit` seed shape → `label`/`unit_price`, scales to recorded subtotal when math drifts.

### FFC / compliance gating (two layers)
- [x] **Agent FFC** — `EnsureValidFfc` middleware blocks all `/agent` writes when missing/expired; banner in `AgentLayout`.
- [x] **Agency FFC** — `EnsureValidAgencyFfc` middleware blocks listing-write routes on `/agent` and `/agency`; banner in `AgencyLayout`.
- [x] **Daily reminder cron** — `ffc:remind` (08:00) sends `FfcExpiring` + `AgencyFfcExpiring` 30 days before expiry, idempotent via `*_reminder_sent_at` columns.

### Cross-dashboard shared UX
- [x] **Shared `<NotificationBell>`** — single component used by Agent/Agency/Landlord layouts. Red dot only when unread > 0. `notifications` + `unread_messages` exposed via `HandleInertiaRequests`.
- [x] **Shared `<InviteTenantModal>`** (with `submitUrlBase` prop) — reused by Agent + Landlord.

### Agency surface
- [x] Tenants tab (with listing-agent column) · Contractors (private + marketplace filter) · Trust Account setup · EAAB/Compliance · Billing & Plan (reads `PlatformPlan` DB table) · Settings (logo/email/tel/address) · Maintenance quote review.

### Agent surface
- [x] Listings primary image + Edit + Invite Tenant (soft-delete listing) + Reactivate.
- [x] Inspections create/show (immutable on save) + property primary image on cards.
- [x] Tenants tab (active/archived split for remarketing).
- [x] FFC & Compliance page.
- [x] Viewings: Day/Week/Month views + Schedule modal wired.
- [x] Settings tab.

### Landlord surface
- [x] Invite Tenant modal (enabled when active lease OR pending invites; two-mode: resend / new).
- [x] Property cards show primary image.
- [x] Banking details on Settings.
- [x] Notification bell.

### Tenant surface
- [x] Debit order setup (`debit_orders` table + `<DebitOrderModal>`).
- [x] Pay Rent button (wired to Paystack initialize).
- [x] Settings tab (contact details).

### Admin
- [x] **DB-driven `PlatformPlan`** — Admin edits flow through to Agency Billing & Plan.
- [x] Inline `PlanEditor` on `Admin/Subscriptions.tsx`.

### Public
- [x] Listings filter dropdown reduced to **For sale / For rent**.

### Misc
- [x] `inquiries.source` enum extended with `agent_manual` (fixes silent 500 on pipeline lead creation).
- [x] `InvitationController::accept` now handles pre-existing users gracefully.
- [x] Click-after-drag suppression on kanban (`dragEndAtRef` from both `onCardDragEnd` AND `onColumnDrop`).
- [x] All sidebar nav stubs now wired (Tenants, FFC, Settings, Compliance, Contractors, Trust Account, Billing).

---

## 🟡 Open follow-ups (none blocking)

### Bug-prone / cleanup
- [ ] Sweep remaining `FIELD()` SQL calls and migrate to portable `CASE WHEN` ordering.
  ```
  rg "orderByRaw\(.*FIELD" app/
  ```
- [ ] Wire **`MaintenanceInvoicePaid`** — class exists, needs trigger when an invoice is marked paid.
- [ ] Wire **`InspectionCompleted`** — class exists, needs trigger when both signatures are captured + status flips to completed.
- [ ] Seed users with `status=pending` (Lerato, some tenants) need reactivation in tinker before login. Fold this into `DemoDataSeeder` so a fresh seed lands all demo accounts at `active`.

### Pipeline / leads polish
- [ ] Drag-handles or affordance hint on cards.
- [ ] Mobile fallback for kanban — table view by default below `lg`.
- [ ] Lead "next action" follow-up reminders (snooze, due date, last-contacted).
- [ ] If another drop path gets added, remember to call `markDragEnd()` from it.

### Contractor workflow polish
- [ ] After agency rejects a quote, surface the rejection reason on the contractor's Requests card (currently just "Quote rejected" badge).
- [ ] Quote expiry handling — `expires_at` is stored but not enforced anywhere.

### Misc surfaces
- [ ] Inspection page: room-by-room detail view + photo upload UI (currently summary cards only).
- [ ] Mobile polish: KPI grid collapse, table horizontal-scroll wrappers, chat full-screen on mobile.
- [ ] Sidebar badges (e.g. "12 pipeline") still partially hardcoded — wire the rest to real counts in `HandleInertiaRequests`.

### Future-phase wishlist
- [ ] Real-time messaging — Laravel Echo + Pusher / Soketi.
- [ ] Browser push notifications (web-push) for new leads / payments / maintenance updates.
- [ ] Two-factor auth (Fortify).
- [ ] Public REST/GraphQL API for a future mobile app.

---

## ✅ Completed phases — scoreboard

| # | Scope | Status |
|---|-------|--------|
| 1 | Auth, roles, invite flow | ✅ |
| 2 | Public site, listings, inquiries | ✅ |
| 3 | Agency Admin dashboard (9 views) | ✅ |
| 4 | Agent dashboard (8 views) | ✅ |
| 5 | Tenant dashboard (6 views) | ✅ |
| 6 | Landlord dashboard (6 views) | ✅ |
| 7 | Contractor dashboard (7 views) | ✅ |
| 8 | Super Admin dashboard (11 views) | ✅ |
| 9 | Polish, tests, deployment | ✅ |

**65 feature tests · 198 assertions · 0 failures** as of last full run.
