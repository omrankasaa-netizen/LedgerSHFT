# LedgerShift — Wholesale Payments Tracker

LedgerShift is built for Lebanese wholesalers who issue invoices, sell on credit, and share profits with partners. It now includes an **Imports & Cost** layer: record supplier purchase invoices, allocate freight/duty/customs into a trusted landed cost per unit, and reuse those costs on sales invoices.

## Project structure

```
/                      React (Vite) frontend — exported from Base44
  src/pages/           Dashboard, Customers, Invoices, Payments, Reports, …
  src/pages/PurchaseInvoices.jsx       Imports & Cost: list
  src/pages/PurchaseInvoiceForm.jsx    Imports & Cost: 3-step form + AI upload
  src/api/base44Client.js              legacy Base44 SDK client (existing pages)
  src/api/backendClient.js             fetch wrapper for the self-hosted backend
  src/api/purchaseInvoices.js          Imports & Cost API calls
/backend               Self-hosted API (Node + TypeScript + Express + PostgreSQL)
  prisma/schema.prisma                 data model (users, customers, partners,
                                       invoices, payments, purchase invoices)
  src/routes/                          REST endpoints under /api
  src/services/invoiceParsing/         pluggable invoice-OCR (mock today)
  src/utils/calculations.ts            pure money math (unit-tested)
  tests/                               Jest tests for the calculations
```

> Migration status: existing pages still run on the Base44 SDK. The Imports &
> Cost section and the new backend are the first self-hosted slice; other
> modules move over the same pattern next.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (local or hosted)

## Environment variables

**Backend** — copy `backend/.env.example` to `backend/.env`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | API port (default 4000) |
| `JWT_SECRET` | long random secret for signing tokens |
| `JWT_EXPIRES_IN` | token lifetime (default `12h`) |
| `CORS_ORIGIN` | allowed frontend origin(s), comma-separated |
| `INVOICE_PARSER_PROVIDER` | `mock` (default) or `docuparse` |
| `DOCUPARSE_API_KEY` | DocuParse key, required for the `docuparse` provider |
| `DOCUPARSE_BASE_URL` | optional, default `https://docuparseapi.com` |
| `DOCUPARSE_TIMEOUT_MS` | optional poll timeout, default `60000` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | first admin account created by the seed |

**Frontend** — copy `.env.example` to `.env`:

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | base URL of the backend API (leave unset when the backend serves the frontend) |

## Run locally

Terminal 1 — backend:

```bash
cd backend
npm install
npx prisma db push     # create the tables in your database
npm run seed           # create the first admin user
npm run dev            # http://localhost:4000
```

Terminal 2 — frontend (Base44 local backend for the legacy pages):

```bash
npm install
base44 login && base44 link   # once per machine / clone
base44 dev                    # http://localhost:5173
```

Sign in to the **Imports & Cost** section with the seeded admin account
(`admin@ledgershift.local` / `admin12345` — change these in `backend/.env`).

## Tests

```bash
cd backend
npm test
```

Covers the core money math: landed-cost allocation (incl. rounding-drift
reconciliation), invoice totals, customer balances, and partner shares.

## Deployment

### Single service on Railway (recommended — one URL for the whole app)

The Express backend serves the built React app from `backend/public`, with an
SPA fallback so client-side routes work. The repo ships a `railway.json` that
builds both halves (`npm run build:full`) and starts the backend
(`npm run start:backend`).

1. Create a Railway project, add a **PostgreSQL** database.
2. Add a service from this repo with **no root directory** (repo root).
3. Set variables: `DATABASE_URL` (reference `${{Postgres.DATABASE_URL}}`),
   `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and for invoice parsing
   `INVOICE_PARSER_PROVIDER=docuparse` + `DOCUPARSE_API_KEY`.
   Do **not** set `PORT` — Railway injects it. `CORS_ORIGIN` is not needed
   here because the frontend is same-origin.
4. One-off setup (Railway shell): `npx prisma db push && npm run seed`
   (run from the `backend` directory).
5. Your Railway domain (e.g. `https://<app>.up.railway.app`) now serves both
   the app UI (`/`) and the API (`/api/health`).

### Split deploy (alternative): Railway backend + Cloudflare Pages frontend

If you prefer a CDN-hosted frontend:

1. Backend service on Railway with **root directory `backend`**, build
   `npm run build`, start `npm start`. Set `CORS_ORIGIN` to your Pages URL.
2. Frontend on Cloudflare Pages: framework preset **Vite**, build
   `npm run build`, output `dist`, env `VITE_API_URL` = the Railway URL.

## AI invoice parsing (beta)

`POST /api/purchase-invoices/parse-upload` accepts a supplier invoice PDF or
image and returns a candidate purchase invoice for review. The provider is
pluggable via `InvoiceParsingService` (`backend/src/services/invoiceParsing/`).
Two providers ship today:

- `mock` (default) — deterministic sample data so the upload → review →
  confirm flow can be used end-to-end without external calls.
- `docuparse` — real extraction via [DocuParse](https://docuparseapi.com).
  Set `INVOICE_PARSER_PROVIDER=docuparse` plus `DOCUPARSE_API_KEY`
  (optionally `DOCUPARSE_BASE_URL`, default `https://docuparseapi.com`, and
  `DOCUPARSE_TIMEOUT_MS`, default 60000). The document is uploaded to
  DocuParse and polled until extraction completes; the parsed header fields
  and line items land in the editable review table before saving.

## Base44 sync (legacy)

The repository still syncs with the Base44 Builder for the legacy frontend.
See the Base44 docs linked below for `base44 dev` / publish details — note
that anything under `/backend` is ignored by Base44 and deploys only to
Railway.

- GitHub integration: https://docs.base44.com/developers/app-code/local-development/github
- Local development: https://docs.base44.com/developers/backend/overview/local-dev/local-development-overview
