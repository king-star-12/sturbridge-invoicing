# Sturbridge Host Hotel — Invoicing

Event, banquet and conference invoicing for [Sturbridge Host Hotel + Conference Center](https://www.sturbridgehosthotel.com/), built as a configurable product rather than a one-off. Next.js 15, React 19, Tailwind.

## What makes it sellable

**Plug-and-play tax & charge engine** (`lib/engine.ts`). Every tax, service charge, fee and gratuity is a *rule*: percent or flat, applied to *tax classes* of line items and/or compounded on other rules. Jurisdiction presets ship for Massachusetts hotel banquet (matches the hotel's current invoices to the cent), Massachusetts with segregated gratuity, generic US sales tax, Ontario HST and UK VAT. Rules have effective dates for rate changes, per-line overrides, tax-exempt customers, pass-through flags for gratuity, and a live "Try it" playground. `lib/engine.test.mjs` reproduces the hotel's two real invoices.

**Document templates.** Classic (the hotel's current layout, with payment stub), Modern and Compact, each with accent color, logo, optional columns, grouped taxes, terms text, signature line, footer and paper size. Any document can print with any template.

**Estimates → invoices.** Separate numbering, accept/decline/expire, one-click convert, "copy as estimate".

**Deposits & payment schedules.** Templates (e.g. 25% at signing, 50% thirty days before the event, balance fourteen days before) expand into editable milestones, print on the document, and allocate payments FIFO.

**Custom fields**, configurable built-in fields, categories, units, terms, payment methods, sales people, numbering patterns (`INV-{YYYY}-{SEQ:4}`, yearly reset), locale/currency/date format.

**Reminders & late fees.** Due-soon and overdue tracking, reminder/receipt email templates with merge tokens, suggested late fee per policy (always confirmed, never silent).

**Reports.** A/R aging, tax liability by rule by month (for the meals-tax and room-occupancy returns), sales by tax class and sales person, customers; all CSV.

**Operations.** Activity log per document, CSV import/export for items and customers, JSON backup/restore, admin vs staff passcodes.

## Run locally
```bash
npm install
npm run dev        # http://localhost:5190
npx tsx lib/engine.test.mjs   # engine regression test
```
Passcodes: `INVOICE_PASSCODE` (admin, default `host2026`) and optional `STAFF_PASSCODE`.

## Deploy
Import the repo on Vercel; no build settings needed. Set the passcode env vars.

## Data
The prototype persists to the browser's localStorage through one store (`lib/store.tsx`) with versioned migrations (`lib/migrate.ts`). Moving to Postgres is a swap of `load`/`persist` plus API routes; the UI does not change. Use Settings → Team & data → Export backup to carry data over.

## Demo video
`demo/` holds the narration script, recorder and mux for the narrated walkthrough (see `demo/scripts`).
