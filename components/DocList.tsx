"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { computeTotals, derivedStatus, isOpen, type DerivedStatus } from "@/lib/calc";
import { fmtDate, money, todayISO, download, toCSV } from "@/lib/format";
import type { DocKind } from "@/lib/types";
import { Empty, PageHeader, StatusBadge } from "@/components/ui";

const INV_FILTERS: { key: DerivedStatus | "all" | "open"; label: string }[] = [{ key: "all", label: "All" }, { key: "open", label: "Open" }, { key: "overdue", label: "Overdue" }, { key: "draft", label: "Drafts" }, { key: "paid", label: "Paid" }, { key: "void", label: "Void" }];
const EST_FILTERS: { key: DerivedStatus | "all" | "open"; label: string }[] = [{ key: "all", label: "All" }, { key: "sent", label: "Awaiting" }, { key: "accepted", label: "Accepted" }, { key: "converted", label: "Converted" }, { key: "declined", label: "Declined" }, { key: "expired", label: "Expired" }, { key: "draft", label: "Drafts" }];

export default function DocList({ kind }: { kind: DocKind }) {
  const store = useStore();
  const [q, setQ] = useState("");
  const FILTERS = kind === "invoice" ? INV_FILTERS : EST_FILTERS;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "due" | "amount" | "customer">("newest");
  const [sp, setSp] = useState("");
  const today = todayISO();
  const rows = useMemo(() => {
    let r = store.invoices.filter((i) => (i.kind ?? "invoice") === kind).map((inv) => ({ inv, t: computeTotals(inv, store.settings.tax), st: derivedStatus(inv, store.settings.tax, today) }));
    if (filter === "open") r = r.filter((x) => isOpen(x.st)); else if (filter !== "all") r = r.filter((x) => x.st === filter);
    if (sp) r = r.filter((x) => x.inv.salesPerson === sp);
    const s = q.trim().toLowerCase();
    if (s) r = r.filter(({ inv }) => [inv.number, inv.billTo.company, inv.billTo.contactName, inv.eventNumber, inv.eventName, inv.poNumber, inv.salesPerson, ...Object.values(inv.custom ?? {})].some((v) => v?.toLowerCase().includes(s)));
    r.sort((a, b) => sort === "newest" ? b.inv.invoiceDate.localeCompare(a.inv.invoiceDate) || b.inv.number.localeCompare(a.inv.number) : sort === "oldest" ? a.inv.invoiceDate.localeCompare(b.inv.invoiceDate) : sort === "due" ? a.inv.dueDate.localeCompare(b.inv.dueDate) : sort === "customer" ? a.inv.billTo.company.localeCompare(b.inv.billTo.company) : b.t.total - a.t.total);
    return r;
  }, [store.invoices, store.settings.tax, q, filter, sort, sp, today, kind]);
  const sum = rows.reduce((a, r) => a + (isOpen(r.st) ? r.t.balance : 0), 0);
  const title = kind === "invoice" ? "Invoices" : "Estimates";
  const exportCsv = () => download(`${title.toLowerCase()}-${today}.csv`, toCSV(rows.map(({ inv, t, st }) => ({ number: inv.number, status: st, customer: inv.billTo.company, contact: inv.billTo.contactName, date: inv.invoiceDate, due: inv.dueDate, event: inv.eventName, event_number: inv.eventNumber, sales_person: inv.salesPerson, subtotal: t.net, taxes: t.taxesTotal, charges: t.chargesTotal - t.taxesTotal, total: t.total, paid: t.paid, balance: t.balance }))), "text/csv");

  return (
    <>
      <PageHeader title={title} subtitle={`${rows.length} shown${kind === "invoice" ? ` · ${money(sum)} outstanding in view` : ""}`} actions={<><button className="btn-secondary" onClick={exportCsv}>Export CSV</button><Link href={`/invoices/new${kind === "estimate" ? "?kind=estimate" : ""}`} className="btn-primary"><Plus size={16} /> New {kind}</Link></>} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]"><Search size={16} className="absolute left-3 top-2.5 text-ink-500" /><input className="input pl-9" placeholder="Search number, customer, event, PO, custom fields…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex rounded-md border border-ink-300 bg-white overflow-hidden">{FILTERS.map((f) => <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-2 text-sm ${filter === f.key ? "bg-teal-700 text-white" : "hover:bg-ink-50"}`}>{f.label}</button>)}</div>
        {store.settings.salesPeople.length > 1 && <select className="input w-auto" value={sp} onChange={(e) => setSp(e.target.value)}><option value="">All sales people</option>{store.settings.salesPeople.map((p) => <option key={p}>{p}</option>)}</select>}
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="due">By due date</option><option value="amount">Largest amount</option><option value="customer">By customer</option></select>
      </div>
      {rows.length === 0 ? <Empty title={`No ${title.toLowerCase()} match`} body="Try a different search or filter." /> : (
        <div className="card overflow-x-auto"><table className="table min-w-[760px]">
          <thead><tr><th>#</th><th>Customer</th><th>Event</th><th>Date</th><th>{kind === "invoice" ? "Due" : "Valid until"}</th><th className="text-right">Total</th>{kind === "invoice" && <th className="text-right">Balance</th>}<th className="text-right">Status</th></tr></thead>
          <tbody>{rows.map(({ inv, t, st }) => (
            <tr key={inv.id} className="hover:bg-ink-50">
              <td><Link href={`/invoices/${inv.id}`} className="font-medium text-teal-800 hover:underline">{inv.number}</Link></td>
              <td><div className="font-medium truncate max-w-[220px]">{inv.billTo.company}</div><div className="text-xs text-ink-500">{inv.billTo.contactName}</div></td>
              <td className="text-ink-700"><div className="truncate max-w-[180px]">{inv.eventName || "—"}</div>{inv.eventStart && <div className="text-xs text-ink-500">{fmtDate(inv.eventStart)}</div>}</td>
              <td className="text-ink-700 whitespace-nowrap">{fmtDate(inv.invoiceDate)}</td>
              <td className={`whitespace-nowrap ${st === "overdue" || st === "expired" ? "text-red-700 font-medium" : "text-ink-700"}`}>{fmtDate(inv.dueDate)}</td>
              <td className="text-right num">{money(t.total)}</td>
              {kind === "invoice" && <td className="text-right num font-medium">{money(t.balance)}</td>}
              <td className="text-right"><StatusBadge status={st} /></td>
            </tr>))}</tbody></table></div>)}
    </>
  );
}
