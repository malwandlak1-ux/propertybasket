# Property Basket — Complete Build Guide
## Laravel Architecture Spec + Claude Code Workflow

---

## PART 1: WHAT THIS DOCUMENT IS AND HOW TO USE IT

You have built seven production-quality HTML mockups of the Property Basket
platform. This document contains:

1. The full Laravel architecture spec (database, models, permissions, services)
2. Exactly how to move all of this into Claude Code
3. The prompt to paste into Claude Code to start building
4. What to do at each stage, in order

Read Part 1 once. Then follow Parts 2–5 in sequence.

---

## PART 2: THE LARAVEL ARCHITECTURE SPEC

### 2.1 Technology Stack

```
Backend:      Laravel 11 (PHP 8.3)
Frontend:     Inertia.js + React (or Blade + Livewire — choose one)
Styling:      Tailwind CSS (matches all your mockups exactly)
Auth:         Laravel Breeze / Fortify (with role-gated registration)
Database:     MySQL 8.0 (or PostgreSQL)
Payments:     Paystack PHP SDK
File storage: Laravel Storage + S3 (inspection photos, documents, invoices)
Queue:        Laravel Horizon + Redis (email reminders, notifications, webhooks)
Real-time:    Laravel Echo + Pusher or Soketi (in-app messaging, notifications)
PDF gen:      Spatie/Browsershot or DomPDF (inspection reports, invoices)
```

---

### 2.2 User Roles & Registration Rules

```
Role            Self-registers?   Invited by
─────────────────────────────────────────────
super_admin     No (seeded)       —
agency_admin    YES               —
agent           NO                agency_admin
landlord        YES               —
tenant          NO                agency_admin OR landlord
contractor      YES               Anyone (also discoverable)
```

This maps directly to a `roles` table and Laravel Gates/Policies.

---

### 2.3 Database Schema (all tables)

#### Core auth

```sql
users
  id, name, email, password, phone, avatar,
  role,          -- enum: super_admin|agency_admin|agent|landlord|tenant|contractor
  status,        -- enum: active|pending|suspended
  paystack_recipient_code,   -- for agent/contractor payouts
  paystack_customer_code,    -- for agency/landlord paying
  invited_by,    -- users.id (null for self-registered)
  invite_token, invite_accepted_at,
  last_active_at, email_verified_at,
  timestamps, softDeletes

invitations
  id, email, role, invited_by (users.id),
  invitable_type, invitable_id,   -- agency OR landlord (polymorphic)
  token (uuid), accepted_at, expires_at,
  timestamps
```

#### Agency & agents

```sql
agencies
  id, user_id (owner/admin), name, slug,
  logo, website, email, phone, head_office_address,
  eaab_ffc_number, eaab_verified_at,
  vat_registered (bool), vat_number, vat_rate (default 15.00),
  paystack_subaccount_code,
  trust_bank, trust_account_number, trust_branch_code,
  payout_day (1-28, monthly),
  status (active|pending|suspended),
  subscription_plan, subscription_expires_at,
  timestamps, softDeletes

agency_agents           -- pivot: agents belong to one agency
  id, agency_id, user_id (agent),
  commission_split_percent,  -- agent's %, e.g. 70
  area_speciality (json),    -- ["Sandton", "Rosebank"]
  property_type_speciality (json),
  ffc_number, ffc_expires_at,
  lead_allocation_position,  -- for round-robin
  status (active|pending|suspended),
  timestamps
```

#### Landlords

```sql
landlords
  id, user_id,
  id_number,           -- FICA verification
  fica_verified_at,
  paystack_customer_code,
  property_count (max 5),
  subscription_plan, subscription_expires_at,
  timestamps, softDeletes
```

#### Properties / Listings

```sql
listings
  id, ulid,
  owner_type, owner_id,    -- POLYMORPHIC: Agency OR Landlord
  agent_id (nullable),     -- assigned agent (for agencies)
  title, slug, description,
  listing_type,            -- enum: for_sale|long_term_rent|short_term_stay
  property_type,           -- apartment|house|townhouse|commercial|etc
  status,                  -- enum: draft|available|leased|sold|archived

  -- Sale (agencies/agents only — landlords blocked at policy level)
  sale_price,
  negotiator_protocol (bool),   -- allow counter-offers

  -- Rent
  monthly_rent,
  listing_structure,       -- enum: single_unit|multi_unit
  short_stay_nightly_price, short_stay_max_guests, short_stay_cleaning_fee,

  -- Location
  address, suburb, city, province, postal_code,
  latitude, longitude,

  -- Features (stored as JSON for flexibility)
  bedrooms, bathrooms, area_sqm,
  amenities (json),        -- {interior:[...], kitchen:[...], exterior:[...]}

  -- Media
  primary_image,
  gallery_images (json),

  -- Analytics (denormalised for speed)
  views_count, inquiries_count,

  -- Soft delete + reactivation
  deleted_at,              -- soft delete = "rented/sold"
  deactivated_reason,      -- enum: leased|sold|off_market|other
  reactivated_at,

  timestamps
```

#### Units (for multi-unit listings)

```sql
listing_units
  id, listing_id, unit_number, floor,
  monthly_rent, bedrooms, bathrooms, area_sqm,
  status (available|leased),
  timestamps
```

#### Public site inquiries (leads)

```sql
inquiries
  id,
  listing_id, listing_unit_id (nullable),
  -- Visitor details (may not be a registered user)
  name, email, phone, message,
  user_id (nullable),           -- if visitor was logged in
  -- Routing
  assigned_to (users.id),       -- agent or landlord who owns the listing
  source,                       -- enum: website|property24|private_property|referral|walkin
  status,                       -- enum: new|contacted|qualified|viewing|offer|closed|lost
  -- Round-robin tracking
  allocated_at, allocation_method,  -- enum: round_robin|manual
  timestamps
```

#### Leases

```sql
leases
  id,
  listing_id, listing_unit_id (nullable),
  tenant_id (users.id),
  landlord_id (nullable, users.id),   -- for landlord-direct leases
  agency_id (nullable),               -- for agency leases
  agent_id (nullable),
  start_date, end_date,
  monthly_rent,
  deposit_amount,
  deposit_interest_rate,              -- set at lease creation (prime rate)
  escalation_percent,
  notice_period_days (default 30),
  status,   -- enum: pending|active|expired|terminated
  signed_at,
  document_path,                      -- signed PDF
  timestamps
```

#### Rent payments

```sql
rent_payments
  id, lease_id,
  amount, period_month (YYYY-MM),
  due_date, paid_at,
  payment_method,      -- enum: paystack_card|paystack_eft|debit_order|manual
  paystack_reference, paystack_transaction_id,
  status,              -- enum: pending|paid|overdue|partial
  receipt_path,
  timestamps
```

#### Deposits

```sql
deposits
  id, lease_id,
  amount_deposited, deposited_at,
  interest_rate, accrued_interest,
  last_accrual_date,
  deductions (json),   -- [{description, amount, approved_at}]
  refund_amount, refunded_at,
  paystack_reference,
  status,  -- enum: held|partially_refunded|refunded
  timestamps
```

#### Inspections

```sql
inspections
  id,
  lease_id,
  type,              -- enum: move_in|move_out|annual
  conducted_by,      -- users.id (agent or landlord)
  tenant_id,
  status,            -- enum: in_progress|awaiting_signature|completed
  rooms (json),      -- [{name, notes, photos:[{path,caption,flagged}]}]
  agent_signed_at, agent_signature,
  tenant_signed_at, tenant_signature,
  pdf_path,
  deduction_total,   -- calculated from move_out comparison
  timestamps

inspection_deductions
  id, inspection_id,
  room, description, amount,
  approved_at, disputed_at,
  timestamps
```

#### Maintenance

```sql
maintenance_requests
  id,
  property_id (listings.id),
  lease_id (nullable),
  submitted_by (users.id),   -- tenant, landlord, or agent
  title, description,
  category,   -- enum: plumbing|electrical|appliances|structural|garden|other
  urgency,    -- enum: low|medium|high|emergency
  preferred_date, preferred_time_slot,
  photos (json),
  assigned_to (users.id, contractor),
  status,     -- enum: open|awaiting_quotes|in_progress|completed|paid
  completed_at,
  timestamps

maintenance_quotes
  id, maintenance_request_id,
  contractor_id,
  line_items (json),   -- [{description, qty, unit_price}]
  subtotal, vat_amount, total,
  vat_registered (bool),
  notes,
  valid_until,         -- auto-set: sent_at + 14 days
  status,              -- enum: draft|sent|accepted|rejected|expired
  sent_at, expires_at,
  timestamps

maintenance_invoices
  id, maintenance_request_id, quote_id (nullable),
  contractor_id,
  line_items (json),
  original_quote_total,
  invoice_subtotal, vat_amount, invoice_total,
  deviation_amount, deviation_notes,
  completion_photos (json),
  supporting_documents (json),
  paystack_reference,
  status,   -- enum: draft|submitted|approved|paid|disputed
  submitted_at, approved_at, paid_at,
  timestamps
```

#### Contractors

```sql
contractors
  id, user_id,
  business_name, trading_name,
  specialities (json),     -- ["plumbing","geysers","drainage"]
  service_areas (json),    -- ["Sandton","Fourways","Centurion"]
  vat_registered (bool), vat_number,
  paystack_recipient_code,
  cipc_number, cipc_verified_at,
  tax_clearance_path, tax_clearance_verified_at,
  bbbee_level, bbbee_path, bbbee_verified_at,
  insurance_amount, insurance_path, insurance_verified_at,
  certifications (json),
  portfolio_items (json),  -- [{title, before_photo, after_photo, description}]
  average_rating, total_reviews, total_jobs,
  status,   -- enum: pending|active|suspended
  platform_fee_percent (default 2.5),
  timestamps

contractor_ratings
  id, contractor_id,
  rated_by (users.id),   -- agency_admin or landlord
  maintenance_request_id,
  rating (1-5), comment,
  timestamps
```

#### Messages (in-app)

```sql
conversations
  id,
  type,  -- enum: agency_agent|landlord_tenant|landlord_contractor|agency_tenant|agent_lead
  participants (json),   -- [user_id, ...]
  timestamps

messages
  id, conversation_id, sender_id,
  body, read_at,
  timestamps
```

#### Agent commission & payouts

```sql
commissions
  id,
  agency_id, agent_id,
  deal_type,       -- enum: sale|rental
  listing_id, lease_id (nullable),
  deal_value,      -- sale price or annual rent
  gross_commission,
  agent_split_percent,
  agent_amount, agency_amount,
  vat_amount,
  agent_net,
  paystack_transfer_id,
  status,   -- enum: pending|approved|blocked|paid
  blocked_reason,   -- e.g. "paystack_missing"|"ffc_expired"
  payout_batch_date,
  paid_at,
  timestamps

payout_batches
  id, agency_id,
  batch_date,
  total_gross, total_vat, total_agent_net,
  paystack_bulk_transfer_id,
  status,   -- enum: pending|approved|processing|completed|failed
  timestamps
```

#### Subscriptions & platform finance

```sql
subscription_plans
  id, name, slug,
  target_role,   -- agency|landlord
  price_monthly,
  property_limit (null = unlimited),
  agent_limit (null = unlimited),
  features (json),
  is_active (bool),
  timestamps

subscriptions
  id, subscriber_type, subscriber_id,  -- polymorphic
  plan_id,
  paystack_subscription_code,
  status,        -- enum: active|past_due|cancelled
  trial_ends_at, current_period_end,
  timestamps

platform_transactions
  id, subscriber_type, subscriber_id,
  type,          -- enum: subscription|platform_fee|contractor_fee
  amount, description,
  paystack_reference,
  status,        -- enum: pending|paid|failed
  timestamps

announcements
  id, created_by (users.id),
  title, body,
  audience,      -- enum: all|agencies|landlords|contractors|tenants
  send_email (bool), show_banner (bool),
  published_at,
  timestamps
```

---

### 2.4 Eloquent Model Relationships

```php
// User has one profile per role
User → hasOne(Agency)         [agency_admin]
User → hasOne(Landlord)       [landlord]
User → hasOne(Contractor)     [contractor]
User → belongsToMany(Agency, agency_agents)  [agent]

// Agency tree
Agency → hasMany(AgencyAgent) → Agent → User
Agency → hasMany(Listing)
Agency → hasMany(Lease)
Agency → hasMany(PayoutBatch) → hasMany(Commission)

// Listing is polymorphic (Agency or Landlord owns it)
Listing → morphTo(owner)       // agency or landlord
Listing → belongsTo(Agent)     // assigned agent
Listing → hasMany(Inquiry)
Listing → hasMany(Lease)
Listing → hasMany(MaintenanceRequest)
Listing → hasMany(ListingUnit)

// Lease is the hub
Lease → belongsTo(Listing)
Lease → belongsTo(Tenant)
Lease → hasMany(RentPayment)
Lease → hasOne(Deposit)
Lease → hasMany(Inspection)

// Maintenance flows
MaintenanceRequest → hasMany(MaintenanceQuote)
MaintenanceRequest → hasOne(MaintenanceInvoice)
MaintenanceRequest → belongsTo(Contractor, 'assigned_to')
```

---

### 2.5 Authorization (Gates & Policies)

```php
// ListingPolicy
create:      agency_admin | agent | landlord
create_sale: agency_admin | agent            // LANDLORDS BLOCKED
update:      owner of listing
soft_delete: owner of listing (marks as leased/sold)
restore:     owner of listing
view_any:    all authenticated users

// InquiryPolicy
view:        assigned_to (agent or landlord who owns listing)
update:      assigned_to

// LeasePolicy
create:      agency_admin | landlord
invite_tenant: agency_admin | landlord

// CommissionPolicy
run_payout:  agency_admin only
set_split:   agency_admin only

// MaintenancePolicies
create_request:    tenant | landlord | agent | agency_admin
assign_contractor: agency_admin | landlord
accept_job:        contractor (own jobs only)
submit_quote:      contractor
submit_invoice:    contractor
approve_invoice:   agency_admin | landlord

// AdminPolicies — super_admin only
manage_subscriptions, manage_roles, manage_platform_settings
```

---

### 2.6 Key Service Classes

```php
// Handles inquiry-to-dashboard notification when someone fills
// the contact form on propertybasket.co.za
class InquiryService {
  createFromWebsite(array $data): Inquiry
    → creates Inquiry record
    → determines owner (agent or landlord) via listing
    → allocates via round-robin if agency listing
    → fires InquiryReceived event → notifies owner's dashboard + email

  allocateRoundRobin(Listing $listing): User
    → finds agency_agents for listing's agency
    → orders by lead_allocation_position
    → assigns to next agent, increments position
}

class ListingService {
  publish(Listing $listing): void
    → validates owner permissions
    → sets status = available
    → syncs to public website (API call or shared DB)

  softDelete(Listing $listing, string $reason): void
    → sets deleted_at, deactivated_reason
    → hides from public website instantly (same DB, no sync needed)

  restore(Listing $listing): void
    → clears deleted_at
    → status = available, reactivated_at = now()
}

class PaystackService {
  initializePayment(Lease $lease, string $period): array
  verifyWebhook(Request $request): bool
  createTransferRecipient(User $user): string
  initiateTransfer(Commission $commission): string
  runPayoutBatch(PayoutBatch $batch): void
}

class DepositService {
  accrueMonthlyInterest(): void   // scheduled daily, runs on 1st
    → foreach active deposit: calculate interest, append to accrued_interest
  calculateRefund(Inspection $moveOut): float
    → deposit + interest - approved_deductions
  processRefund(Deposit $deposit): void
    → creates Paystack transfer to tenant
}

class InspectionService {
  create(Lease $lease, string $type): Inspection
  addRoomPhotos(Inspection $inspection, array $data): void
  compareWithMoveIn(Inspection $moveOut): array
    → returns room-by-room variance with damage flags
  generatePDF(Inspection $inspection): string  // returns path
  sendToParties(Inspection $inspection): void
    → emails PDF to tenant, landlord/agent, stored on lease
}

class CommissionService {
  calculate(Lease|Sale $deal, Agent $agent): Commission
  blockIfNonCompliant(Commission $commission): bool
    → checks: paystack linked, FFC not expired
  runMonthlyBatch(Agency $agency): PayoutBatch
}

class NotificationService {
  // All these fan out to DB notification + email + in-app push
  inquiryReceived(Inquiry $inquiry): void
  rentDueSoon(Lease $lease, int $daysAhead): void   // fired 7 days before
  rentOverdue(Lease $lease): void
  maintenanceAssigned(MaintenanceRequest $req): void
  quoteReceived(MaintenanceQuote $quote): void
  invoiceSubmitted(MaintenanceInvoice $inv): void
  inspectionReady(Inspection $inspection): void
  leaseExpiringSoon(Lease $lease, int $daysAhead): void
}
```

---

### 2.7 Scheduled Jobs

```php
// In app/Console/Kernel.php or routes/console.php (Laravel 11)

Schedule::call(fn() => DepositService::accrueMonthlyInterest())
  ->monthlyOn(1, '03:00');

Schedule::call(fn() => RentReminderJob::dispatch())
  ->daily()    // checks all leases, fires 7-day warning

Schedule::call(fn() => QuoteExpiryJob::dispatch())
  ->daily()    // marks quotes expired after 14 days

Schedule::call(fn() => LeaseExpiryAlertJob::dispatch())
  ->daily()    // fires 60-day, 30-day alerts to landlord/agency

Schedule::call(fn() => FfcExpiryAlertJob::dispatch())
  ->daily()    // checks agency_agents FFC, alerts + blocks payouts
```

---

### 2.8 Public Website ↔ Dashboard Integration

Because everything is in **one Laravel app** (no WordPress), a listing is one
database record. No sync required. Here's how each integration point works:

```
Public page: /properties          → reads listings WHERE status=available AND deleted_at IS NULL
Public page: /properties/{slug}   → reads one listing (+ agent/landlord contact)
Inquiry form on public page       → POST /inquiries → InquiryService::createFromWebsite()
                                    → fires notification to listing owner's dashboard

Dashboard: "Mark as rented"       → listing.deleted_at = now(), reason = leased
                                    → public site: listing instantly disappears (same DB)

Dashboard: "Reactivate"           → listing.deleted_at = null, status = available
                                    → public site: listing instantly reappears

Sale listings:                    → ListingPolicy::create_sale blocks landlords
                                    → frontend hides "For Sale" option on landlord dashboard
```

---

### 2.9 Paystack Integration Points

```
1. Tenant pays rent        → Paystack Checkout → webhook → RentPayment::paid
2. Agency receives rent    → Paystack subaccount split (agency gets %, platform gets fee%)
3. Agent payout            → Paystack Transfer to agent's recipient_code
4. Contractor payout       → Paystack Transfer to contractor's recipient_code
5. Subscription billing    → Paystack Subscriptions API (recurring)
6. Platform fees           → Deducted at source via subaccount split
```

---

### 2.10 South Africa Compliance Checklist

```
POPIA   → encrypt PII at rest, audit log on data access, delete-on-request
EAAB    → FFC number on agency registration, FFC expiry blocks payouts
FICA    → ID number collected for landlords + tenants (not verified by system,
          flagged for manual review)
RHA     → Deposit earns interest (DepositService), 14-day refund window enforced,
          deductions require invoices, interest belongs to tenant
VAT     → 15% on commission invoices (agencies), contractor invoices,
          platform subscription fees. VAT 201 report generated in admin.
NAEDO   → Debit order collection for rent (Paystack handles)
CPA     → 7-day cooling-off note on lease signing
```

---

## PART 3: HOW TO MOVE INTO CLAUDE CODE

### Step 1 — Install Claude Code on your machine

Claude Code runs in your terminal. Install it:

```bash
npm install -g @anthropic-ai/claude-code
```

Then authenticate:

```bash
claude
```

Follow the login prompt. You need an Anthropic account (claude.ai) with a Pro
or higher plan. Claude Code is billed per token separately.

---

### Step 2 — Create your Laravel project folder

On your machine, create the project:

```bash
composer create-project laravel/laravel property-basket
cd property-basket
```

Then open Claude Code inside that folder:

```bash
claude
```

Claude Code will now see every file in `property-basket/` and can read, create,
and edit them. This is its "context window" — it works on real files, not chat.

---

### Step 3 — Copy your mockup files into the project

Create a reference folder inside your project:

```bash
mkdir _mockups
```

Copy all seven HTML mockups into `_mockups/`:

```
_mockups/
  property-basket-auth.html
  property-basket-agent-dashboard.html
  property-basket-agency-dashboard.html
  property-basket-tenant-dashboard.html
  property-basket-contractor-dashboard.html
  property-basket-landlord-dashboard.html
  property-basket-admin-dashboard.html
  property-basket-build-guide.md   ← this file
```

Claude Code will reference these as the visual source of truth for every screen.

---

### Step 4 — Paste the Master Prompt (see Part 4 below)

In the Claude Code terminal, paste the prompt from Part 4. This gives Claude
Code everything it needs to understand the full scope before writing a single
line of code.

---

### Step 5 — Work in phases, one at a time

Claude Code works best when you give it one concrete task, let it finish, review
the output, then move to the next. The phases are in Part 5.

---

## PART 4: THE MASTER PROMPT FOR CLAUDE CODE

Copy and paste this entire prompt into Claude Code at the start of your session.

---

```
I am building Property Basket — a multi-role South African property management
platform. I have a complete architecture spec and seven production-quality HTML
mockups that define exactly how every screen should look.

TECH STACK:
- Laravel 11, PHP 8.3
- Inertia.js + React (TypeScript)
- Tailwind CSS
- MySQL 8.0
- Paystack (payments + payouts)
- Laravel Horizon + Redis (queues)
- Laravel Echo + Pusher (real-time)

REFERENCE FILES (in _mockups/ folder):
- property-basket-build-guide.md       ← full architecture spec
- property-basket-auth.html            ← login/signup/invite screens
- property-basket-agent-dashboard.html ← agent dashboard (7 views)
- property-basket-agency-dashboard.html← agency dashboard (8 views)
- property-basket-tenant-dashboard.html← tenant dashboard (8 views)
- property-basket-contractor-dashboard.html ← contractor dashboard (9 views)
- property-basket-landlord-dashboard.html   ← landlord dashboard (10 views)
- property-basket-admin-dashboard.html ← super admin (11 views)

DESIGN RULES (non-negotiable):
- Visual language: black sidebar (#0B0B0F), brand purple (#5B3DF5), white cards,
  Plus Jakarta Sans font, generous whitespace — exactly as shown in the mockups
- Match every screen in the mockups pixel-for-pixel. The mockups ARE the design.
- All currency in ZAR (R), date format YYYY/MM/DD, timezone Africa/Johannesburg

BUSINESS RULES (enforce these in both backend policies AND frontend UI):
1. Agents and tenants cannot self-register — invite-only
2. Landlords can post For Rent and Short-Stay listings only — For Sale is blocked
3. Agencies/agents can post all listing types including For Sale
4. When a listing is "rented/sold", it is soft-deleted (hidden from public site)
   and can be reactivated by the owner
5. When a visitor inquires on the public site, a lead is created and the listing
   owner (agent or landlord) is notified on their dashboard instantly
6. Lead allocation for agency listings uses round-robin across active agents
7. Contractor payouts are blocked until: Paystack linked + CIPC verified
8. Agent payouts are blocked until: Paystack linked + FFC not expired
9. Deposits must earn interest (6.75% p.a. default, configurable per lease)
10. Quotes auto-expire after 14 days
11. Payout batches require admin approval before Paystack transfer executes

I want to build this in phases. Please start with Phase 1 as described below,
read the architecture spec in _mockups/property-basket-build-guide.md, and read
the relevant mockup files before writing any code.

PHASE 1 — Foundation:
1. Run `php artisan` to confirm Laravel is installed correctly
2. Install required packages:
   composer require inertiajs/inertia-laravel tightenco/ziggy spatie/laravel-permission
   npm install @inertiajs/react react react-dom @types/react tailwindcss
3. Configure Tailwind with the exact colour tokens from the mockups (see design
   rules above — copy the exact tailwind.config values from any mockup file)
4. Create all migrations from the schema in the build guide (Section 2.3)
   — do them in dependency order (users first, then agencies, then listings, etc.)
5. Run migrations and confirm the database structure
6. Create all Eloquent models with relationships (Section 2.4)
7. Set up Spatie Laravel Permission with the 6 roles defined in Section 2.2
8. Create the role-gated registration logic:
   — Agency, Landlord, Contractor: self-register (different forms per role)
   — Agent, Tenant: invite token flow only
9. Build the auth screens using the mockup in _mockups/property-basket-auth.html
   as the exact visual reference

Tell me when Phase 1 is complete and all tests pass, then I will give you Phase 2.
```

---

## PART 5: THE BUILD PHASES (what you do after each one)

Work through these phases one at a time. After each phase, review what Claude
Code built, test it in your browser, and only then move to the next.

---

### Phase 1 — Foundation
**Claude Code does:** Packages, Tailwind config, all migrations, all Eloquent
models, roles/permissions, invite system, auth screens (login/signup/invite).

**You do:** Run `php artisan migrate`, open the app in browser, test registering
as Agency, Landlord, Contractor. Confirm invite emails arrive.

---

### Phase 2 — Public Website (Listings Front End)

Prompt to paste:
```
Phase 1 is complete. Start Phase 2.

Build the public-facing property listing website that non-logged-in visitors see
at /properties. This replaces the WordPress/Houzez site.

Build these pages:
1. / (homepage) — hero, featured listings, city browser, how it works
2. /properties — searchable/filterable listing grid (suburb, type, price range, bedrooms)
3. /properties/{slug} — single listing detail: photos, description, map, agent/landlord
   contact card, and an inquiry form that fires InquiryService::createFromWebsite()
4. /agencies — agency directory
5. /agencies/{slug} — agency profile with their active listings
6. /contractors — contractor marketplace (public view, for landlords browsing)

Business rules to enforce:
- For Sale listings are only shown when owner is agency/agent (never landlord)
- Soft-deleted listings (deleted_at IS NOT NULL) never appear on public pages
- The inquiry form on /properties/{slug} creates an Inquiry record and fires
  an in-app + email notification to the listing owner immediately

Use the visual style from the mockups — same font, colours, card components.
The public site should feel like the same product as the dashboards.
```

**You do:** Test the public listing pages. Fill in the inquiry form. Confirm
the lead appears on the listing owner's dashboard.

---

### Phase 3 — Agency Dashboard

Prompt to paste:
```
Phase 2 is complete. Start Phase 3.

Build the Agency dashboard using _mockups/property-basket-agency-dashboard.html
as the exact visual reference. Every view, tab, and component in that file must
be implemented.

The 8 views to build:
1. Dashboard (overview) — KPIs, revenue chart, top performers, activity stream
2. Agents — leaderboard, agent table with FFC/Paystack status, invite flow
3. Listings & Lead Allocation — listing cards with agent assignment, round-robin
   banner, lead queue table showing AUTO vs MANUAL allocation
4. Pipeline (cross-agent Kanban) — all deals across all agents, filterable
5. Commission & Payouts — payout queue with approval + Paystack batch trigger
6. Financial Reports — income statement, cash flow, trust account, VAT 201
7. Team Messages — agency-to-agent in-app messaging with broadcast option
8. Settings — VAT setup, trust account, payout cycle day, Paystack connection

Key services to wire up:
- InquiryService::allocateRoundRobin() when new lead arrives
- CommissionService::runMonthlyBatch() triggered from payout queue UI
- PaystackService::initiateTransfer() per approved commission
- Block payouts if FFC expired or Paystack missing (show red BLOCKED badge)
```

**You do:** Create a test agency. Invite an agent. Create a listing. Submit
an inquiry from the public site. Confirm round-robin allocation. Approve a
payout batch.

---

### Phase 4 — Agent Dashboard

Prompt to paste:
```
Phase 3 is complete. Start Phase 4.

Build the Agent dashboard using _mockups/property-basket-agent-dashboard.html
as the exact visual reference.

The 8 views to build:
1. Dashboard (overview) — greeting, KPIs, pipeline snapshot, today's schedule
2. Pipeline (own Kanban) — agent's own deals: New Lead → Qualified → Viewing → Offer → Closed
3. Listings — agent's assigned listings with performance metrics
4. Viewings Calendar — week-view calendar with scheduled viewings
5. Inspections — move-in and move-out sub-tabs with:
   - Room-by-room photo capture (upload or camera API)
   - Free-form notes per room
   - Digital signature on device for both agent and tenant
   - PDF auto-generated and emailed on completion
   - Move-out: side-by-side comparison with move-in photos
   - Deposit deduction routing from trust account
6. Messages — agent ↔ lead, agent ↔ tenant in-app messaging
7. Commission tracker — YTD earnings, bar chart vs target, transaction ledger
8. Analytics — conversion funnel, response time benchmarks, lead sources
```

**You do:** Log in as an agent. Confirm only assigned listings appear. Test
the inspection flow end to end. Check the commission ledger updates after
a lease is signed.

---

### Phase 5 — Tenant Dashboard

Prompt to paste:
```
Phase 4 is complete. Start Phase 5.

Build the Tenant dashboard using _mockups/property-basket-tenant-dashboard.html
as the exact visual reference.

The 8 views:
1. Dashboard — rent due hero card, deposit balance, open maintenance status
2. Make Payment — Paystack card/EFT checkout + debit order setup
3. Payment History — full ledger with PDF receipt download
4. My Lease — lease document download, addendums, key dates
5. Inspections — view their signed move-in report (read-only), sign move-out
6. Deposit — full trust ledger showing principal + monthly interest accrual
7. Maintenance — capture request (category, urgency, photos, preferred slot),
   real-time status tracker showing contractor name and visit time
8. Messages — tenant ↔ agent and tenant ↔ contractor

Reminders to implement:
- 7 days before rent due: email + in-app notification auto-fires
- On overdue: email + in-app notification
- POPIA footer on all messaging screens
```

---

### Phase 6 — Landlord Dashboard

Prompt to paste:
```
Phase 5 is complete. Start Phase 6.

Build the Landlord dashboard using _mockups/property-basket-landlord-dashboard.html
as the exact visual reference.

The 10 views:
1. Dashboard — portfolio overview, properties list, needs-attention panel
2. Properties — up to 5 cards, empty slots with "Add property" tiles,
   property cap enforced (block 6th at both API and UI level)
3. Inspections — landlord conducts own move-in/move-out (same flow as agent)
4. Maintenance — 5-column Kanban, direct assign OR multi-contractor quote request
   + emergency broadcast to area contractors
5. Tenants — invite tenants (lease-gated), show portal status per tenant
6. Contractors — shared marketplace browse + "My contractors" filter
7. Finance — income vs expenses per property, ROI/yield table, lease expiry
   tracker, deposit ledger (RHA interest compliance)
8. Rent & Payouts — Paystack balance, withdraw to bank, pay contractor
9. Messages — landlord ↔ tenant, landlord ↔ contractor
10. Settings — Paystack/banking (simplified — no Section 32 trust account),
    rent reminders, plan and billing

Important: Landlords CANNOT post For Sale listings — blocked at policy AND UI level.
Sidebar shows "3 of 5 properties used" progress bar at all times.
```

---

### Phase 7 — Contractor Dashboard

Prompt to paste:
```
Phase 6 is complete. Start Phase 7.

Build the Contractor dashboard using _mockups/property-basket-contractor-dashboard.html
as the exact visual reference.

The 9 views:
1. Dashboard — today's jobs, emergency alert, pending quotes, KPIs
2. Job Requests — unified feed (direct + quote requests), filterable by agency.
   Emergency broadcast shown with ripple animation and first-to-accept mechanic.
   Rejection requires selecting a reason (required field).
3. Active Jobs — 4-column Kanban: To Commence → In Progress → Completed → Paid
   with status update buttons per card
4. Quotes — full quote builder with line items, VAT auto-calculated (if registered),
   14-day auto-expiry enforced, send to agency
5. Invoices — quote-to-invoice conversion with side-by-side variance table
   (original quote vs final invoice, deviation notes required if over quote)
6. Finance — monthly income chart, income by client, VAT 201 helper,
   full income ledger (gross, VAT, net per invoice)
7. Portfolio — before/after work photos, reviews (from agency ratings),
   certifications (PIRB, SAQCC, COC), business docs (CIPC, tax, BBBEE, insurance)
8. Messages — contractor ↔ agency, contractor ↔ tenant (for job visits)
9. Settings — specialities, service areas, VAT toggle + VAT number, Paystack account
```

---

### Phase 8 — Super Admin Dashboard

Prompt to paste:
```
Phase 7 is complete. Start Phase 8.

Build the Super Admin dashboard using _mockups/property-basket-admin-dashboard.html.

The 11 views:
1. Overview — platform KPIs, growth chart, recent signups, system status strip
2. Agencies — filterable table, Approve/Suspend actions, EAAB verification status
3. Landlords — filterable table, property count vs cap, FICA status, offer-upgrade
4. Contractors — table with document verification status, Verify action
5. User Management — all users, inline role dropdown to change role
6. Roles & Permissions — permission matrix (rows=permissions, cols=roles),
   toggle per cell, Save button
7. Subscriptions — editable plan cards (inline price edit), contractor fee %
8. Transactions — all subscription + platform fee transactions via Paystack
9. Announcements — composer with audience targeting, in-app + email toggles
10. Platform Settings — General, Fees (contractor %), Paystack, VAT default rate
11. System Health — service status cards, scheduled job log
```

---

### Phase 9 — Polish, Testing & Deployment

Prompt to paste:
```
All 8 dashboard phases are complete. Start Phase 9: polish and deployment.

1. TESTS — write feature tests for these critical paths:
   a. Landlord cannot create a For Sale listing (assert 403)
   b. Agent cannot register without invite token (assert redirect)
   c. Inquiry on public listing creates Inquiry record and notifies listing owner
   d. Soft-delete a listing, confirm it disappears from public /properties
   e. Reactivate listing, confirm it reappears
   f. Payout blocked when agent FFC is expired
   g. Quote auto-expires after 14 days (run QuoteExpiryJob, assert status=expired)
   h. Deposit interest accrues correctly for 1 month (DepositService test)

2. PERFORMANCE
   - Add DB indexes on all foreign keys and commonly queried columns
     (listings.status, listings.deleted_at, leases.status, rent_payments.status)
   - Cache the public /properties page with 5-minute TTL
   - Eager load relationships everywhere N+1 is possible

3. DEPLOYMENT (Laravel Forge + DigitalOcean or Hetzner)
   - Generate production .env checklist
   - Set up Horizon dashboard (queue monitoring) at /horizon (admin only)
   - Set up Laravel Telescope (debugging) at /telescope (admin only)
   - Configure S3 or Cloudflare R2 for inspection photos and documents
   - Set up Paystack webhook endpoint and verify signature in PaystackService
   - SSL certificate via Let's Encrypt
   - Cron job for Laravel scheduler (runs all the scheduled jobs from Section 2.7)
```

---

## PART 6: WHAT YOU DO WITH THE ARCHITECTURE SPEC

Here's the direct answer to your question, step by step:

**Right now:**
Copy this entire document into `_mockups/property-basket-build-guide.md` inside
your Laravel project folder.

**In Claude Code:**
Paste the Master Prompt from Part 4. Claude Code will read both this spec and
the HTML mockups as its source of truth. It will not invent the design or the
database — it will build exactly what is specified.

**When Claude Code writes a migration:**
It reads Section 2.3 of this document. You do not need to write any SQL.

**When Claude Code writes a policy:**
It reads Section 2.5. The "landlords can't post For Sale" rule and the
"agents are invite-only" rule are already written — Claude Code implements them.

**When Claude Code builds a dashboard view:**
It opens the corresponding HTML mockup and replicates it using Inertia + React
components with Tailwind. The mockups are the design spec.

**When something isn't working:**
You describe the issue in Claude Code's terminal and it fixes the specific file.
You never need to modify the spec — it stays as the permanent reference.

**When you want to add a feature later:**
Start a new Claude Code session, reference this document, and describe the new
feature. The spec gives Claude Code the context it needs without re-explaining
the whole project.

---

## QUICK REFERENCE: FILES YOU NEED

```
Your project structure when you start Claude Code:

property-basket/              ← Laravel root (created by composer)
├── _mockups/
│   ├── property-basket-build-guide.md        ← THIS FILE
│   ├── property-basket-auth.html
│   ├── property-basket-agent-dashboard.html
│   ├── property-basket-agency-dashboard.html
│   ├── property-basket-tenant-dashboard.html
│   ├── property-basket-contractor-dashboard.html
│   ├── property-basket-landlord-dashboard.html
│   └── property-basket-admin-dashboard.html
├── app/
├── database/
├── resources/
├── routes/
└── ... (standard Laravel structure)
```

Once you paste the Master Prompt, Claude Code reads everything in `_mockups/`
and starts building. You review, test, and move to the next phase.

That is the complete workflow.
