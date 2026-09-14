"use client";
import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { computeTotals, derivedStatus, isOpen } from "@/lib/calc";
import { fmtDate, money, todayISO, daysBetween, addDays } from "@/lib/format";
import { PageHeader, Stat, StatusBadge, Empty } from "@/components/ui";

export default function Dashboard() {
  const store = useStore();
  const today = todayISO();
  const s = store.settings;
  const rows = useMemo(() => store.invoices.filter((i) => i.status !== "void").map((inv) => ({ inv, t: computeTotals(inv, s.tax), st: derivedStatus(inv, s.tax, today) })), [store.invoices, s.tax, today]);
  const invoices = rows.filter((r) => r.inv.kind !== "estimate");
  const estimates = rows.filter((r) => r.inv.kind === "estimate");
  const open = invoices.filter((r) => isOpen(r.st));
  const outstanding = open.reduce((a, r) => a + r.t.balance, 0);
  const overdue = invoices.filter((r) => r.st === "overdue");
  const overdueAmt = overdue.reduce((a, r) => a + r.t.balance, 0);
  const dueSoon = invoices.filter((r) => isOpen(r.st) && r.st !== "overdue" && r.inv.dueDate <= addDays(today, s.reminders.dueSoonDays));
  const ym = today.slice(0, 7);
  const paidThisMonth = invoices.reduce((a, r) => a + r.inv.payments.filter((p) => p.date.startsWith(ym)).reduce((x, p) => x + p.amount, 0), 0);
  const pipeline = estimates.filter((r) => r.st === "sent" || r.st === "accepted").reduce((a, r) => a + r.t.total, 0);
  const recent = [...rows].sort((a, b) => b.inv.updatedAt.localeCompare(a.inv.updatedAt)).slice(0, 8);
  const upcoming = rows.filter((r) => r.inv.eventStart >= today && r.st !== "declined").sort((a, b) => a.inv.eventStart.localeCompare(b.inv.eventStart)).slice(0, 6);

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`${s.business.name} · ${fmtDate(today, "long")}`} actions={<><Link href="/invoices/new?kind=estimate" className="btn-secondary"><Plus size={16} /> Estimate</Link><Link href="/invoices/new" className="btn-primary"><Plus size={16} /> Invoice</Link></>} />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Stat label="Outstanding" value={money(outstanding)} sub={`${open.length} open invoice${open.length === 1 ? "" : "s"}`} />
        <Stat label="Overdue" value={money(overdueAmt)} tone={overdueAmt > 0 ? "bad" : "default"} sub={`${overdue.length} past due`} />
        <Stat label="Due soon" value={money(dueSoon.reduce((a, r) => a + r.t.balance, 0))} tone={dueSoon.length ? "warn" : "default"} sub={`next ${s.reminders.dueSoonDays} days`} />
        <Stat label="Collected this month" value={money(paidThisMonth)} tone="good" />
        <Stat label="Estimate pipeline" value={money(pipeline)} sub={`${estimates.filter((r) => r.st === "sent").length} awaiting reply`} />
      </div>
      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <section className="card">
          <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100"><h2 className="font-semibold">Recent activity</h2><Link href="/invoices" className="text-sm text-teal-700 flex items-center gap-1">All invoices <ArrowRight size={14} /></Link></div>
          {recent.length === 0 ? <div className="p-6"><Empty title="No documents yet" action={<Link href="/invoices/new" className="btn-primary">Create the first invoice</Link>} /></div> : (
            <table className="table"><thead><tr><th>#</th><th>Customer</th><th className="hidden sm:table-cell">Due</th><th className="text-right">Amount</th><th></th></tr></thead>
              <tbody>{recent.map(({ inv, t, st }) => (<tr key={inv.id} className="hover:bg-ink-50"><td><Link href={`/invoices/${inv.id}`} className="font-medium text-teal-800 hover:underline">{inv.number}</Link></td><td className="truncate max-w-[220px]">{inv.billTo.company}</td><td className="hidden sm:table-cell text-ink-700">{fmtDate(inv.dueDate)}</td><td className="text-right num">{money(inv.kind === "estimate" ? t.total : t.balance)}</td><td className="text-right"><StatusBadge status={st} /></td></tr>))}</tbody></table>)}
        </section>
        <div className="space-y-6">
          {(overdue.length > 0 || dueSoon.length > 0) && (<section className="card border-red-100"><div className="px-5 py-3 border-b border-ink-100 font-semibold text-red-700">Needs attention</div>
            <ul className="divide-y divide-ink-100">{[...overdue, ...dueSoon].slice(0, 6).map(({ inv, t, st }) => (<li key={inv.id} className="px-5 py-3 text-sm flex justify-between gap-3"><div className="min-w-0"><Link href={`/invoices/${inv.id}`} className="font-medium text-teal-800 hover:underline">{inv.number}</Link><div className="text-ink-500 truncate">{inv.billTo.company}</div></div><div className="text-right shrink-0"><div className="num font-medium">{money(t.balance)}</div><div className={`text-xs ${st === "overdue" ? "text-red-700" : "text-amber-700"}`}>{st === "overdue" ? `${daysBetween(inv.dueDate, today)} days late` : `due in ${daysBetween(today, inv.dueDate)} days`}</div></div></li>))}</ul></section>)}
          <section className="card"><div className="px-5 py-3 border-b border-ink-100 font-semibold">Upcoming events</div>
            {upcoming.length === 0 ? <div className="px-5 py-4 text-sm text-ink-500">No upcoming events on file.</div> : (<ul className="divide-y divide-ink-100">{upcoming.map(({ inv, st }) => (<li key={inv.id} className="px-5 py-3 text-sm"><div className="font-medium">{inv.eventName || inv.billTo.company}</div><div className="text-ink-500 text-xs">{fmtDate(inv.eventStart)}{inv.eventEnd && inv.eventEnd !== inv.eventStart ? ` – ${fmtDate(inv.eventEnd)}` : ""} · <Link href={`/invoices/${inv.id}`} className="text-teal-700">{inv.number}</Link> · <StatusBadge status={st} /></div></li>))}</ul>)}
          </section>
        </div>
      </div>
    </>
  );
}
