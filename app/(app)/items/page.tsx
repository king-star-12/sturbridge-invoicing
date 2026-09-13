"use client";
import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { num2 } from "@/lib/format";
import type { CatalogItem, ItemCategory } from "@/lib/types";
import { TaxChips } from "@/components/InvoiceForm";
import { Confirm, Empty, Field, Modal, PageHeader } from "@/components/ui";

const CATS: ItemCategory[] = ["Room Rental", "Audio Visual", "Food & Beverage", "Beverage", "Guest Rooms", "Other"];

export default function ItemsPage() {
  const store = useStore();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<CatalogItem | "new" | null>(null);
  const [del, setDel] = useState<CatalogItem | null>(null);
  const rows = useMemo(() => { const s = q.toLowerCase(); return store.catalog.filter((c) => !s || c.name.toLowerCase().includes(s) || c.category.toLowerCase().includes(s)); }, [store.catalog, q]);
  const grouped = CATS.map((cat) => ({ cat, items: rows.filter((r) => r.category === cat) })).filter((g) => g.items.length);

  return (
    <>
      <PageHeader title="Items & Pricing" subtitle="The price list your team picks from when building an invoice. Charges set here are the defaults; they can be overridden per line." actions={<button className="btn-primary" onClick={() => setEdit("new")}><Plus size={16} /> New item</button>} />
      <div className="relative mb-4 max-w-md"><Search size={16} className="absolute left-3 top-2.5 text-ink-500" /><input className="input pl-9" placeholder="Search items" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {grouped.length === 0 ? <Empty title="No items" /> : grouped.map(({ cat, items }) => (
        <section key={cat} className="card mb-4 overflow-x-auto">
          <div className="px-4 py-2.5 border-b border-ink-100 font-semibold text-sm">{cat}</div>
          <table className="table min-w-[640px]"><thead><tr><th>Item</th><th>Description</th><th className="text-right">Rate</th><th>Unit</th><th>Charges</th><th></th></tr></thead>
            <tbody>{items.map((it) => (
              <tr key={it.id} className={`hover:bg-ink-50 ${it.active ? "" : "opacity-50"}`}>
                <td className="font-medium">{it.name}{!it.active && <span className="ml-2 text-xs text-ink-500">(inactive)</span>}</td>
                <td className="text-ink-700 text-xs max-w-[260px] truncate">{it.description}</td>
                <td className="text-right num">{num2(it.rate)}</td>
                <td className="text-ink-700">{it.unit}</td>
                <td><TaxChips value={it.tax} onChange={(tax) => store.upsertCatalogItem({ ...it, tax })} /></td>
                <td className="text-right whitespace-nowrap"><button className="btn-ghost px-2" onClick={() => setEdit(it)}><Pencil size={15} /></button><button className="btn-ghost px-2 text-ink-500 hover:text-red-700" onClick={() => setDel(it)}><Trash2 size={15} /></button></td>
              </tr>))}</tbody></table>
        </section>))}
      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit === "new" ? "New item" : "Edit item"}>
        {edit !== null && <ItemForm initial={edit === "new" ? undefined : edit} onDone={() => setEdit(null)} />}
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} title={`Delete "${del?.name}"?`} body="Existing invoices keep their lines; this only removes it from the price list. Consider marking it inactive instead." confirmLabel="Delete" danger onConfirm={() => del && store.deleteCatalogItem(del.id)} />
    </>
  );
}

function ItemForm({ initial, onDone }: { initial?: CatalogItem; onDone: () => void }) {
  const store = useStore();
  const [it, setIt] = useState<Partial<CatalogItem> & { name: string }>(initial ?? { name: "", description: "", category: "Food & Beverage", rate: 0, unit: "per person", tax: { meals: true, service: true, house: true }, active: true });
  const [err, setErr] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!it.name.trim()) return setErr("Item name is required."); store.upsertCatalogItem(it); onDone(); }} className="grid grid-cols-2 gap-4">
      <Field label="Name" className="col-span-2"><input className="input" autoFocus value={it.name} onChange={(e) => setIt({ ...it, name: e.target.value })} /></Field>
      <Field label="Description (printed under the item)" className="col-span-2"><input className="input" value={it.description ?? ""} onChange={(e) => setIt({ ...it, description: e.target.value })} /></Field>
      <Field label="Category"><select className="input" value={it.category} onChange={(e) => { const category = e.target.value as ItemCategory; const fnb = category === "Food & Beverage" || category === "Beverage"; setIt({ ...it, category, tax: initial ? it.tax : { meals: fnb, service: fnb, house: fnb } }); }}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Unit"><input className="input" list="units" value={it.unit ?? ""} onChange={(e) => setIt({ ...it, unit: e.target.value })} /><datalist id="units"><option value="each" /><option value="per person" /><option value="per day" /><option value="per night" /><option value="per hour" /></datalist></Field>
      <Field label="Rate"><input className="input num" type="number" step="0.01" min={0} value={it.rate ?? 0} onChange={(e) => setIt({ ...it, rate: +e.target.value })} /></Field>
      <Field label="Default charges" hint="Meals tax, service charge, house charge"><div className="pt-2"><TaxChips value={it.tax!} onChange={(tax) => setIt({ ...it, tax })} /></div></Field>
      <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={it.active ?? true} onChange={(e) => setIt({ ...it, active: e.target.checked })} /> Active (shown in the picker)</label>
      {err && <p className="col-span-2 text-sm text-red-700">{err}</p>}
      <div className="col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onDone}>Cancel</button><button className="btn-primary">{initial ? "Save item" : "Add item"}</button></div>
    </form>
  );
}
