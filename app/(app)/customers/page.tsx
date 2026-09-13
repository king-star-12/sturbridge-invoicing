"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { computeTotals, derivedStatus } from "@/lib/calc";
import { money } from "@/lib/format";
import type { Customer } from "@/lib/types";
import CustomerForm from "@/components/CustomerForm";
import { Confirm, Empty, Modal, PageHeader } from "@/components/ui";

export default function CustomersPage() {
  const store = useStore();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Customer | null | "new">(null);
  const [del, setDel] = useState<Customer | null>(null);
  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return store.customers.filter((c) => !s || [c.company, c.contactName, c.email, c.city].some((v) => v?.toLowerCase().includes(s))).map((c) => {
      const invs = store.invoices.filter((i) => i.customerId === c.id && i.status !== "void");
      const open = invs.reduce((a, i) => { const st = derivedStatus(i, store.settings.taxes); return ["sent", "partial", "overdue"].includes(st) ? a + computeTotals(i, store.settings.taxes).balance : a; }, 0);
      const lifetime = invs.reduce((a, i) => a + computeTotals(i, store.settings.taxes).total, 0);
      return { c, count: invs.length, open, lifetime };
    }).sort((a, b) => a.c.company.localeCompare(b.c.company));
  }, [store.customers, store.invoices, store.settings.taxes, q]);

  return (
    <>
      <PageHeader title="Customers" subtitle={`${store.customers.length} on file`} actions={<button className="btn-primary" onClick={() => setEdit("new")}><Plus size={16} /> New customer</button>} />
      <div className="relative mb-4 max-w-md"><Search size={16} className="absolute left-3 top-2.5 text-ink-500" /><input className="input pl-9" placeholder="Search customers" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {rows.length === 0 ? <Empty title="No customers" body="Customers are also created automatically when you type a new company on an invoice." /> : (
        <div className="card overflow-x-auto"><table className="table min-w-[680px]">
          <thead><tr><th>Company</th><th>Contact</th><th>Location</th><th className="text-right">Invoices</th><th className="text-right">Open balance</th><th className="text-right">Lifetime</th><th></th></tr></thead>
          <tbody>{rows.map(({ c, count, open, lifetime }) => (
            <tr key={c.id} className="hover:bg-ink-50">
              <td className="font-medium">{c.company}</td>
              <td><div>{c.contactName}</div><div className="text-xs text-ink-500">{c.email}{c.phone ? ` · ${c.phone}` : ""}</div></td>
              <td className="text-ink-700">{[c.city, c.state].filter(Boolean).join(", ")}</td>
              <td className="text-right num">{count}</td>
              <td className={`text-right num ${open > 0 ? "font-medium" : "text-ink-500"}`}>{money(open)}</td>
              <td className="text-right num text-ink-700">{money(lifetime)}</td>
              <td className="text-right whitespace-nowrap">
                <Link href={`/invoices/new?customer=${c.id}`} className="btn-ghost px-2 text-teal-700" title="New invoice for this customer"><Plus size={15} /></Link>
                <button className="btn-ghost px-2" onClick={() => setEdit(c)} title="Edit"><Pencil size={15} /></button>
                <button className="btn-ghost px-2 text-ink-500 hover:text-red-700" onClick={() => setDel(c)} title="Delete" disabled={count > 0}><Trash2 size={15} /></button>
              </td>
            </tr>))}</tbody></table></div>)}
      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit === "new" ? "New customer" : "Edit customer"} wide>
        <CustomerForm initial={edit && edit !== "new" ? edit : undefined} onDone={() => setEdit(null)} onCancel={() => setEdit(null)} />
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} title={`Delete ${del?.company}?`} body="Customers with invoices can't be deleted; this one has none." confirmLabel="Delete" danger onConfirm={() => del && store.deleteCustomer(del.id)} />
    </>
  );
}
