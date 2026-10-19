# Integration API v1 — financial statements

Read-only HTTPS API that lets another system (accounting, ERP, BI) pull a landlord's
properties, leases and financial statements from the platform, for example
`https://careline.propertybasket.co.za`.

The figures are the same as the landlord's **Finance** page and statement PDFs:
**cash basis**, i.e. rent actually received and maintenance invoices actually paid. All
amounts are in **ZAR** (South African rand), as numbers with two decimals.

---

## 1. Authentication

1. The landlord signs in, opens **Settings → API access**, enters a name (e.g. "Sage sync")
   and clicks **Create API key**.
2. The key (`pbk_…`, 44 characters) is shown **once**. Copy it into the other system's
   secure configuration. The platform only stores a hash of it.
3. Send it on every request:

```
Authorization: Bearer pbk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

(`X-Api-Key: pbk_…` is also accepted.)

- A key only sees **its own landlord's** properties and leases.
- Keys are **read-only** (scope `statements:read`).
- Revoke a key at any time in **Settings → API access**; it stops working immediately.
- If the landlord's account is suspended, its keys stop working (403).
- Up to 10 active keys per landlord. Use one key per connected system.

## 2. Base URL and conventions

```
https://careline.propertybasket.co.za/api/integration/v1
```

- HTTPS only. Responses are JSON (`application/json`), except the `.pdf` endpoints.
- Dates are `YYYY-MM-DD` (South African time, UTC+2).
- Rate limit: **120 requests per minute** per client IP. Over the limit you get `429` with a
  `Retry-After` header.
- Successful JSON responses wrap the result in `data` (and sometimes `meta`).

### Period filters (statements)

| Parameter | Values | Meaning |
|---|---|---|
| `range` | `3`, `6`, `12`, `lease` | Last 3 / 6 / 12 calendar months **including the current month**, or the full lease period (from the first lease start). |
| `month` | `2026-09` | One calendar month. Overrides `range`. |
| `from` + `to` | `2026-07-01` + `2026-09-30` | A custom date range (JSON endpoints only). Overrides `range`. |
| `property` | property id | Limit to one property (from `GET /properties`). Omit for the whole portfolio. |

## 3. Endpoints

### `GET /properties`

The landlord's properties.

```json
{ "data": [ {
    "id": 3, "name": "Office OTB 1, Portion 91 of Bultfontein Farm No. 80, R31 Provincial Road",
    "title": "Office OTB 1", "address": "…", "suburb": "El Toro Park", "city": "Kimberley",
    "listing_type": "long_term_rent", "status": "leased", "monthly_rent": 5000.0
} ] }
```

### `GET /leases?status=active|all`

Leases on those properties (default: active and pending).

```json
{ "data": [ {
    "id": 3, "property_id": 3, "property": "Office OTB 1, …",
    "tenant": { "name": "Example Tenant (Pty) Ltd", "email": "tenant@example.com" },
    "status": "active", "start_date": "2026-02-01", "end_date": "2027-01-31",
    "monthly_rent": 5000.0, "deposit": 0.0, "payment_reference": "Example Tenant Rental"
} ] }
```

### `GET /statements/owner`

Owner statement: rent received less maintenance paid. Default period `range=12`.

```json
{ "data": {
    "landlord": "Careline Clinic", "property_id": null, "property": null,
    "period": { "from": "2025-11-01", "to": "2026-10-15", "label": "Last 12 months" },
    "currency": "ZAR", "basis": "cash",
    "totals": { "rent_income": 101000.0, "maintenance": 0.0, "net": 101000.0 },
    "by_property": [ { "property": "45 MacDougall Street", "income": 54000.0, "maintenance": 0.0, "net": 54000.0 } ],
    "lines": [ {
        "date": "2026-09-01", "type": "income",
        "description": "Rent received — September 2026 · Jane Tenant",
        "property": "45 MacDougall Street", "reference": "RCP-000017",
        "income": 3000.0, "expense": 0.0, "running_net": 3000.0
    } ]
} }
```

`lines[].type` is `income` (rent received) or `maintenance` (contractor invoice paid).
`running_net` is the cumulative net within the period.

### `GET /statements/owner/monthly`

One row per month, newest first. Default `range=lease`.

```json
{ "data": [ { "month": "2026-10", "label": "October 2026", "rent_income": 13000.0, "maintenance": 0.0, "net": 13000.0 } ],
  "meta": { "currency": "ZAR", "property_id": null, "range": "lease" } }
```

### `GET /statements/owner.pdf`

The owner statement as a PDF (same document as the Finance page download). Accepts
`property`, `range` (default `lease`) or `month`.

### `GET /leases/{id}/statement`

A tenant's rent account: charges (rent, late penalties) and payments, with a running
balance. Default `range=lease`.

```json
{ "data": {
    "lease_id": 1, "tenant": { "name": "Jane Tenant", "email": "tenant@example.com" },
    "property": "45 MacDougall Street",
    "period": { "from": "2025-05-01", "to": "2026-10-15", "label": "Full lease period" },
    "currency": "ZAR",
    "totals": { "opening_balance": 0.0, "charged": 54000.0, "paid": 54000.0, "closing_balance": 0.0 },
    "lines": [ { "date": "2026-10-01", "description": "Rent — October 2026", "reference": "INV-2026-10", "charge": 3000.0, "payment": 0.0, "balance": 3000.0 } ]
  },
  "meta": { "balance_sign": "positive = tenant owes, negative = in credit" } }
```

### `GET /leases/{id}/statement.pdf`

The tenant statement PDF. Accepts `range` (default `lease`) or `month`.

### Facility operations (separate from rent + maintenance)

Running costs of the facility (kitchen upkeep, rates & taxes, municipal electricity and water,
gardening, …) and other income the facility earns, as captured on the landlord's
**Operations** tab. These never appear in `/statements/owner` (which stays rent received less
maintenance paid), and nothing here changes rent.

Filters: `range` = `1` (this month), `3`, `6`, `12`, `all` (`lease` is accepted as `all`);
`month`, `from` + `to` as above; `property` = a property id, or `facility` for whole-facility
entries only (omit for everything); `type` = `income` or `expense` (filters `lines` only —
totals always cover both).

#### `GET /operations`

```json
{
  "data": {
    "landlord": "Careline Clinic",
    "property": null,
    "period": { "from": "2026-08-01", "to": "2026-10-15", "label": "Last 3 months" },
    "currency": "ZAR",
    "totals": { "other_income": 9000.0, "operating_expenses": 6650.5, "net": 2349.5, "coverage_pct": 135.3 },
    "expenses_by_category": [
      { "category": "rates", "label": "Rates & taxes", "amount": 4200.5, "count": 1, "share": 63.2 }
    ],
    "income_by_category": [
      { "category": "canteen", "label": "Kitchen / canteen sales", "amount": 9000.0, "count": 1, "share": 100 }
    ],
    "lines": [
      { "id": 12, "date": "2026-10-01", "type": "expense", "category": "rates", "category_label": "Rates & taxes",
        "description": "City of Tshwane rates — Oct", "property_id": null, "property": "Whole facility",
        "counterparty": "City of Tshwane", "reference": "ACC-778", "notes": null, "amount": 4200.5 }
    ]
  }
}
```

Expense categories: `kitchen`, `rates`, `electricity`, `water`, `gardening`, `other_expense`.
Income categories: `hospital_services`, `canteen`, `parking`, `facility_hire`, `other_income`.
Amounts are always positive; `type` says which side they're on. `net` = other income − operating
expenses.

#### `GET /operations/monthly`

One row per month (default `range=all`): `{ "month": "2026-09", "label": "Sep 2026", "income": 9000.0, "expenses": 2450.0, "net": 6550.0 }`,
with the period totals in `meta.totals`.

#### `GET /operations.csv`

The same lines as a CSV (Date, Type, Category, Description, Property, Supplier / payer,
Reference, Income, Expense, Notes) followed by totals and net.

## 4. Errors

| Status | When | Body |
|---|---|---|
| 401 | Missing, wrong or revoked key | `{"error":"unauthenticated","message":"…"}` |
| 403 | Key lacks the scope, or the account is not active | `{"error":"forbidden","message":"…"}` |
| 404 | Property or lease not found (or not this landlord's) | `{"message":"…"}` |
| 422 | Invalid filter (`range`, `month`, `from`/`to`) | `{"message":"…","errors":{"range":["…"]}}` |
| 429 | Rate limit exceeded | — (see `Retry-After`) |

## 5. Examples

```bash
# Last 12 months, whole portfolio
curl -H "Authorization: Bearer $PB_KEY" \
  "https://careline.propertybasket.co.za/api/integration/v1/statements/owner?range=12"

# September 2026 for one property
curl -H "Authorization: Bearer $PB_KEY" \
  "https://careline.propertybasket.co.za/api/integration/v1/statements/owner?property=3&month=2026-09"

# Facility running costs vs other income, last 12 months
curl -H "Authorization: Bearer $PB_KEY" \
  "https://careline.propertybasket.co.za/api/integration/v1/operations?range=12"

# Download the full-lease owner statement PDF
curl -H "Authorization: Bearer $PB_KEY" -o owner-statement.pdf \
  "https://careline.propertybasket.co.za/api/integration/v1/statements/owner.pdf?range=lease"
```

```python
import requests
BASE = "https://careline.propertybasket.co.za/api/integration/v1"
H = {"Authorization": f"Bearer {PB_KEY}"}
stmt = requests.get(f"{BASE}/statements/owner", params={"range": "6"}, headers=H, timeout=30).json()["data"]
print(stmt["totals"]["net"])
```

## 6. Suggested sync

- Nightly: `GET /statements/owner/monthly` for month totals, and
  `GET /statements/owner?month=<current month>` for the detail lines.
- Use `lines[].reference` as the de-duplication key when importing transactions.
- Past months can still change (late payments recorded, EFTs confirmed), so re-pull the
  previous month as well.

## 7. Implementation notes (for maintainers)

- Routes: `routes/integration.php`, loaded in `AppServiceProvider` under
  `/api/integration/v1` (stateless: no session/CSRF), throttle `120,1`.
- Auth: `App\Http\Middleware\AuthenticateApiKey`; keys in `api_keys` (`App\Models\ApiKey`,
  SHA-256 hash only).
- Data: `App\Http\Controllers\Integration\StatementsController` → `LandlordStatementService`,
  `TenantStatementService`, `PdfService`; operations → `FacilityLedgerService`
  (`facility_entries` table), shared with `Landlord\OperationsController`.
- Tests: `tests/Feature/IntegrationApiTest.php`.
