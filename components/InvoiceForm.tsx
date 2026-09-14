"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ChevronDown, GripVertical, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Customer, DocKind, Invoice, LineItem, CatalogItem, ChargeRule } from "@/lib/types";
import { computeTotals, lineNet, rulesForLine } from "@/lib/engine";
import { buildSchedule, dueDateFor, resolveSchedule } from "@/lib/calc";
import { addDays, fmtDate, money, num2, todayISO } from "@/lib/format";
import { uid } from "@/lib/id";
import { Field, Modal } from "./ui";
import CustomerForm from "./CustomerForm";

export type InvoiceDraft = Omit<Invoice, "id" | "number" | "createdAt" | "updatedAt">;

export function blankDraft(s: ReturnType<typeof useStore>["settings"], kind: DocKind = "invoice"): InvoiceDraft {
  const d = todayISO();
  return {
    kind, status: "draft", customerId: "", billTo: { company: "", contactName: "", email: "", address1: "", address2: "", city: "", state: "", zip: "", country: "USA" }, taxExempt: false,
    invoiceDate: d, terms: kind === "estimate" ? `Valid ${s.defaults.estimateValidDays} days` : s.defaults.terms, dueDate: kind === "estimate" ? addDays(d, s.defaults.estimateValidDays) : dueDateFor(d, s.defaults.terms), salesPerson: s.defaults.salesPerson,
    eventNumber: "", eventName: "", eventStart: "", eventEnd: "", poNumber: "", custom: {},
    items: [newLine(s.tax.defaultClassId)], discount: { type: "none", value: 0, label: "" }, schedule: [], notes: s.defaults.notes, internalNotes: "", payments: [], activity: [], templateId: s.defaultTemplateId,
  };
}
export const newLine = (taxClassId: string): LineItem => ({ id: uid("li"), name: "", description: "", qty: 1, rate: 0, taxClassId });

export default function InvoiceForm({ initial, invoiceId, number }: { initial: InvoiceDraft; invoiceId?: string; number: string }) {
  const store = useStore();
  const s = store.settings;
  const router = useRouter();
  const [inv, setInv] = useState<InvoiceDraft>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [custModal, setCustModal] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [depTpl, setDepTpl] = useState(s.deposits.defaultTemplateId);
  const totals = useMemo(() => computeTotals(inv, s.tax), [inv, s.tax]);
  const isEstimate = inv.kind === "estimate";
  const activeRules = useMemo(() => s.tax.rules.filter((r) => r.active), [s.tax.rules]);

  const set = (patch: Partial<InvoiceDraft>) => { setInv((p) => ({ ...p, ...patch })); setDirty(true); };
  const setLine = (id: string, patch: Partial<LineItem>) => set({ items: inv.items.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

  useEffect(() => { if (!dirty) return; const h = (e: BeforeUnloadEvent) => { e.preventDefault(); }; window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h); }, [dirty]);

  function chooseCustomer(c: Customer | undefined) {
    if (!c) return set({ customerId: "" });
    set({ customerId: c.id, taxExempt: c.taxExempt, terms: c.defaultTerms || inv.terms, dueDate: c.defaultTerms && !isEstimate ? dueDateFor(inv.invoiceDate, c.defaultTerms) : inv.dueDate, billTo: { company: c.company, contactName: c.contactName, email: c.email, address1: c.address1, address2: c.address2, city: c.city, state: c.state, zip: c.zip, country: c.country } });
  }
  function onTerms(terms: string) { set({ terms, dueDate: terms === "Custom" ? inv.dueDate : dueDateFor(inv.invoiceDate, terms) }); }
  function onInvoiceDate(invoiceDate: string) { set({ invoiceDate, dueDate: isEstimate ? addDays(invoiceDate, s.defaults.estimateValidDays) : inv.terms === "Custom" ? inv.dueDate : dueDateFor(invoiceDate, inv.terms) }); }
  function pickCatalog(lineId: string, item: CatalogItem) { setLine(lineId, { catalogItemId: item.id, name: item.name, description: item.description, rate: item.rate, unit: item.unit, taxClassId: item.taxClassId, ruleOverrides: undefined }); }
  function addLine(after?: string) {
    const nl = newLine(s.tax.defaultClassId);
    if (!after) return set({ items: [...inv.items, nl] });
    const idx = inv.items.findIndex((l) => l.id === after);
    set({ items: [...inv.items.slice(0, idx + 1), nl, ...inv.items.slice(idx + 1)] });
    setTimeout(() => document.getElementById(`name-${nl.id}`)?.focus(), 0);
  }
  function move(id: string, dir: -1 | 1) { const i = inv.items.findIndex((l) => l.id === id); const j = i + dir; if (j < 0 || j >= inv.items.length) return; const items = [...inv.items]; [items[i], items[j]] = [items[j], items[i]]; set({ items }); }
  function toggleRule(li: LineItem, rule: ChargeRule) {
    const byClass = rule.appliesToClasses.includes(li.taxClassId);
    const ov = { include: [...(li.ruleOverrides?.include ?? [])], exclude: [...(li.ruleOverrides?.exclude ?? [])] };
    const on = rulesForLine(li, [rule]).length > 0;
    if (on) { ov.include = ov.include.filter((x) => x !== rule.id); if (byClass) ov.exclude.push(rule.id); }
    else { ov.exclude = ov.exclude.filter((x) => x !== rule.id); if (!byClass) ov.include.push(rule.id); }
    setLine(li.id, { ruleOverrides: ov.include.length || ov.exclude.length ? ov : undefined });
  }
  function applySchedule(tplId: string) { setDepTpl(tplId); set({ schedule: buildSchedule(s.deposits.templates.find((t) => t.id === tplId), inv) }); }

  function validate(): string[] {
    const e: string[] = [];
    if (!inv.billTo.company.trim()) e.push("Choose or enter a customer to bill.");
    if (!inv.invoiceDate) e.push("Date is required.");
    if (!inv.dueDate) e.push(isEstimate ? "Valid-until date is required." : "Due date is required.");
    if (inv.dueDate < inv.invoiceDate) e.push("Due date can't be before the document date.");
    const real = inv.items.filter((l) => l.name.trim());
    if (real.length === 0) e.push("Add at least one line item.");
    for (const l of real) { if (!(l.qty > 0)) e.push(`"${l.name}" needs a quantity greater than zero.`); if (l.rate < 0) e.push(`"${l.name}" has a negative rate.`); }
    if (inv.eventStart && inv.eventEnd && inv.eventEnd < inv.eventStart) e.push("Event end date is before the start date.");
    for (const f of s.customFields.filter((f) => f.required && f.kinds.includes(inv.kind))) if (!inv.custom[f.id]?.trim()) e.push(`"${f.label}" is required.`);
    return e;
  }
  function save(status?: "draft" | "sent") {
    const errs = validate(); setErrors(errs);
    if (errs.length) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const clean: InvoiceDraft = { ...inv, items: inv.items.filter((l) => l.name.trim()).map((l) => ({ ...l, qty: +l.qty, rate: +l.rate })) };
    if (status) clean.status = status;
    if (status === "sent" && !clean.sentAt) clean.sentAt = new Date().toISOString();
    if (!clean.customerId && clean.billTo.company.trim()) { const c = store.upsertCustomer({ ...clean.billTo, phone: "", notes: "", taxExempt: clean.taxExempt }); clean.customerId = c.id; }
    setDirty(false);
    if (invoiceId) { store.updateInvoice(invoiceId, clean, "Edited"); router.push(`/invoices/${invoiceId}`); }
    else { const created = store.createInvoice(clean); router.push(`/invoices/${created.id}`); }
  }

  const customer = store.customers.find((c) => c.id === inv.customerId);
  const custFields = s.customFields.filter((f) => f.kinds.includes(inv.kind));
  const schedRows = inv.schedule.length ? resolveSchedule(inv.schedule, totals.total, totals.paid) : [];

  return (
    <div className="grid lg:grid-cols-[1fr_330px] gap-6 items-start">
      <div className="space-y-6">
        {errors.length > 0 && (<div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"><div className="font-medium mb-1">Please fix the following before saving:</div><ul className="list-disc pl-5 space-y-0.5">{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>)}

        <section className="card p-5">
          <div className="flex items-center justify-between mb-3"><h2 className="font-semibold">{isEstimate ? "Prepared for" : "Bill To"}</h2><button className="btn-ghost text-teal-700" onClick={() => setCustModal(true)}><Plus size={14} /> New customer</button></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Customer" className="sm:col-span-2"><CustomerPicker customers={store.customers} value={customer} typed={inv.billTo.company} onPick={chooseCustomer} onType={(company) => set({ customerId: "", billTo: { ...inv.billTo, company } })} /></Field>
            <Field label="Contact name"><input className="input" value={inv.billTo.contactName} onChange={(e) => set({ billTo: { ...inv.billTo, contactName: e.target.value } })} /></Field>
            <Field label="Email"><input className="input" type="email" value={inv.billTo.email} onChange={(e) => set({ billTo: { ...inv.billTo, email: e.target.value } })} /></Field>
            <Field label="Address"><input className="input" value={inv.billTo.address1} onChange={(e) => set({ billTo: { ...inv.billTo, address1: e.target.value } })} /></Field>
            <Field label="Address line 2"><input className="input" value={inv.billTo.address2} onChange={(e) => set({ billTo: { ...inv.billTo, address2: e.target.value } })} /></Field>
            <div className="grid grid-cols-[1fr_70px_90px] gap-2">
              <Field label="City"><input className="input" value={inv.billTo.city} onChange={(e) => set({ billTo: { ...inv.billTo, city: e.target.value } })} /></Field>
              <Field label="State"><input className="input" value={inv.billTo.state} onChange={(e) => set({ billTo: { ...inv.billTo, state: e.target.value } })} /></Field>
              <Field label="ZIP"><input className="input" value={inv.billTo.zip} onChange={(e) => set({ billTo: { ...inv.billTo, zip: e.target.value } })} /></Field>
            </div>
            <Field label="Country"><input className="input" value={inv.billTo.country} onChange={(e) => set({ billTo: { ...inv.billTo, country: e.target.value } })} /></Field>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={inv.taxExempt} onChange={(e) => set({ taxExempt: e.target.checked })} /> Tax-exempt customer <span className="text-xs text-ink-500">(drops tax rules; service and house charges still apply)</span></label>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-3">{isEstimate ? "Estimate details" : "Invoice details"}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label={isEstimate ? "Estimate #" : "Invoice #"}><input className="input bg-ink-50" value={number} readOnly /></Field>
            <Field label="Date"><input className="input" type="date" value={inv.invoiceDate} onChange={(e) => onInvoiceDate(e.target.value)} /></Field>
            {isEstimate ? <Field label="Valid until"><input className="input" type="date" value={inv.dueDate} onChange={(e) => set({ dueDate: e.target.value })} /></Field> : (<>
              <Field label="Terms"><select className="input" value={inv.terms} onChange={(e) => onTerms(e.target.value)}>{[...new Set([...s.termsOptions, inv.terms])].map((t) => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Due date"><input className="input" type="date" value={inv.dueDate} onChange={(e) => set({ dueDate: e.target.value, terms: "Custom" })} /></Field>
            </>)}
            {s.builtInFields.salesPerson && <Field label="Sales person"><input className="input" list="salespeople" value={inv.salesPerson} onChange={(e) => set({ salesPerson: e.target.value })} /><datalist id="salespeople">{s.salesPeople.map((p) => <option key={p} value={p} />)}</datalist></Field>}
            {s.builtInFields.poNumber && <Field label="P.O. number"><input className="input" value={inv.poNumber} onChange={(e) => set({ poNumber: e.target.value })} placeholder="Optional" /></Field>}
            {s.builtInFields.eventNumber && <Field label="Event number"><input className="input" value={inv.eventNumber} onChange={(e) => set({ eventNumber: e.target.value })} placeholder="e.g. 002556" /></Field>}
            {s.builtInFields.eventName && <Field label="Event name" className="lg:col-span-2"><input className="input" value={inv.eventName} onChange={(e) => set({ eventName: e.target.value })} placeholder="e.g. Annual Sales Kickoff" /></Field>}
            {s.builtInFields.eventDates && (<><Field label="Event start"><input className="input" type="date" value={inv.eventStart} onChange={(e) => set({ eventStart: e.target.value, eventEnd: inv.eventEnd || e.target.value })} /></Field><Field label="Event end"><input className="input" type="date" value={inv.eventEnd} min={inv.eventStart || undefined} onChange={(e) => set({ eventEnd: e.target.value })} /></Field></>)}
            {custFields.map((f) => (
              <Field key={f.id} label={f.label + (f.required ? " *" : "")}>
                {f.type === "select" ? <select className="input" value={inv.custom[f.id] ?? ""} onChange={(e) => set({ custom: { ...inv.custom, [f.id]: e.target.value } })}><option value="">—</option>{f.options.map((o) => <option key={o}>{o}</option>)}</select>
                  : <input className="input" type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} value={inv.custom[f.id] ?? ""} onChange={(e) => set({ custom: { ...inv.custom, [f.id]: e.target.value } })} />}
              </Field>))}
            <Field label="Document template"><select className="input" value={inv.templateId ?? s.defaultTemplateId} onChange={(e) => set({ templateId: e.target.value })}>{s.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          </div>
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100"><h2 className="font-semibold">Line items</h2><div className="text-xs text-ink-500 hidden sm:block">Type to pick from the price list · Enter adds a row · click a charge chip to override it for one line</div></div>
          <div className="overflow-x-auto">
            <table className="table min-w-[860px]">
              <thead><tr><th className="w-8"></th><th>Item & description</th><th className="w-20 text-right">Qty</th><th className="w-28 text-right">Rate</th><th className="w-36">Tax class</th><th className="w-44">Charges</th><th className="w-28 text-right">Amount</th><th className="w-10"></th></tr></thead>
              <tbody>
                {inv.items.map((l, idx) => (
                  <tr key={l.id} className="group">
                    <td className="text-ink-300 align-top pt-3"><div className="flex flex-col items-center"><button tabIndex={-1} className="hover:text-ink-700" onClick={() => move(l.id, -1)} aria-label="Move up">▲</button><GripVertical size={14} /><button tabIndex={-1} className="hover:text-ink-700" onClick={() => move(l.id, 1)} aria-label="Move down">▼</button></div></td>
                    <td className="align-top">
                      <ItemTypeahead id={`name-${l.id}`} value={l.name} catalog={store.catalog} onChange={(v) => setLine(l.id, { name: v, catalogItemId: undefined })} onPick={(it) => pickCatalog(l.id, it)} onEnter={() => addLine(l.id)} />
                      <input className="input mt-1 text-xs py-1" placeholder="Description (optional)" value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} />
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <select className="input py-0.5 w-auto text-xs" value={l.discount?.type ?? "none"} onChange={(e) => setLine(l.id, { discount: e.target.value === "none" ? undefined : { type: e.target.value as "percent" | "amount", value: l.discount?.value ?? 0 } })}><option value="none">No line discount</option><option value="percent">Line discount %</option><option value="amount">Line discount $</option></select>
                        {l.discount && <input className="input py-0.5 w-20 text-xs text-right num" type="number" min={0} step="0.01" value={l.discount.value} onChange={(e) => setLine(l.id, { discount: { ...l.discount!, value: +e.target.value } })} />}
                      </div>
                    </td>
                    <td className="align-top"><input className="input text-right num" type="number" min={0} step="any" value={l.qty} onChange={(e) => setLine(l.id, { qty: e.target.value === "" ? 0 : +e.target.value })} onFocus={(e) => e.target.select()} /><input className="input mt-1 text-xs py-1" list="units" placeholder="unit" value={l.unit ?? ""} onChange={(e) => setLine(l.id, { unit: e.target.value })} /><datalist id="units">{s.units.map((u) => <option key={u} value={u} />)}</datalist></td>
                    <td className="align-top"><input className="input text-right num" type="number" min={0} step="0.01" value={l.rate} onChange={(e) => setLine(l.id, { rate: e.target.value === "" ? 0 : +e.target.value })} onFocus={(e) => e.target.select()} /></td>
                    <td className="align-top"><select className="input py-2" value={l.taxClassId} onChange={(e) => setLine(l.id, { taxClassId: e.target.value, ruleOverrides: undefined })}>{s.tax.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
                    <td className="align-top pt-3"><RuleChips line={l} rules={activeRules} taxExempt={inv.taxExempt} onToggle={(r) => toggleRule(l, r)} /></td>
                    <td className="align-top text-right num pt-3 font-medium">{num2(lineNet(l))}</td>
                    <td className="align-top pt-2.5"><button className="btn-ghost px-1.5 py-1 text-ink-500 hover:text-red-700" onClick={() => set({ items: inv.items.length === 1 ? [newLine(s.tax.defaultClassId)] : inv.items.filter((x) => x.id !== l.id) })} aria-label={`Remove row ${idx + 1}`}><Trash2 size={16} /></button></td>
                  </tr>))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-ink-100 flex flex-wrap items-center gap-3">
            <button className="btn-secondary" onClick={() => addLine()}><Plus size={14} /> Add line</button>
            <QuickAdd catalog={store.catalog} categories={s.categories} onPick={(it) => { const nl = { ...newLine(it.taxClassId), catalogItemId: it.id, name: it.name, description: it.description, rate: it.rate, unit: it.unit }; const last = inv.items[inv.items.length - 1]; set({ items: last && !last.name.trim() ? [...inv.items.slice(0, -1), nl] : [...inv.items, nl] }); }} />
          </div>
        </section>

        {!isEstimate && (
          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3"><h2 className="font-semibold flex items-center gap-2"><CalendarClock size={16} /> Deposits & payment schedule</h2>
              <select className="input w-auto py-1.5" value={depTpl} onChange={(e) => applySchedule(e.target.value)}>{s.deposits.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            {inv.schedule.length === 0 ? <p className="text-sm text-ink-500">No schedule — the full balance is due on the due date. Pick a template to split it into deposits.</p> : (
              <table className="table"><thead><tr><th>Milestone</th><th className="w-32">Type</th><th className="w-28 text-right">Value</th><th className="w-40">Due</th><th className="w-28 text-right">Amount</th><th className="w-8"></th></tr></thead>
                <tbody>{inv.schedule.map((e, i) => (
                  <tr key={e.id}><td><input className="input py-1" value={e.label} onChange={(ev) => set({ schedule: inv.schedule.map((x) => x.id === e.id ? { ...x, label: ev.target.value } : x) })} /></td>
                    <td><select className="input py-1" value={e.type} onChange={(ev) => set({ schedule: inv.schedule.map((x) => x.id === e.id ? { ...x, type: ev.target.value as typeof e.type } : x) })}><option value="percent">Percent</option><option value="amount">Amount</option><option value="balance">Balance</option></select></td>
                    <td>{e.type !== "balance" && <input className="input py-1 text-right num" type="number" value={e.value} onChange={(ev) => set({ schedule: inv.schedule.map((x) => x.id === e.id ? { ...x, value: +ev.target.value } : x) })} />}</td>
                    <td><input className="input py-1" type="date" value={e.dueDate} onChange={(ev) => set({ schedule: inv.schedule.map((x) => x.id === e.id ? { ...x, dueDate: ev.target.value } : x) })} /></td>
                    <td className="text-right num">{money(schedRows[i]?.amount ?? 0)}</td>
                    <td><button className="btn-ghost px-1 text-ink-500 hover:text-red-700" onClick={() => set({ schedule: inv.schedule.filter((x) => x.id !== e.id) })}><Trash2 size={14} /></button></td></tr>))}</tbody></table>)}
            <button className="btn-ghost text-teal-700 mt-2" onClick={() => set({ schedule: [...inv.schedule, { id: uid("sch"), label: "Payment", type: "percent", value: 25, dueDate: inv.dueDate }] })}><Plus size={14} /> Add milestone</button>
          </section>)}

        <section className="card p-5 grid md:grid-cols-2 gap-4">
          <Field label="Notes (printed on document)"><textarea className="input min-h-[90px]" value={inv.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
          <Field label="Internal notes (staff only, never printed)"><textarea className="input min-h-[90px]" value={inv.internalNotes} onChange={(e) => set({ internalNotes: e.target.value })} placeholder="e.g. Client asked for split billing next time" /></Field>
        </section>
      </div>

      <aside className="card p-5 lg:sticky lg:top-6 space-y-3">
        <h2 className="font-semibold">Summary</h2>
        <Row k="Subtotal" v={num2(totals.subtotal)} />
        {totals.lineDiscounts > 0 && <Row k="Line discounts" v={`-${num2(totals.lineDiscounts)}`} muted />}
        <div className="flex items-center gap-2 text-sm">
          <select className="input py-1 w-28" value={inv.discount.type} onChange={(e) => set({ discount: { ...inv.discount, type: e.target.value as InvoiceDraft["discount"]["type"] } })}><option value="none">No discount</option><option value="percent">Discount %</option><option value="amount">Discount $</option></select>
          {inv.discount.type !== "none" && <input className="input py-1 w-20 text-right num" type="number" min={0} step="0.01" value={inv.discount.value} onChange={(e) => set({ discount: { ...inv.discount, value: +e.target.value } })} />}
          {inv.discount.type !== "none" && <span className="ml-auto num text-ink-700">-{num2(totals.invoiceDiscount)}</span>}
        </div>
        {inv.discount.type !== "none" && <input className="input py-1 text-xs" placeholder="Discount label (e.g. Non-profit rate)" value={inv.discount.label} onChange={(e) => set({ discount: { ...inv.discount, label: e.target.value } })} />}
        {totals.charges.map((c) => <Row key={c.rule.id} k={`${c.rule.printLabel}${c.rule.calc.type === "percent" ? ` (${+(c.rule.calc.rate * 100).toFixed(3)}%)` : ""}`} v={num2(c.amount)} muted title={`on ${num2(c.base)}`} />)}
        {totals.charges.length === 0 && <div className="text-xs text-ink-500">No charges yet. Taxes and fees are driven by each line's tax class — set them under Settings → Taxes & charges.</div>}
        <div className="border-t border-ink-100 pt-3"><Row k="Total" v={money(totals.total)} bold /></div>
        {totals.paid > 0 && <Row k="Paid" v={`-${num2(totals.paid)}`} muted />}
        {!isEstimate && <div className="rounded-md bg-teal-50 px-3 py-2 flex justify-between font-semibold text-teal-900"><span>Balance due</span><span className="num">{money(totals.balance)}</span></div>}
        {totals.passThroughTotal > 0 && <div className="text-xs text-ink-500">Includes {money(totals.passThroughTotal)} pass-through (gratuity) excluded from revenue.</div>}
        <div className="pt-2 flex flex-col gap-2">
          <button className="btn-primary justify-center" onClick={() => save(inv.status === "draft" ? "sent" : undefined)}>{invoiceId && inv.status !== "draft" ? "Save changes" : "Save & mark as sent"}</button>
          {(inv.status === "draft" || !invoiceId) && <button className="btn-secondary justify-center" onClick={() => save("draft")}>Save as draft</button>}
          <button className="btn-ghost justify-center" onClick={() => router.back()}>Cancel</button>
        </div>
        {!isEstimate && inv.schedule.length > 0 && <div className="text-xs text-ink-500">Next milestone: {schedRows.find((r) => !r.settled)?.label ?? "all settled"} {schedRows.find((r) => !r.settled) ? `· ${money(schedRows.find((r) => !r.settled)!.amount)} due ${fmtDate(schedRows.find((r) => !r.settled)!.dueDate)}` : ""}</div>}
      </aside>

      <Modal open={custModal} onClose={() => setCustModal(false)} title="New customer" wide><CustomerForm onDone={(c) => { chooseCustomer(c); setCustModal(false); }} onCancel={() => setCustModal(false)} /></Modal>
    </div>
  );
}

function Row({ k, v, bold, muted, title }: { k: string; v: string; bold?: boolean; muted?: boolean; title?: string }) {
  return <div title={title} className={`flex justify-between text-sm ${bold ? "font-semibold text-base" : ""} ${muted ? "text-ink-700" : ""}`}><span className="pr-3">{k}</span><span className="num">{v}</span></div>;
}

/** One chip per active rule; lit when it applies to this line (by class or override). Click to toggle an override. */
export function RuleChips({ line, rules, taxExempt, onToggle }: { line: LineItem; rules: ChargeRule[]; taxExempt?: boolean; onToggle: (r: ChargeRule) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {rules.map((r) => {
        const on = rulesForLine(line, [r]).length > 0 || (r.onCharges.length > 0 && !r.appliesToClasses.length && false);
        const byClass = r.appliesToClasses.includes(line.taxClassId);
        const overridden = on !== byClass;
        const compoundOnly = !r.appliesToClasses.length;
        if (compoundOnly) return null;
        const dim = taxExempt && r.kind === "tax";
        const abbr = r.printLabel.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 4);
        return (<button key={r.id} type="button" title={`${r.name}${overridden ? " (overridden for this line)" : ""}${dim ? " — suppressed: tax-exempt" : ""}`} onClick={() => onToggle(r)}
          className={`rounded px-1.5 py-0.5 text-[11px] font-semibold border transition ${on ? "bg-teal-700 border-teal-700 text-white" : "bg-white border-ink-300 text-ink-500 hover:border-teal-600"} ${overridden ? "ring-2 ring-amber-300" : ""} ${dim ? "opacity-40 line-through" : ""}`}>{abbr}</button>);
      })}
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
      <div className="relative"><input className="input pr-8" placeholder="Search customers or type a new company name" value={value ? value.company : typed} onFocus={() => setOpen(true)} onChange={(e) => { onType(e.target.value); setOpen(true); }} /><ChevronDown size={16} className="absolute right-2.5 top-2.5 text-ink-500 pointer-events-none" /></div>
      {open && (<div className="absolute z-20 mt-1 w-full card max-h-64 overflow-auto">
        {matches.map((c) => (<button key={c.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50" onMouseDown={() => { onPick(c); setOpen(false); }}><div className="font-medium">{c.company}{c.taxExempt && <span className="ml-2 text-[10px] uppercase text-teal-700">tax exempt</span>}</div><div className="text-xs text-ink-500">{[c.contactName, c.city && `${c.city}, ${c.state}`].filter(Boolean).join(" · ")}</div></button>))}
        {matches.length === 0 && <div className="px-3 py-2 text-sm text-ink-500">No matches — “{typed}” will be saved as a new customer.</div>}
      </div>)}
    </div>
  );
}

function ItemTypeahead({ id, value, catalog, onChange, onPick, onEnter }: { id: string; value: string; catalog: CatalogItem[]; onChange: (v: string) => void; onPick: (c: CatalogItem) => void; onEnter: () => void }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const q = value.toLowerCase();
  const matches = catalog.filter((c) => c.active && (!q || c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q) || c.sku?.toLowerCase().includes(q))).slice(0, 8);
  return (
    <div className="relative">
      <input id={id} className="input" placeholder="Item name" value={value} autoComplete="off" onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(0); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)); setOpen(true); } else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); } else if (e.key === "Enter") { e.preventDefault(); if (open && matches[hi]) { onPick(matches[hi]); setOpen(false); } else onEnter(); } else if (e.key === "Escape") setOpen(false); }} />
      {open && matches.length > 0 && (<div className="absolute z-20 mt-1 w-[420px] max-w-[80vw] card max-h-64 overflow-auto">
        {matches.map((c, i) => (<button key={c.id} type="button" className={`w-full text-left px-3 py-2 text-sm flex justify-between gap-3 ${i === hi ? "bg-teal-50" : "hover:bg-ink-50"}`} onMouseDown={() => { onPick(c); setOpen(false); }}><span><span className="font-medium">{c.name}</span><span className="text-xs text-ink-500 ml-2">{c.category}</span></span><span className="num text-ink-700 whitespace-nowrap">{num2(c.rate)} <span className="text-xs text-ink-500">/{c.unit}</span></span></button>))}
      </div>)}
    </div>
  );
}

function QuickAdd({ catalog, categories, onPick }: { catalog: CatalogItem[]; categories: string[]; onPick: (c: CatalogItem) => void }) {
  const cats = [...categories, ...catalog.map((c) => c.category).filter((c) => !categories.includes(c))];
  return (
    <select className="input w-auto py-2" value="" onChange={(e) => { const it = catalog.find((c) => c.id === e.target.value); if (it) onPick(it); }}>
      <option value="">Quick add from price list…</option>
      {cats.map((cat) => { const items = catalog.filter((c) => c.active && c.category === cat); return items.length ? <optgroup key={cat} label={cat}>{items.map((c) => <option key={c.id} value={c.id}>{c.name} — {num2(c.rate)}</option>)}</optgroup> : null; })}
    </select>
  );
}
