"use client";
import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { computeTotals, derivedStatus } from "@/lib/calc";
import { fmtDate, money, todayISO, daysBetween } from "@/lib/format";
import { PageHeader, Stat, StatusBadge, Empty } from "@/components/ui";

export default function Dashboard() {
  const store = useStore();
  const today = todayISO();
  const rows = useMemo(() => store.invoices.map((inv) => ({ inv, t: computeTotals(inv, store.settings.taxes), st: derivedStatus(inv, store.settings.taxes, today) })), [store.invoices, store.settings.taxes, today]);

  const open = rows.filter((r) => ["sent", "partial", "overdue"].includes(r.st));
  const outstanding = open.reduce((a, r) => a + r.t.balance, 0);
  const overdue = rows.filter((r) => r.st === "overdue");
  const overdueAmt = overdue.reduce((a, r) => a + r.t.balance, 0);
  const ym = today.slice(0, 7);
  const paidThisMonth = rows.reduce((a, r) => a + r.inv.payments.filter((p) => p.date.startsWith(ym)).reduce((x, p) => x + p.amount, 0), 0);
  const drafts = rows.filter((r) => r.st === "draft");
  const recent = [...rows].sort((a, b) => b.inv.updatedAt.localeCompare(a.inv.updatedAt)).slice(0, 8);
  const upcoming = rows.filter((r) => r.inv.eventStart >= today && r.st !== "void").sort((a, b) => a.inv.eventStart.localeCompare(b.inv.eventStart)).slice(0, 5);

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`${store.settings.hotel.name} · ${fmtDate(today, "long")}`} actions={<Link href="/invoices/new" className="btn-primary"><Plus size={16} /> New invoice</Link>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat label="Outstanding" value={money(outstanding)} sub={`${open.length} open invoice${open.length === 1 ? "" : "s"}`} />
        <Stat label="Overdue" value={money(overdueAmt)} tone={overdueAmt > 0 ? "bad" : "default"} sub={`${overdue.length} invoice${overdue.length === 1 ? "" : "s"} past due`} />
        <Stat label="Collected this month" value={money(paidThisMonth)} tone="good" />
        <Stat label="Drafts" value={String(drafts.length)} sub="waiting to be sent" />
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <section className="card">
          <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100"><h2 className="font-semibold">Recent activity</h2><Link href="/invoices" className="text-sm text-teal-700 flex items-center gap-1">All invoices <ArrowRight size={14} /></Link></div>
          {recent.length === 0 ? <div className="p-6"><Empty title="No invoices yet" action={<Link href="/invoices/new" className="btn-primary">Create the first invoice</Link>} /></div> : (
            <table className="table">
              <thead><tr><th>Invoice</th><th>Customer</th><th className="hidden sm:table-cell">Due</th><th className="text-right">Balance</th><th></th></tr></thead>
              <tbody>{recent.map(({ inv, t, st }) => (
                <tr key={inv.id} className="hover:bg-ink-50">
                  <td><Link href={`/invoices/${inv.id}`} className="font-medium text-teal-800 hover:underline">{inv.number}</Link></td>
                  <td className="truncate max-w-[220px]">{inv.billTo.company}</td>
                  <td className="hidden sm:table-cell text-ink-700">{fmtDate(inv.dueDate)}</td>
                  <td className="text-right num">{money(t.balance)}</td>
                  <td className="text-right"><StatusBadge status={st} /></td>
                </tr>))}</tbody>
            </table>)}
        </section>
        <div className="space-y-6">
          {overdue.length > 0 && (
            <section className="card border-red-100">
              <div className="px-5 py-3 border-b border-ink-100 font-semibold text-red-700">Needs attention</div>
              <ul className="divide-y divide-ink-100">{overdue.slice(0, 5).map(({ inv, t }) => (
                <li key={inv.id} className="px-5 py-3 text-sm flex justify-between gap-3">
                  <div className="min-w-0"><Link href={`/invoices/${inv.id}`} className="font-medium text-teal-800 hover:underline">{inv.number}</Link><div className="text-ink-500 truncate">{inv.billTo.company}</div></div>
                  <div className="text-right shrink-0"><div className="num font-medium">{money(t.balance)}</div><div className="text-xs text-red-700">{daysBetween(inv.dueDate, today)} days late</div></div>
                </li>))}</ul>
            </section>)}
          <section className="card">
            <div className="px-5 py-3 border-b border-ink-100 font-semibold">Upcoming events</div>
            {upcoming.length === 0 ? <div className="px-5 py-4 text-sm text-ink-500">No invoiced events coming up.</div> : (
              <ul className="divide-y divide-ink-100">{upcoming.map(({ inv }) => (
                <li key={inv.id} className="px-5 py-3 text-sm">
                  <div className="font-medium">{inv.eventName || inv.billTo.company}</div>
                  <div className="text-ink-500 text-xs">{fmtDate(inv.eventStart)}{inv.eventEnd && inv.eventEnd !== inv.eventStart ? ` – ${fmtDate(inv.eventEnd)}` : ""} · <Link href={`/invoices/${inv.id}`} className="text-teal-700">{inv.number}</Link></div>
                </li>))}</ul>)}
          </section>
        </div>
      </div>
    </>
  );
}
