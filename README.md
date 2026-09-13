# Sturbridge Host Hotel — Invoicing

Event, banquet and conference invoicing for [Sturbridge Host Hotel + Conference Center](https://www.sturbridgehosthotel.com/). Built with Next.js 15, React 19 and Tailwind.

## What it does
- **Invoices** with the hotel's real tax model: 7% meals tax, 14% service charge, 8% house charge, and 6.25% MA sales tax on the charges — applied per line, so rooms/AV stay exempt while F&B is taxed.
- **Print-perfect documents** matching the hotel's existing invoice layout (teal header, Bill To/meta block, item table, totals, payment stub). Print → Save as PDF from any browser.
- **Payments** (partial or full), automatic Draft / Sent / Partially paid / Paid / Overdue / Void status.
- **Customers** and a **price list** (Items & Pricing) with typeahead on the invoice editor.
- **Dashboard**: outstanding, overdue, collected this month, upcoming events.
- **Settings**: hotel details, tax rates, numbering, defaults, backup export/restore.
- **Staff passcode** gate (env `INVOICE_PASSCODE`, default `host2026`).

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:5190.

## Deploy
Import the repo on Vercel; no other configuration is needed. Set `INVOICE_PASSCODE` under Environment Variables to change the sign-in code.

## Data
The prototype persists to the browser's localStorage (see `lib/store.tsx`). All reads/writes go through one store, so moving to Postgres (Vercel Postgres / Neon + Prisma) is a swap of `load`/`persist` plus API routes — the UI does not change. Use Settings → Export backup to carry data over.
