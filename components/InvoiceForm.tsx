"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, GripVertical, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Customer, Invoice, LineItem, CatalogItem } from "@/lib/types";
import { computeTotals, dueDateFor, lineAmount } from "@/lib/calc";
import { money, num2, todayISO } from "@/lib/format";
import { uid } from "@/lib/id";
import { Field, Modal } from "./ui";
import CustomerForm from "./CustomerForm";

const TERMS = ["Due on Receipt", "Net 7", "Net 15", "Net 30", "Net 45", "Net 60", "Custom"];

export type InvoiceDraft = Omit<Invoice, "id" | "number" | "createdAt" | "updatedAt">;

export function blankDraft(s: ReturnType<typeof useStore>["settings"]): InvoiceDraft {
  const d = todayISO();
  return {
    status: "draft", customerId: "", billTo: { company: "", contactName: "", email: "", address1: "", address2: "", city: "", state: "", zip: "", country: "USA" },
    invoiceDate: d, terms: s.defaults.terms, dueDate: dueDateFor(d, s.defaults.terms), salesPerson: s.defaults.salesPerson,
    eventNumber: "", eventName: "", eventStart: "", eventEnd: "", poNumber: "",
    items: [newLine()], discount: { type: "none", value: 0, label: "" }, notes: s.defaults.notes, internalNotes: "", payments: [],
  };
}
export const newLine = (): LineItem => ({ id: uid("li"), name: "", description: "", qty: 1, rate: 0, tax: { meals: false, service: false, house: false } });

export default function InvoiceForm({ initial, invoiceId, number }: { initial: InvoiceDraft; invoiceId?: string; number: string }) {
  const store = useStore();
  const router = useRouter();
  const [inv, setInv] = useState<InvoiceDraft>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [custModal, setCustModal] = useState(false);
  const [dirty, setDirty] = useState(false);
  const totals = useMemo(() => computeTotals(inv, store.settings.taxes), [inv, store.settings.taxes]);

  const set = (patch: Partial<InvoiceDraft>) => { setInv((p) => ({ ...p, ...patch })); setDirty(true); };
  const setLine = (id: string, patch: Partial<LineItem>) => set({ items: inv.items.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

  // warn on navigation with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  function chooseCustomer(c: Customer | undefined) {
    if (!c) return set({ customerId: "" });
    set({ customerId: c.id, billTo: { company: c.company, contactName: c.contactName, email: c.email, address1: c.address1, address2: c.address2, city: c.city, state: c.state, zip: c.zip, country: c.country } });
  }
  function onTerms(terms: string) {
    set({ terms, dueDate: terms === "Custom" ? inv.dueDate : dueDateFor(inv.invoiceDate, terms) });
  }
  function onInvoiceDate(invoiceDate: string) {
    set({ invoiceDate, dueDate: inv.terms === "Custom" ? inv.dueDate : dueDateFor(invoiceDate, inv.terms) });
  }
  function pickCatalog(lineId: string, item: CatalogItem) {
    setLine(lineId, { catalogItemId: item.id, name: item.name, description: item.description, rate: item.rate, tax: { ...item.tax } });
  }
  function addLine(after?: string) {
    const nl = newLine();
    if (!after) return set({ items: [...inv.items, nl] });
    const idx = inv.items.findIndex((l) => l.id === after);
    set({ items: [...inv.items.slice(0, idx + 1), nl, ...inv.items.slice(idx + 1)] });
    setTimeout(() => document.getElementById(`name-${nl.id}`)?.focus(), 0);
  }
  function move(id: string, dir: -1 | 1) {
    const i = inv.items.findIndex((l) => l.id === id);
    const j = i + dir;
    if (j < 0 || j >= inv.items.length) return;
    const items = [...inv.items];
    [items[i], items[j]] = [items[j], items[i]];
    set({ items });
  }

  function validate(): string[] {
    const e: string[] = [];
    if (!inv.billTo.company.trim()) e.push("Choose or enter a customer to bill.");
    if (!inv.invoiceDate) e.push("Invoice date is required.");
    if (!inv.dueDate) e.push("Due date is required.");
    if (inv.dueDate < inv.invoiceDate) e.push("Due date can't be before the invoice date.");
    const real = inv.items.filter((l) => l.name.trim());
    if (real.length === 0) e.push("Add at least one line item.");
    for (const l of real) {
      if (!(l.qty > 0)) e.push(`"${l.name}" needs a quantity greater than zero.`);
      if (l.rate < 0) e.push(`"${l.name}" has a negative rate.`);
    }
    if (inv.eventStart && inv.eventEnd && inv.eventEnd < inv.eventStart) e.push("Event end date is before the start date.");
    return e;
  }

  function save(status?: "draft" | "sent") {
    const errs = validate();
    setErrors(errs);
    if (errs.length) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const clean: InvoiceDraft = { ...inv, items: inv.items.filter((l) => l.name.trim()).map((l) => ({ ...l, qty: +l.qty, rate: +l.rate })) };
    if (status) clean.status = status;
    if (status === "sent" && !clean.sentAt) clean.sentAt = new Date().toISOString();
    // auto-create the customer when the user typed a new company inline
    if (!clean.customerId && clean.billTo.company.trim()) {
      const c = store.upsertCustomer({ ...clean.billTo, phone: "", notes: "" });
      clean.customerId = c.id;
    }
    setDirty(false);
    if (invoiceId) { store.updateInvoice(invoiceId, clean); router.push(`/invoices/${invoiceId}`); }
    else { const created = store.createInvoice(clean); router.push(`/invoices/${created.id}`); }
  }

  const customer = store.customers.find((c) => c.id === inv.customerId);

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-6">
        {errors.length > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <div className="font-medium mb-1">Please fix the following before saving:</div>
            <ul className="list-disc pl-5 space-y-0.5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}

        {/* Customer */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Bill To</h2>
            <button className="btn-ghost text-teal-700" onClick={() => setCustModal(true)}><Plus size={14} /> New customer</button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Customer" className="sm:col-span-2">
              <CustomerPicker customers={store.customers} value={customer} typed={inv.billTo.company} onPick={chooseCustomer} onType={(company) => set({ customerId: "", billTo: { ...inv.billTo, company } })} />
            </Field>
            <Field label="Contact name"><input className="input" value={inv.billTo.contactName} onChange={(e) => set({ billTo: { ...inv.billTo, contactName: e.target.value } })} /></Field>
            <Field label="Email"><input className="input" type="email" value={inv.billTo.email} onChange={(e) => set({ billTo: { ...inv.billTo, email: e.target.value } })} /></Field>
            <Field label="Address"><input className="input" value={inv.billTo.address1} onChange={(e) => set({ billTo: { ...inv.billTo, address1: e.target.value } })} /></Field>
            <Field label="Address line 2"><input className="input" value={inv.billTo.address2} onChange={(e) => set({ billTo: { ...inv.billTo, address2: e.target.value } })} /></Field>
            <div className="grid grid-cols-[1fr_70px_90px] gap-2 sm:col-span-2 md:col-span-1">
              <Field label="City"><input className="input" value={inv.billTo.city} onChange={(e) => set({ billTo: { ...inv.billTo, city: e.target.value } })} /></Field>
              <Field label="State"><input className="input" value={inv.billTo.state} onChange={(e) => set({ billTo: { ...inv.billTo, state: e.target.value } })} /></Field>
              <Field label="ZIP"><input className="input" value={inv.billTo.zip} onChange={(e) => set({ billTo: { ...inv.billTo, zip: e.target.value } })} /></Field>
            </div>
            <Field label="Country"><input className="input" value={inv.billTo.country} onChange={(e) => set({ billTo: { ...inv.billTo, country: e.target.value } })} /></Field>
          </div>
        </section>

        {/* Details */}
        <section className="card p-5">
          <h2 className="font-semibold mb-3">Invoice details</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Invoice #"><input className="input bg-ink-50" value={number} readOnly /></Field>
            <Field label="Invoice date"><input className="input" type="date" value={inv.invoiceDate} onChange={(e) => onInvoiceDate(e.target.value)} /></Field>
            <Field label="Terms">
              <select className="input" value={inv.terms} onChange={(e) => onTerms(e.target.value)}>{TERMS.map((t) => <option key={t}>{t}</option>)}</select>
            </Field>
            <Field label="Due date"><input className="input" type="date" value={inv.dueDate} onChange={(e) => set({ dueDate: e.target.value, terms: "Custom" })} /></Field>
            <Field label="Sales person">
              <input className="input" list="salespeople" value={inv.salesPerson} onChange={(e) => set({ salesPerson: e.target.value })} />
              <datalist id="salespeople">{store.settings.salesPeople.map((s) => <option key={s} value={s} />)}</datalist>
            </Field>
            <Field label="P.O. number"><input className="input" value={inv.poNumber} onChange={(e) => set({ poNumber: e.target.value })} placeholder="Optional" /></Field>
            <Field label="Event number"><input className="input" value={inv.eventNumber} onChange={(e) => set({ eventNumber: e.target.value })} placeholder="e.g. 002556" /></Field>
            <Field label="Event name" className="lg:col-span-2"><input className="input" value={inv.eventName} onChange={(e) => set({ eventName: e.target.value })} placeholder="e.g. Annual Sales Kickoff" /></Field>
            <Field label="Event start"><input className="input" type="date" value={inv.eventStart} onChange={(e) => set({ eventStart: e.target.value, eventEnd: inv.eventEnd || e.target.value })} /></Field>
            <Field label="Event end"><input className="input" type="date" value={inv.eventEnd} min={inv.eventStart || undefined} onChange={(e) => set({ eventEnd: e.target.value })} /></Field>
          </div>
        </section>

        {/* Line items */}
        <section className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100">
            <h2 className="font-semibold">Line items</h2>
            <div className="text-xs text-ink-500 hidden sm:block">Tip: start typing to pick from the price list · Enter adds a new row</div>
          </div>
          <div className="overflow-x-auto">
            <table className="table min-w-[760px]">
              <thead><tr>
                <th className="w-8"></th><th>Item & description</th><th className="w-24 text-right">Qty</th><th className="w-28 text-right">Rate</th><th className="w-36">Charges</th><th className="w-28 text-right">Amount</th><th className="w-10"></th>
              </tr></thead>
              <tbody>
                {inv.items.map((l, idx) => (
                  <tr key={l.id} className="group">
                    <td className="text-ink-300 align-top pt-3">
                      <div className="flex flex-col items-center">
                        <button tabIndex={-1} className="hover:text-ink-700" onClick={() => move(l.id, -1)} title="Move up" aria-label="Move up">▲</button>
                        <GripVertical size={14} />
                        <button tabIndex={-1} className="hover:text-ink-700" onClick={() => move(l.id, 1)} title="Move down" aria-label="Move down">▼</button>
                      </div>
                    </td>
                    <td className="align-top">
                      <ItemTypeahead id={`name-${l.id}`} value={l.name} catalog={store.catalog} onChange={(v) => setLine(l.id, { name: v, catalogItemId: undefined })} onPick={(it) => pickCatalog(l.id, it)} onEnter={() => addLine(l.id)} />
                      <input className="input mt-1 text-xs py-1" placeholder="Description (optional)" value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} />
                    </td>
                    <td className="align-top"><input className="input text-right num" type="number" min={0} step="any" value={l.qty} onChange={(e) => setLine(l.id, { qty: e.target.value === "" ? 0 : +e.target.value })} onFocus={(e) => e.target.select()} /></td>
                    <td className="align-top"><input className="input text-right num" type="number" min={0} step="0.01" value={l.rate} onChange={(e) => setLine(l.id, { rate: e.target.value === "" ? 0 : +e.target.value })} onFocus={(e) => e.target.select()} /></td>
                    <td className="align-top pt-3">
                      <TaxChips value={l.tax} onChange={(tax) => setLine(l.id, { tax })} />
                    </td>
                    <td className="align-top text-right num pt-3 font-medium">{num2(lineAmount(l))}</td>
                    <td className="align-top pt-2.5"><button className="btn-ghost px-1.5 py-1 text-ink-500 hover:text-red-700" onClick={() => set({ items: inv.items.length === 1 ? [newLine()] : inv.items.filter((x) => x.id !== l.id) })} aria-label={`Remove row ${idx + 1}`}><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-ink-100 flex flex-wrap items-center gap-3">
            <button className="btn-secondary" onClick={() => addLine()}><Plus size={14} /> Add line</button>
            <QuickAdd catalog={store.catalog} onPick={(it) => {
              const nl = { ...newLine(), catalogItemId: it.id, name: it.name, description: it.description, rate: it.rate, tax: { ...it.tax } };
              const last = inv.items[inv.items.length - 1];
              const items = last && !last.name.trim() ? [...inv.items.slice(0, -1), nl] : [...inv.items, nl];
              set({ items });
            }} />
          </div>
        </section>

        {/* Notes */}
        <section className="card p-5 grid md:grid-cols-2 gap-4">
          <Field label="Notes (printed on invoice)"><textarea className="input min-h-[90px]" value={inv.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
          <Field label="Internal notes (staff only, never printed)"><textarea className="input min-h-[90px]" value={inv.internalNotes} onChange={(e) => set({ internalNotes: e.target.value })} placeholder="e.g. Client asked for split billing next time" /></Field>
        </section>
      </div>

      {/* Summary */}
      <aside className="card p-5 lg:sticky lg:top-6 space-y-3">
        <h2 className="font-semibold">Summary</h2>
        <Row k="Subtotal" v={num2(totals.subtotal)} />
        <div className="flex items-center gap-2 text-sm">
          <select className="input py-1 w-28" value={inv.discount.type} onChange={(e) => set({ discount: { ...inv.discount, type: e.target.value as InvoiceDraft["discount"]["type"] } })}>
            <option value="none">No discount</option><option value="percent">Discount %</option><option value="amount">Discount $</option>
          </select>
          {inv.discount.type !== "none" && <input className="input py-1 w-20 text-right num" type="number" min={0} step="0.01" value={inv.discount.value} onChange={(e) => set({ discount: { ...inv.discount, value: +e.target.value } })} />}
          {inv.discount.type !== "none" && <span className="ml-auto num text-ink-700">-{num2(totals.discount)}</span>}
        </div>
        {inv.discount.type !== "none" && <input className="input py-1 text-xs" placeholder="Discount label (e.g. Non-profit rate)" value={inv.discount.label} onChange={(e) => set({ discount: { ...inv.discount, label: e.target.value } })} />}
        {totals.lines.map((l) => <Row key={l.label} k={l.label} v={num2(l.amount)} muted />)}
        {totals.lines.length === 0 && <div className="text-xs text-ink-500">No taxable food & beverage items yet. Meals tax, service and house charges apply per line via the chips.</div>}
        <div className="border-t border-ink-100 pt-3"><Row k="Total" v={money(totals.total)} bold /></div>
        {totals.paid > 0 && <Row k="Paid" v={`-${num2(totals.paid)}`} muted />}
        <div className="rounded-md bg-teal-50 px-3 py-2 flex justify-between font-semibold text-teal-900"><span>Balance due</span><span className="num">{money(totals.balance)}</span></div>

        <div className="pt-2 flex flex-col gap-2">
          <button className="btn-primary justify-center" onClick={() => save(inv.status === "draft" ? "sent" : undefined)}>{invoiceId && inv.status !== "draft" ? "Save changes" : "Save & mark as sent"}</button>
          {(inv.status === "draft" || !invoiceId) && <button className="btn-secondary justify-center" onClick={() => save("draft")}>Save as draft</button>}
          <button className="btn-ghost justify-center" onClick={() => router.back()}>Cancel</button>
        </div>
        <p className="text-xs text-ink-500">Taxes follow the rates in Settings: meals {+(store.settings.taxes.mealsTaxRate * 100).toFixed(2)}%, service {+(store.settings.taxes.serviceChargeRate * 100).toFixed(2)}%, house {+(store.settings.taxes.houseChargeRate * 100).toFixed(2)}%, sales tax {+(store.settings.taxes.salesTaxRate * 100).toFixed(2)}% on charges.</p>
      </aside>

      <Modal open={custModal} onClose={() => setCustModal(false)} title="New customer" wide>
        <CustomerForm onDone={(c) => { chooseCustomer(c); setCustModal(false); }} onCancel={() => setCustModal(false)} />
      </Modal>
    </div>
  );
}

function Row({ k, v, bold, muted }: { k: string; v: string; bold?: boolean; muted?: boolean }) {
  return <div className={`flex justify-between text-sm ${bold ? "font-semibold text-base" : ""} ${muted ? "text-ink-700" : ""}`}><span className="pr-3">{k}</span><span className="num">{v}</span></div>;
}

export function TaxChips({ value, onChange }: { value: LineItem["tax"]; onChange: (t: LineItem["tax"]) => void }) {
  const chips: { k: keyof LineItem["tax"]; label: string; title: string }[] = [
    { k: "meals", label: "Meals", title: "MA meals tax" },
    { k: "service", label: "SC", title: "Service charge" },
    { k: "house", label: "HC", title: "House charge (+ sales tax on charges)" },
  ];
  const all = value.meals && value.service && value.house;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <button key={c.k} type="button" title={c.title} onClick={() => onChange({ ...value, [c.k]: !value[c.k] })}
          className={`rounded px-1.5 py-0.5 text-[11px] font-semibold border transition ${value[c.k] ? "bg-teal-700 border-teal-700 text-white" : "bg-white border-ink-300 text-ink-500 hover:border-teal-600"}`}>{c.label}</button>
      ))}
      <button type="button" title={all ? "Mark as non-taxable (rooms, AV)" : "Mark as food & beverage (all charges)"} onClick={() => onChange(all ? { meals: false, service: false, house: false } : { meals: true, service: true, house: true })} className="rounded px-1.5 py-0.5 text-[11px] text-ink-500 hover:text-teal-700">{all ? "none" : "F&B"}</button>
    </div>
  );
}

function CustomerPicker({ customers, value, typed, onPick, onType }: { customers: Customer[]; value?: Customer; typed: string; onPick: (c: Customer | undefined) => void; onType: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const q = (value ? value.company : typed).toLowerCase();
  const matches = customers.filter((c) => !q || c.company.toLowerCase().includes(q) || c.contactName.toLowerCase().includes(q)).slice(0, 8);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input className="input pr-8" placeholder="Search customers or type a new company name" value={value ? value.company : typed} onFocus={() => setOpen(true)} onChange={(e) => { onType(e.target.value); setOpen(true); }} />
        <ChevronDown size={16} className="absolute right-2.5 top-2.5 text-ink-500 pointer-events-none" />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full card max-h-64 overflow-auto">
          {matches.map((c) => (
            <button key={c.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50" onMouseDown={() => { onPick(c); setOpen(false); }}>
              <div className="font-medium">{c.company}</div>
              <div className="text-xs text-ink-500">{[c.contactName, c.city && `${c.city}, ${c.state}`].filter(Boolean).join(" · ")}</div>
            </button>
          ))}
          {matches.length === 0 && <div className="px-3 py-2 text-sm text-ink-500">No matches — “{typed}” will be saved as a new customer.</div>}
        </div>
      )}
    </div>
  );
}

function ItemTypeahead({ id, value, catalog, onChange, onPick, onEnter }: { id: string; value: string; catalog: CatalogItem[]; onChange: (v: string) => void; onPick: (c: CatalogItem) => void; onEnter: () => void }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const q = value.toLowerCase();
  const matches = catalog.filter((c) => c.active && (!q || c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q))).slice(0, 8);
  return (
    <div className="relative">
      <input id={id} className="input" placeholder="Item name" value={value} autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)); setOpen(true); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); if (open && matches[hi]) { onPick(matches[hi]); setOpen(false); } else onEnter(); }
          else if (e.key === "Escape") setOpen(false);
        }} />
      {open && matches.length > 0 && (
        <div className="absolute z-20 mt-1 w-[420px] max-w-[80vw] card max-h-64 overflow-auto">
          {matches.map((c, i) => (
            <button key={c.id} type="button" className={`w-full text-left px-3 py-2 text-sm flex justify-between gap-3 ${i === hi ? "bg-teal-50" : "hover:bg-ink-50"}`} onMouseDown={() => { onPick(c); setOpen(false); }}>
              <span><span className="font-medium">{c.name}</span><span className="text-xs text-ink-500 ml-2">{c.category}</span></span>
              <span className="num text-ink-700 whitespace-nowrap">{num2(c.rate)} <span className="text-xs text-ink-500">/{c.unit}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickAdd({ catalog, onPick }: { catalog: CatalogItem[]; onPick: (c: CatalogItem) => void }) {
  const cats = Array.from(new Set(catalog.filter((c) => c.active).map((c) => c.category)));
  return (
    <select className="input w-auto py-2" value="" onChange={(e) => { const it = catalog.find((c) => c.id === e.target.value); if (it) onPick(it); }}>
      <option value="">Quick add from price list…</option>
      {cats.map((cat) => (
        <optgroup key={cat} label={cat}>{catalog.filter((c) => c.active && c.category === cat).map((c) => <option key={c.id} value={c.id}>{c.name} — {num2(c.rate)}</option>)}</optgroup>
      ))}
    </select>
  );
}
