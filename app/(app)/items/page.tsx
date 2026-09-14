"use client";
import { useMemo, useRef, useState } from "react";
import { Download, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { useStore } from "@/lib/store";
import { num2, parseCSV, toCSV, download } from "@/lib/format";
import { rulesForLine } from "@/lib/engine";
import type { CatalogItem } from "@/lib/types";
import { Confirm, Empty, Field, Modal, PageHeader } from "@/components/ui";

export default function ItemsPage() {
  const store = useStore();
  const s = store.settings;
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<CatalogItem | "new" | null>(null);
  const [del, setDel] = useState<CatalogItem | null>(null);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const rows = useMemo(() => { const x = q.toLowerCase(); return store.catalog.filter((c) => !x || c.name.toLowerCase().includes(x) || c.category.toLowerCase().includes(x) || c.sku?.toLowerCase().includes(x)); }, [store.catalog, q]);
  const cats = [...s.categories, ...store.catalog.map((c) => c.category).filter((c) => !s.categories.includes(c))];
  const grouped = cats.map((cat) => ({ cat, items: rows.filter((r) => r.category === cat) })).filter((g) => g.items.length);
  const className = (id: string) => s.tax.classes.find((c) => c.id === id)?.name ?? "—";
  const chargesFor = (it: CatalogItem) => rulesForLine({ id: "", name: "", description: "", qty: 1, rate: 0, taxClassId: it.taxClassId }, s.tax.rules.filter((r) => r.active)).map((r) => r.printLabel).join(", ") || "none";
  async function importCsv(f: File) {
    const rows = parseCSV(await f.text());
    const byName = (n: string) => s.tax.classes.find((c) => c.name.toLowerCase() === n.toLowerCase())?.id;
    const n = store.importCatalog(rows.map((r) => ({ name: r.name ?? r.item, description: r.description ?? "", category: r.category || "Other", rate: Number(r.rate ?? r.price) || 0, unit: r.unit || "each", sku: r.sku, taxClassId: byName(r.tax_class ?? "") ?? s.tax.defaultClassId })));
    setMsg(`Imported ${n} item${n === 1 ? "" : "s"}.`); setTimeout(() => setMsg(""), 3000);
  }
  return (
    <>
      <PageHeader title="Items & Pricing" subtitle="The price list your team picks from. Each item carries a tax class; the charge rules decide what that class pays." actions={<>
        <button className="btn-secondary" onClick={() => download("items.csv", toCSV(store.catalog.map((c) => ({ name: c.name, description: c.description, category: c.category, rate: c.rate, unit: c.unit, sku: c.sku ?? "", tax_class: className(c.taxClassId), active: c.active }))), "text/csv")}><Download size={15} /> Export</button>
        <button className="btn-secondary" onClick={() => fileRef.current?.click()}><Upload size={15} /> Import CSV</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
        <button className="btn-primary" onClick={() => setEdit("new")}><Plus size={16} /> New item</button></>} />
      {msg && <div className="mb-3 text-sm text-teal-700">{msg}</div>}
      <div className="relative mb-4 max-w-md"><Search size={16} className="absolute left-3 top-2.5 text-ink-500" /><input className="input pl-9" placeholder="Search items, categories, SKU" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <p className="text-xs text-ink-500 mb-3">CSV columns: name, description, category, rate, unit, sku, tax_class (by name).</p>
      {grouped.length === 0 ? <Empty title="No items" /> : grouped.map(({ cat, items }) => (
        <section key={cat} className="card mb-4 overflow-x-auto">
          <div className="px-4 py-2.5 border-b border-ink-100 font-semibold text-sm">{cat}</div>
          <table className="table min-w-[720px]"><thead><tr><th>Item</th><th>Description</th><th className="text-right">Rate</th><th>Unit</th><th>Tax class</th><th>Charges</th><th></th></tr></thead>
            <tbody>{items.map((it) => (
              <tr key={it.id} className={`hover:bg-ink-50 ${it.active ? "" : "opacity-50"}`}>
                <td className="font-medium">{it.name}{it.sku && <span className="ml-2 text-xs text-ink-500 font-mono">{it.sku}</span>}{!it.active && <span className="ml-2 text-xs text-ink-500">(inactive)</span>}</td>
                <td className="text-ink-700 text-xs max-w-[240px] truncate">{it.description}</td>
                <td className="text-right num">{num2(it.rate)}</td><td className="text-ink-700">{it.unit}</td>
                <td><select className="input py-1 text-xs w-auto" value={it.taxClassId} onChange={(e) => store.upsertCatalogItem({ ...it, taxClassId: e.target.value })}>{s.tax.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
                <td className="text-xs text-ink-500 max-w-[220px]">{chargesFor(it)}</td>
                <td className="text-right whitespace-nowrap"><button className="btn-ghost px-2" onClick={() => setEdit(it)}><Pencil size={15} /></button><button className="btn-ghost px-2 text-ink-500 hover:text-red-700" onClick={() => setDel(it)}><Trash2 size={15} /></button></td>
              </tr>))}</tbody></table>
        </section>))}
      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit === "new" ? "New item" : "Edit item"}>{edit !== null && <ItemForm initial={edit === "new" ? undefined : edit} onDone={() => setEdit(null)} />}</Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} title={`Delete "${del?.name}"?`} body="Existing documents keep their lines; this only removes it from the price list. Consider marking it inactive instead." confirmLabel="Delete" danger onConfirm={() => del && store.deleteCatalogItem(del.id)} />
    </>
  );
}

function ItemForm({ initial, onDone }: { initial?: CatalogItem; onDone: () => void }) {
  const store = useStore();
  const s = store.settings;
  const [it, setIt] = useState<Partial<CatalogItem> & { name: string }>(initial ?? { name: "", description: "", category: s.categories[0] ?? "Other", rate: 0, unit: s.units[0] ?? "each", taxClassId: s.tax.defaultClassId, active: true, sku: "" });
  const [err, setErr] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!it.name.trim()) return setErr("Item name is required."); store.upsertCatalogItem(it); onDone(); }} className="grid grid-cols-2 gap-4">
      <Field label="Name" className="col-span-2"><input className="input" autoFocus value={it.name} onChange={(e) => setIt({ ...it, name: e.target.value })} /></Field>
      <Field label="Description (printed under the item)" className="col-span-2"><input className="input" value={it.description ?? ""} onChange={(e) => setIt({ ...it, description: e.target.value })} /></Field>
      <Field label="Category"><input className="input" list="cats" value={it.category} onChange={(e) => setIt({ ...it, category: e.target.value })} /><datalist id="cats">{s.categories.map((c) => <option key={c} value={c} />)}</datalist></Field>
      <Field label="SKU / code"><input className="input" value={it.sku ?? ""} onChange={(e) => setIt({ ...it, sku: e.target.value })} /></Field>
      <Field label="Rate"><input className="input num" type="number" step="0.01" min={0} value={it.rate ?? 0} onChange={(e) => setIt({ ...it, rate: +e.target.value })} /></Field>
      <Field label="Unit"><input className="input" list="units2" value={it.unit ?? ""} onChange={(e) => setIt({ ...it, unit: e.target.value })} /><datalist id="units2">{s.units.map((u) => <option key={u} value={u} />)}</datalist></Field>
      <Field label="Tax class" className="col-span-2" hint={s.tax.classes.find((c) => c.id === it.taxClassId)?.description}><select className="input" value={it.taxClassId} onChange={(e) => setIt({ ...it, taxClassId: e.target.value })}>{s.tax.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={it.active ?? true} onChange={(e) => setIt({ ...it, active: e.target.checked })} /> Active (shown in the picker)</label>
      {err && <p className="col-span-2 text-sm text-red-700">{err}</p>}
      <div className="col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onDone}>Cancel</button><button className="btn-primary">{initial ? "Save item" : "Add item"}</button></div>
    </form>
  );
}
