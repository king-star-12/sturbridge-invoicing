"use client";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useStore } from "@/lib/store";
import { computeTotals, derivedStatus, isOpen } from "@/lib/calc";
import { daysBetween, download, fmtDate, money, monthKey, toCSV, todayISO } from "@/lib/format";
import { PageHeader, Tabs } from "@/components/ui";

type Tab = "aging" | "tax" | "sales" | "customers";

export default function ReportsPage() {
  const store = useStore();
  const s = store.settings;
  const [tab, setTab] = useState<Tab>("aging");
  const today = todayISO();
  const [from, setFrom] = useState(() => `${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const docs = useMemo(() => store.invoices.filter((i) => i.kind !== "estimate" && i.status !== "void" && i.status !== "draft").map((inv) => ({ inv, t: computeTotals(inv, s.tax), st: derivedStatus(inv, s.tax, today) })), [store.invoices, s.tax, today]);
  const inRange = docs.filter((d) => d.inv.invoiceDate >= from && d.inv.invoiceDate <= to);

  /* Aging */
  const buckets = ["Current", "1–30", "31–60", "61–90", "90+"];
  const aging = useMemo(() => {
    const byCust = new Map<string, number[]>();
    for (const d of docs.filter((x) => isOpen(x.st))) {
      const late = daysBetween(d.inv.dueDate, today);
      const b = late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
      const row = byCust.get(d.inv.billTo.company) ?? [0, 0, 0, 0, 0];
      row[b] += d.t.balance; byCust.set(d.inv.billTo.company, row);
    }
    return [...byCust.entries()].map(([customer, b]) => ({ customer, b, total: b.reduce((a, x) => a + x, 0) })).sort((a, c) => c.total - a.total);
  }, [docs, today]);
  const agingTotals = buckets.map((_, i) => aging.reduce((a, r) => a + r.b[i], 0));

  /* Tax liability by rule by month (accrual: by invoice date) */
  const taxRows = useMemo(() => {
    const m = new Map<string, Map<string, { base: number; amount: number }>>();
    for (const d of inRange) for (const c of d.t.charges) {
      const k = monthKey(d.inv.invoiceDate); const mm = m.get(k) ?? new Map(); const cur = mm.get(c.rule.id) ?? { base: 0, amount: 0 };
      cur.base += c.base; cur.amount += c.amount; mm.set(c.rule.id, cur); m.set(k, mm);
    }
    return [...m.entries()].sort().flatMap(([month, mm]) => [...mm.entries()].map(([rid, v]) => { const r = s.tax.rules.find((x) => x.id === rid); return { month, rule: r?.printLabel ?? rid, kind: r?.kind ?? "?", passThrough: r?.passThrough ?? false, base: v.base, amount: v.amount }; }));
  }, [inRange, s.tax.rules]);

  /* Sales by tax class and by sales person */
  const byClass = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of inRange) d.inv.items.forEach((li, i) => { const k = s.tax.classes.find((c) => c.id === li.taxClassId)?.name ?? li.taxClassId; m.set(k, (m.get(k) ?? 0) + d.t.lines[i].net); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [inRange, s.tax.classes]);
  const bySales = useMemo(() => {
    const m = new Map<string, { count: number; net: number; total: number }>();
    for (const d of inRange) { const k = d.inv.salesPerson || "—"; const cur = m.get(k) ?? { count: 0, net: 0, total: 0 }; cur.count++; cur.net += d.t.net; cur.total += d.t.total; m.set(k, cur); }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [inRange]);
  const byCustomer = useMemo(() => {
    const m = new Map<string, { count: number; total: number; paid: number }>();
    for (const d of inRange) { const k = d.inv.billTo.company; const cur = m.get(k) ?? { count: 0, total: 0, paid: 0 }; cur.count++; cur.total += d.t.total; cur.paid += d.t.paid; m.set(k, cur); }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [inRange]);
  const grand = { net: inRange.reduce((a, d) => a + d.t.net, 0), taxes: inRange.reduce((a, d) => a + d.t.taxesTotal, 0), charges: inRange.reduce((a, d) => a + d.t.chargesTotal - d.t.taxesTotal, 0), total: inRange.reduce((a, d) => a + d.t.total, 0), passThrough: inRange.reduce((a, d) => a + d.t.passThroughTotal, 0) };

  return (
    <>
      <PageHeader title="Reports" subtitle="Accrual basis (by invoice date). Drafts, voids and estimates are excluded." actions={<div className="flex items-center gap-2 text-sm"><input className="input w-auto py-1.5" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><span className="text-ink-500">to</span><input className="input w-auto py-1.5" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>} />
      <Tabs tabs={[{ key: "aging", label: "A/R aging" }, { key: "tax", label: "Tax liability" }, { key: "sales", label: "Sales" }, { key: "customers", label: "Customers" }]} value={tab} onChange={setTab} />

      {tab === "aging" && (<section className="card overflow-x-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100"><div><h2 className="font-semibold">Accounts receivable aging</h2><p className="text-xs text-ink-500">Open balances as of {fmtDate(today, "long")}, by days past due.</p></div><button className="btn-secondary" onClick={() => download(`aging-${today}.csv`, toCSV(aging.map((r) => ({ customer: r.customer, current: r.b[0], d1_30: r.b[1], d31_60: r.b[2], d61_90: r.b[3], d90_plus: r.b[4], total: r.total }))), "text/csv")}><Download size={15} /> CSV</button></div>
        <table className="table min-w-[640px]"><thead><tr><th>Customer</th>{buckets.map((b) => <th key={b} className="text-right">{b}</th>)}<th className="text-right">Total</th></tr></thead>
          <tbody>{aging.map((r) => <tr key={r.customer}><td className="font-medium">{r.customer}</td>{r.b.map((v, i) => <td key={i} className={`text-right num ${i >= 2 && v > 0 ? "text-red-700" : ""}`}>{v ? money(v) : "—"}</td>)}<td className="text-right num font-medium">{money(r.total)}</td></tr>)}
            {aging.length === 0 && <tr><td colSpan={7} className="text-center text-ink-500 py-6">Nothing outstanding.</td></tr>}</tbody>
          <tfoot><tr className="font-semibold"><td>Total</td>{agingTotals.map((v, i) => <td key={i} className="text-right num">{money(v)}</td>)}<td className="text-right num">{money(agingTotals.reduce((a, x) => a + x, 0))}</td></tr></tfoot></table>
      </section>)}

      {tab === "tax" && (<section className="card overflow-x-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100"><div><h2 className="font-semibold">Tax & charge liability by month</h2><p className="text-xs text-ink-500">What was charged under each rule, with the base it was computed on. Hand this to the accountant for the meals-tax and room-occupancy returns.</p></div><button className="btn-secondary" onClick={() => download(`tax-liability-${from}-${to}.csv`, toCSV(taxRows), "text/csv")}><Download size={15} /> CSV</button></div>
        <table className="table min-w-[640px]"><thead><tr><th>Month</th><th>Rule</th><th>Kind</th><th className="text-right">Taxable base</th><th className="text-right">Amount</th></tr></thead>
          <tbody>{taxRows.map((r, i) => <tr key={i}><td>{r.month}</td><td>{r.rule}{r.passThrough && <span className="ml-2 text-[10px] uppercase text-ink-500">pass-through</span>}</td><td className="text-ink-700 capitalize">{r.kind}</td><td className="text-right num">{money(r.base)}</td><td className="text-right num font-medium">{money(r.amount)}</td></tr>)}
            {taxRows.length === 0 && <tr><td colSpan={5} className="text-center text-ink-500 py-6">No charges in this range.</td></tr>}</tbody>
          <tfoot><tr className="font-semibold"><td colSpan={4}>Taxes (remit)</td><td className="text-right num">{money(grand.taxes)}</td></tr><tr><td colSpan={4} className="text-ink-700">Service charges & fees (revenue)</td><td className="text-right num">{money(grand.charges - grand.passThrough)}</td></tr>{grand.passThrough > 0 && <tr><td colSpan={4} className="text-ink-700">Pass-through (gratuity)</td><td className="text-right num">{money(grand.passThrough)}</td></tr>}</tfoot></table>
      </section>)}

      {tab === "sales" && (<div className="grid lg:grid-cols-2 gap-6">
        <section className="card"><div className="px-5 py-3 border-b border-ink-100"><h2 className="font-semibold">Revenue by tax class</h2><p className="text-xs text-ink-500">Net of discounts, before charges. {inRange.length} invoice{inRange.length === 1 ? "" : "s"}.</p></div>
          <table className="table"><tbody>{byClass.map(([k, v]) => <tr key={k}><td>{k}</td><td className="text-right num">{money(v)}</td><td className="text-right text-xs text-ink-500 w-16">{grand.net ? `${((v / grand.net) * 100).toFixed(1)}%` : ""}</td></tr>)}</tbody><tfoot><tr className="font-semibold"><td>Net sales</td><td className="text-right num">{money(grand.net)}</td><td></td></tr><tr><td className="text-ink-700">+ charges & taxes</td><td className="text-right num">{money(grand.total - grand.net)}</td><td></td></tr><tr className="font-semibold"><td>Invoiced</td><td className="text-right num">{money(grand.total)}</td><td></td></tr></tfoot></table></section>
        <section className="card"><div className="px-5 py-3 border-b border-ink-100"><h2 className="font-semibold">By sales person</h2></div>
          <table className="table"><thead><tr><th>Sales person</th><th className="text-right">Invoices</th><th className="text-right">Net</th><th className="text-right">Invoiced</th></tr></thead><tbody>{bySales.map(([k, v]) => <tr key={k}><td>{k}</td><td className="text-right num">{v.count}</td><td className="text-right num">{money(v.net)}</td><td className="text-right num font-medium">{money(v.total)}</td></tr>)}</tbody></table></section>
      </div>)}

      {tab === "customers" && (<section className="card overflow-x-auto"><div className="flex items-center justify-between px-5 py-3 border-b border-ink-100"><h2 className="font-semibold">Customers in range</h2><button className="btn-secondary" onClick={() => download(`customers-${from}-${to}.csv`, toCSV(byCustomer.map(([k, v]) => ({ customer: k, invoices: v.count, invoiced: v.total, paid: v.paid, open: v.total - v.paid }))), "text/csv")}><Download size={15} /> CSV</button></div>
        <table className="table min-w-[560px]"><thead><tr><th>Customer</th><th className="text-right">Invoices</th><th className="text-right">Invoiced</th><th className="text-right">Paid</th><th className="text-right">Open</th></tr></thead><tbody>{byCustomer.map(([k, v]) => <tr key={k}><td className="font-medium">{k}</td><td className="text-right num">{v.count}</td><td className="text-right num">{money(v.total)}</td><td className="text-right num">{money(v.paid)}</td><td className="text-right num font-medium">{money(v.total - v.paid)}</td></tr>)}</tbody></table></section>)}
    </>
  );
}
