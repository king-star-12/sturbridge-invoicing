"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { computeTotals, derivedStatus, type DerivedStatus } from "@/lib/calc";
import { fmtDate, money, todayISO } from "@/lib/format";
import { Empty, PageHeader, StatusBadge } from "@/components/ui";

const FILTERS: { key: DerivedStatus | "all" | "open"; label: string }[] = [
  { key: "all", label: "All" }, { key: "open", label: "Open" }, { key: "overdue", label: "Overdue" }, { key: "draft", label: "Drafts" }, { key: "paid", label: "Paid" }, { key: "void", label: "Void" },
];

export default function InvoicesPage() {
  const store = useStore();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "due" | "amount">("newest");
  const today = todayISO();

  const rows = useMemo(() => {
    let r = store.invoices.map((inv) => ({ inv, t: computeTotals(inv, store.settings.taxes), st: derivedStatus(inv, store.settings.taxes, today) }));
    if (filter === "open") r = r.filter((x) => ["sent", "partial", "overdue"].includes(x.st));
    else if (filter !== "all") r = r.filter((x) => x.st === filter);
    const s = q.trim().toLowerCase();
    if (s) r = r.filter(({ inv }) => [inv.number, inv.billTo.company, inv.billTo.contactName, inv.eventNumber, inv.eventName, inv.poNumber, inv.salesPerson].some((v) => v?.toLowerCase().includes(s)));
    r.sort((a, b) => sort === "newest" ? b.inv.invoiceDate.localeCompare(a.inv.invoiceDate) || b.inv.number.localeCompare(a.inv.number)
      : sort === "oldest" ? a.inv.invoiceDate.localeCompare(b.inv.invoiceDate)
      : sort === "due" ? a.inv.dueDate.localeCompare(b.inv.dueDate)
      : b.t.total - a.t.total);
    return r;
  }, [store.invoices, store.settings.taxes, q, filter, sort, today]);

  const sum = rows.reduce((a, r) => a + (r.st === "void" ? 0 : r.t.balance), 0);

  return (
    <>
      <PageHeader title="Invoices" subtitle={`${rows.length} shown · ${money(sum)} outstanding in view`} actions={<Link href="/invoices/new" className="btn-primary"><Plus size={16} /> New invoice</Link>} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]"><Search size={16} className="absolute left-3 top-2.5 text-ink-500" /><input className="input pl-9" placeholder="Search number, customer, event #, PO…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex rounded-md border border-ink-300 bg-white overflow-hidden">{FILTERS.map((f) => <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-2 text-sm ${filter === f.key ? "bg-teal-700 text-white" : "hover:bg-ink-50"}`}>{f.label}</button>)}</div>
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="due">By due date</option><option value="amount">Largest amount</option></select>
      </div>
      {rows.length === 0 ? <Empty title="No invoices match" body="Try a different search or filter." /> : (
        <div className="card overflow-x-auto">
          <table className="table min-w-[720px]">
            <thead><tr><th>Invoice</th><th>Customer</th><th>Event</th><th>Date</th><th>Due</th><th className="text-right">Total</th><th className="text-right">Balance</th><th className="text-right">Status</th></tr></thead>
            <tbody>{rows.map(({ inv, t, st }) => (
              <tr key={inv.id} className="hover:bg-ink-50">
                <td><Link href={`/invoices/${inv.id}`} className="font-medium text-teal-800 hover:underline">{inv.number}</Link></td>
                <td><div className="font-medium truncate max-w-[220px]">{inv.billTo.company}</div><div className="text-xs text-ink-500">{inv.billTo.contactName}</div></td>
                <td className="text-ink-700"><div className="truncate max-w-[180px]">{inv.eventName || "—"}</div>{inv.eventNumber && <div className="text-xs text-ink-500">#{inv.eventNumber}</div>}</td>
                <td className="text-ink-700 whitespace-nowrap">{fmtDate(inv.invoiceDate)}</td>
                <td className={`whitespace-nowrap ${st === "overdue" ? "text-red-700 font-medium" : "text-ink-700"}`}>{fmtDate(inv.dueDate)}</td>
                <td className="text-right num">{money(t.total)}</td>
                <td className="text-right num font-medium">{money(t.balance)}</td>
                <td className="text-right"><StatusBadge status={st} /></td>
              </tr>))}</tbody>
          </table>
        </div>)}
    </>
  );
}
