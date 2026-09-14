"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Download, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { useStore } from "@/lib/store";
import { computeTotals, derivedStatus, isOpen } from "@/lib/calc";
import { money, parseCSV, toCSV, download } from "@/lib/format";
import type { Customer } from "@/lib/types";
import CustomerForm from "@/components/CustomerForm";
import { Confirm, Empty, Modal, PageHeader } from "@/components/ui";

export default function CustomersPage() {
  const store = useStore();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Customer | null | "new">(null);
  const [del, setDel] = useState<Customer | null>(null);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return store.customers.filter((c) => !s || [c.company, c.contactName, c.email, c.city, ...(c.tags ?? [])].some((v) => v?.toLowerCase().includes(s))).map((c) => {
      const invs = store.invoices.filter((i) => i.customerId === c.id && i.status !== "void" && i.kind !== "estimate");
      const open = invs.reduce((a, i) => isOpen(derivedStatus(i, store.settings.tax)) ? a + computeTotals(i, store.settings.tax).balance : a, 0);
      const lifetime = invs.reduce((a, i) => a + computeTotals(i, store.settings.tax).total, 0);
      return { c, count: invs.length, open, lifetime };
    }).sort((a, b) => a.c.company.localeCompare(b.c.company));
  }, [store.customers, store.invoices, store.settings.tax, q]);
  async function importCsv(f: File) {
    const r = parseCSV(await f.text());
    const n = store.importCustomers(r.map((x) => ({ company: x.company ?? x.name, contactName: x.contact ?? x.contact_name ?? "", email: x.email ?? "", phone: x.phone ?? "", address1: x.address ?? x.address1 ?? "", address2: x.address2 ?? "", city: x.city ?? "", state: x.state ?? "", zip: x.zip ?? "", country: x.country || "USA", taxExempt: /^(y|yes|true|1)$/i.test(x.tax_exempt ?? ""), taxExemptId: x.tax_exempt_id ?? "", tags: (x.tags ?? "").split(/[;|]/).map((t) => t.trim()).filter(Boolean) })));
    setMsg(`Imported ${n} customer${n === 1 ? "" : "s"}.`); setTimeout(() => setMsg(""), 3000);
  }
  return (
    <>
      <PageHeader title="Customers" subtitle={`${store.customers.length} on file`} actions={<>
        <button className="btn-secondary" onClick={() => download("customers.csv", toCSV(store.customers.map((c) => ({ company: c.company, contact: c.contactName, email: c.email, phone: c.phone, address1: c.address1, address2: c.address2, city: c.city, state: c.state, zip: c.zip, country: c.country, tax_exempt: c.taxExempt ? "yes" : "no", tax_exempt_id: c.taxExemptId, tags: (c.tags ?? []).join(";") }))), "text/csv")}><Download size={15} /> Export</button>
        <button className="btn-secondary" onClick={() => fileRef.current?.click()}><Upload size={15} /> Import CSV</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
        <button className="btn-primary" onClick={() => setEdit("new")}><Plus size={16} /> New customer</button></>} />
      {msg && <div className="mb-3 text-sm text-teal-700">{msg}</div>}
      <div className="relative mb-4 max-w-md"><Search size={16} className="absolute left-3 top-2.5 text-ink-500" /><input className="input pl-9" placeholder="Search customers, tags" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <p className="text-xs text-ink-500 mb-3">CSV columns: company, contact, email, phone, address1, address2, city, state, zip, country, tax_exempt, tax_exempt_id, tags.</p>
      {rows.length === 0 ? <Empty title="No customers" body="Customers are also created automatically when you type a new company on a document." /> : (
        <div className="card overflow-x-auto"><table className="table min-w-[760px]">
          <thead><tr><th>Company</th><th>Contact</th><th>Location</th><th>Tags</th><th className="text-right">Invoices</th><th className="text-right">Open balance</th><th className="text-right">Lifetime</th><th></th></tr></thead>
          <tbody>{rows.map(({ c, count, open, lifetime }) => (
            <tr key={c.id} className="hover:bg-ink-50">
              <td className="font-medium">{c.company}{c.taxExempt && <span className="ml-2 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-teal-800">tax exempt</span>}</td>
              <td><div>{c.contactName}</div><div className="text-xs text-ink-500">{c.email}{c.phone ? ` · ${c.phone}` : ""}</div></td>
              <td className="text-ink-700">{[c.city, c.state].filter(Boolean).join(", ")}</td>
              <td className="text-xs text-ink-500">{(c.tags ?? []).join(", ")}</td>
              <td className="text-right num">{count}</td>
              <td className={`text-right num ${open > 0 ? "font-medium" : "text-ink-500"}`}>{money(open)}</td>
              <td className="text-right num text-ink-700">{money(lifetime)}</td>
              <td className="text-right whitespace-nowrap"><Link href={`/invoices/new?customer=${c.id}`} className="btn-ghost px-2 text-teal-700" title="New invoice"><Plus size={15} /></Link><button className="btn-ghost px-2" onClick={() => setEdit(c)} title="Edit"><Pencil size={15} /></button><button className="btn-ghost px-2 text-ink-500 hover:text-red-700" onClick={() => setDel(c)} title="Delete" disabled={count > 0}><Trash2 size={15} /></button></td>
            </tr>))}</tbody></table></div>)}
      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit === "new" ? "New customer" : "Edit customer"} wide><CustomerForm initial={edit && edit !== "new" ? edit : undefined} onDone={() => setEdit(null)} onCancel={() => setEdit(null)} /></Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} title={`Delete ${del?.company}?`} body="Customers with invoices can't be deleted; this one has none." confirmLabel="Delete" danger onConfirm={() => del && store.deleteCustomer(del.id)} />
    </>
  );
}
