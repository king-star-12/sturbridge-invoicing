"use client";
import { useRef, useState, useMemo } from "react";
import Link from "next/link";
import { Download, Upload, RotateCcw, Plus, Trash2, Copy, FlaskConical, AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Settings, ChargeRule, TaxClass, CustomField, DocumentTemplate, DepositTemplate } from "@/lib/types";
import { presets } from "@/lib/presets";
import { computeTotals, describeRule, validateRules } from "@/lib/engine";
import { formatNumber } from "@/lib/calc";
import { money, num2 } from "@/lib/format";
import { uid } from "@/lib/id";
import { Confirm, Field, PageHeader, Tabs, Toggle, ListEditor, Modal } from "@/components/ui";
import InvoiceDocument from "@/components/InvoiceDocument";
import FitDoc from "@/components/FitDoc";
import { seedInvoices } from "@/lib/seed";

type Tab = "business" | "tax" | "document" | "fields" | "numbering" | "deposits" | "email" | "data";

export default function SettingsPage() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>("tax");
  const [saved, setSaved] = useState("");
  const flash = (m: string) => { setSaved(m); setTimeout(() => setSaved(""), 2000); };
  const up = (fn: (s: Settings) => Settings, msg = "Saved") => { store.updateSettings(fn); flash(msg); };
  if (!store.ready) return null;
  if (store.role !== "admin") return <div className="card p-10 text-center"><div className="font-medium">Settings are admin-only</div><p className="text-sm text-ink-500 mt-1">Sign in with the admin passcode to change taxes, templates and business details.</p></div>;
  const s = store.settings;
  const tabs: { key: Tab; label: string }[] = [
    { key: "business", label: "Business" }, { key: "tax", label: "Taxes & charges" }, { key: "document", label: "Document templates" }, { key: "fields", label: "Fields & catalog" },
    { key: "numbering", label: "Numbering & defaults" }, { key: "deposits", label: "Deposits & terms" }, { key: "email", label: "Reminders & email" }, { key: "data", label: "Team & data" },
  ];
  return (
    <>
      <PageHeader title="Settings" subtitle="Everything here is configurable per property. Changes save automatically." actions={saved && <span className="text-sm text-teal-700">{saved}</span>} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "business" && <Business s={s} up={up} />}
      {tab === "tax" && <TaxSettings s={s} up={up} />}
      {tab === "document" && <Documents s={s} up={up} />}
      {tab === "fields" && <Fields s={s} up={up} />}
      {tab === "numbering" && <Numbering s={s} up={up} />}
      {tab === "deposits" && <Deposits s={s} up={up} />}
      {tab === "email" && <Email s={s} up={up} />}
      {tab === "data" && <Data flash={flash} />}
    </>
  );
}

type P = { s: Settings; up: (fn: (s: Settings) => Settings, msg?: string) => void };

/* ---------------------------------------------------------------- Business */
function Business({ s, up }: P) {
  const b = s.business;
  const setB = (k: keyof Settings["business"], v: string) => up((x) => ({ ...x, business: { ...x.business, [k]: v } }));
  const fileRef = useRef<HTMLInputElement>(null);
  async function onLogo(f: File) { const r = new FileReader(); r.onload = () => setB("logoDataUrl", String(r.result)); r.readAsDataURL(f); }
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">Property details</h2>
        {([["name", "Business name (printed)"], ["legalName", "Legal entity name"], ["address1", "Street address"], ["address2", "Address line 2"], ["city", "City"], ["state", "State / province"], ["zip", "ZIP / postal code"], ["country", "Country"], ["phone", "Phone"], ["website", "Website"], ["email", "Billing email"], ["taxId", "Tax ID / EIN (printed if set)"]] as [keyof Settings["business"], string][]).map(([k, l]) => (
          <Field key={k} label={l}><input className="input" value={b[k]} onChange={(e) => setB(k, e.target.value)} /></Field>))}
      </section>
      <div className="space-y-6">
        <section className="card p-5 space-y-3">
          <h2 className="font-semibold">Logo</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.logoDataUrl || "/logo.png"} alt="" className="h-24 w-auto border border-ink-100 rounded p-2 bg-white" />
          <div className="flex gap-2"><button className="btn-secondary" onClick={() => fileRef.current?.click()}><Upload size={15} /> Upload logo</button>{b.logoDataUrl && <button className="btn-ghost" onClick={() => setB("logoDataUrl", "")}>Use default</button>}</div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])} />
          <p className="text-xs text-ink-500">PNG or SVG with transparent background prints best. Stored with your data, so it travels with backups.</p>
        </section>
        <section className="card p-5 space-y-4">
          <h2 className="font-semibold">Locale & currency</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Currency"><select className="input" value={s.locale.currency} onChange={(e) => up((x) => ({ ...x, locale: { ...x.locale, currency: e.target.value } }))}>{["USD", "CAD", "EUR", "GBP", "AUD", "MXN", "INR"].map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Number & date locale"><select className="input" value={s.locale.locale} onChange={(e) => up((x) => ({ ...x, locale: { ...x.locale, locale: e.target.value } }))}>{["en-US", "en-CA", "en-GB", "fr-CA", "de-DE", "es-MX", "en-IN"].map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Date format"><select className="input" value={s.locale.dateFormat} onChange={(e) => up((x) => ({ ...x, locale: { ...x.locale, dateFormat: e.target.value as Settings["locale"]["dateFormat"] } }))}>{["MMM d, yyyy", "MM/dd/yyyy", "dd/MM/yyyy", "yyyy-MM-dd"].map((c) => <option key={c}>{c}</option>)}</select></Field>
          </div>
          <p className="text-xs text-ink-500">Preview: {money(1234.5)} · {new Date().toLocaleDateString(s.locale.locale)}</p>
        </section>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Taxes & charges */
function TaxSettings({ s, up }: P) {
  const t = s.tax;
  const issues = useMemo(() => validateRules(t.rules, t.classes), [t.rules, t.classes]);
  const [presetConfirm, setPresetConfirm] = useState<string | null>(null);
  const [editing, setEditing] = useState<ChargeRule | null>(null);
  const setTax = (fn: (tx: Settings["tax"]) => Settings["tax"], msg?: string) => up((x) => ({ ...x, tax: fn(x.tax) }), msg);

  function applyPreset(id: string) {
    const p = presets.find((x) => x.id === id); if (!p) return;
    setTax((tx) => ({ ...tx, presetId: p.id, classes: p.classes, rules: p.rules, defaultClassId: p.classes.some((c) => c.id === tx.defaultClassId) ? tx.defaultClassId : p.classes[0].id }), `Applied "${p.name}"`);
  }
  const addRule = () => setEditing({ id: uid("rule"), name: "New charge", printLabel: "New Charge", kind: "tax", calc: { type: "percent", rate: 0.05 }, appliesToClasses: [t.defaultClassId], onCharges: [], rounding: "total", passThrough: false, showOnDocument: "separate", active: true, notes: "" });
  const saveRule = (r: ChargeRule) => { setTax((tx) => ({ ...tx, rules: tx.rules.some((x) => x.id === r.id) ? tx.rules.map((x) => x.id === r.id ? r : x) : [...tx.rules, r] })); setEditing(null); };
  const addClass = () => { const id = uid("cls"); setTax((tx) => ({ ...tx, classes: [...tx.classes, { id, name: "New class", description: "", color: "#6b7078" }] })); };
  const setClass = (id: string, patch: Partial<TaxClass>) => setTax((tx) => ({ ...tx, classes: tx.classes.map((c) => c.id === id ? { ...c, ...patch } : c) }));
  const delClass = (id: string) => setTax((tx) => ({ ...tx, classes: tx.classes.filter((c) => c.id !== id), rules: tx.rules.map((r) => ({ ...r, appliesToClasses: r.appliesToClasses.filter((c) => c !== id) })), defaultClassId: tx.defaultClassId === id ? (tx.classes.find((c) => c.id !== id)?.id ?? "") : tx.defaultClassId }));

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-semibold">Jurisdiction preset</h2><p className="text-sm text-ink-500 mt-0.5">Start from a known-good rule set, then tune it. Applying a preset replaces the tax classes and rules below; existing invoices keep their saved amounts.</p></div>
          <select className="input w-auto" value={t.presetId} onChange={(e) => setPresetConfirm(e.target.value)}>{presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </div>
        <p className="text-xs text-ink-500 mt-3">{presets.find((p) => p.id === t.presetId)?.description}</p>
        {issues.length > 0 && <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><div className="flex items-center gap-2 font-medium mb-1"><AlertTriangle size={15} /> Check these before invoicing</div><ul className="list-disc pl-5">{issues.map((i) => <li key={i}>{i}</li>)}</ul></div>}
      </section>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <section className="card">
          <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100"><div><h2 className="font-semibold">Charge rules</h2><p className="text-xs text-ink-500">Each tax, service charge, fee or gratuity is a rule. A rule can be based on line amounts by tax class, on other charges (compounding), or both.</p></div><button className="btn-primary" onClick={addRule}><Plus size={15} /> Add rule</button></div>
          <ul className="divide-y divide-ink-100">
            {t.rules.map((r) => (
              <li key={r.id} className={`px-5 py-3 flex flex-wrap items-center gap-3 ${r.active ? "" : "opacity-50"}`}>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${{ tax: "bg-blue-50 text-blue-700", service: "bg-teal-50 text-teal-800", fee: "bg-amber-50 text-amber-800", gratuity: "bg-purple-50 text-purple-700" }[r.kind]}`}>{r.kind}</span>
                <div className="flex-1 min-w-[220px]"><div className="font-medium text-sm">{r.printLabel} <span className="text-ink-500 font-normal">· {r.name}</span></div><div className="text-xs text-ink-500">{describeRule(r, t.classes)}{r.passThrough ? " · pass-through" : ""}{r.showOnDocument === "grouped" ? " · grouped on document" : ""}{r.effectiveFrom || r.effectiveTo ? ` · effective ${r.effectiveFrom ?? "…"} → ${r.effectiveTo ?? "…"}` : ""}</div></div>
                <Toggle checked={r.active} onChange={(v) => setTax((tx) => ({ ...tx, rules: tx.rules.map((x) => x.id === r.id ? { ...x, active: v } : x) }))} label="" />
                <button className="btn-ghost px-2" onClick={() => setEditing(r)}>Edit</button>
                <button className="btn-ghost px-2" title="Duplicate" onClick={() => setTax((tx) => ({ ...tx, rules: [...tx.rules, { ...r, id: uid("rule"), name: r.name + " (copy)" }] }))}><Copy size={14} /></button>
                <button className="btn-ghost px-2 text-ink-500 hover:text-red-700" onClick={() => setTax((tx) => ({ ...tx, rules: tx.rules.filter((x) => x.id !== r.id).map((x) => ({ ...x, onCharges: x.onCharges.filter((d) => d !== r.id) })) }))}><Trash2 size={14} /></button>
              </li>))}
            {t.rules.length === 0 && <li className="px-5 py-6 text-sm text-ink-500 text-center">No rules — every line is untaxed. Add a rule or apply a preset.</li>}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="card">
            <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100"><h2 className="font-semibold">Tax classes</h2><button className="btn-ghost text-teal-700" onClick={addClass}><Plus size={14} /> Add</button></div>
            <ul className="divide-y divide-ink-100">{t.classes.map((c) => (
              <li key={c.id} className="px-4 py-2.5 flex items-center gap-2">
                <input type="color" className="h-7 w-7 rounded border-0 bg-transparent p-0" value={c.color} onChange={(e) => setClass(c.id, { color: e.target.value })} />
                <div className="flex-1 min-w-0"><input className="input py-1 text-sm" value={c.name} onChange={(e) => setClass(c.id, { name: e.target.value })} /><input className="input py-0.5 text-xs mt-1" placeholder="Description" value={c.description} onChange={(e) => setClass(c.id, { description: e.target.value })} /><div className="text-[11px] text-ink-500 mt-1">{t.rules.filter((r) => r.active && r.appliesToClasses.includes(c.id)).map((r) => r.printLabel).join(", ") || "no charges"}</div></div>
                <div className="flex flex-col items-end gap-1"><label className="text-[11px] text-ink-500 flex items-center gap-1"><input type="radio" name="defcls" checked={t.defaultClassId === c.id} onChange={() => setTax((tx) => ({ ...tx, defaultClassId: c.id }))} /> default</label><button className="btn-ghost px-1 text-ink-500 hover:text-red-700" onClick={() => delClass(c.id)}><Trash2 size={13} /></button></div>
              </li>))}</ul>
          </section>
          <Playground s={s} />
        </div>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing && t.rules.some((r) => r.id === editing.id) ? "Edit rule" : "New rule"} wide>
        {editing && <RuleEditor rule={editing} classes={t.classes} others={t.rules.filter((r) => r.id !== editing.id)} onSave={saveRule} onCancel={() => setEditing(null)} />}
      </Modal>
      <Confirm open={!!presetConfirm} onClose={() => setPresetConfirm(null)} title="Apply this preset?" body="Your current tax classes and rules will be replaced. Items keep their class ids where the preset uses the same names; anything else falls back to the default class." confirmLabel="Apply preset" onConfirm={() => presetConfirm && applyPreset(presetConfirm)} />
    </div>
  );
}

function RuleEditor({ rule, classes, others, onSave, onCancel }: { rule: ChargeRule; classes: TaxClass[]; others: ChargeRule[]; onSave: (r: ChargeRule) => void; onCancel: () => void }) {
  const [r, setR] = useState<ChargeRule>(rule);
  const pct = r.calc.type === "percent";
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(r); }} className="grid sm:grid-cols-2 gap-4">
      <Field label="Internal name"><input className="input" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></Field>
      <Field label="Label printed on documents"><input className="input" value={r.printLabel} onChange={(e) => setR({ ...r, printLabel: e.target.value })} /></Field>
      <Field label="Kind" hint="Tax rules are suppressed for tax-exempt customers and reported as tax liability. Gratuity usually pass-through."><select className="input" value={r.kind} onChange={(e) => setR({ ...r, kind: e.target.value as ChargeRule["kind"], passThrough: e.target.value === "gratuity" ? true : r.passThrough })}><option value="tax">Tax (remitted to government)</option><option value="service">Service charge</option><option value="fee">Fee / administrative charge</option><option value="gratuity">Gratuity</option></select></Field>
      <Field label="Calculation"><div className="flex gap-2"><select className="input w-auto" value={r.calc.type} onChange={(e) => setR({ ...r, calc: e.target.value === "percent" ? { type: "percent", rate: 0.05 } : { type: "flat", amount: 25, per: "invoice" } })}><option value="percent">Percent</option><option value="flat">Flat amount</option></select>
        {pct ? <input className="input num" type="number" step="0.001" min={0} value={+((r.calc as { rate: number }).rate * 100).toFixed(4)} onChange={(e) => setR({ ...r, calc: { type: "percent", rate: +e.target.value / 100 } })} /> : (<><input className="input num" type="number" step="0.01" min={0} value={(r.calc as { amount: number }).amount} onChange={(e) => setR({ ...r, calc: { ...(r.calc as { type: "flat"; amount: number; per: "invoice" }), amount: +e.target.value } })} /><select className="input w-auto" value={(r.calc as { per: string }).per} onChange={(e) => setR({ ...r, calc: { ...(r.calc as { type: "flat"; amount: number; per: "invoice" }), per: e.target.value as "invoice" | "line" | "unit" } })}><option value="invoice">per invoice</option><option value="line">per line</option><option value="unit">per unit</option></select></>)}</div></Field>
      <Field label="Applies to tax classes" className="sm:col-span-2"><div className="flex flex-wrap gap-2">{classes.map((c) => <label key={c.id} className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm cursor-pointer ${r.appliesToClasses.includes(c.id) ? "border-teal-700 bg-teal-50" : "border-ink-300"}`}><input type="checkbox" checked={r.appliesToClasses.includes(c.id)} onChange={(e) => setR({ ...r, appliesToClasses: e.target.checked ? [...r.appliesToClasses, c.id] : r.appliesToClasses.filter((x) => x !== c.id) })} /><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />{c.name}</label>)}</div></Field>
      {pct && <Field label="Also applied to these charges (compounding)" hint="Example: Massachusetts sales tax on the service charge and house charge." className="sm:col-span-2"><div className="flex flex-wrap gap-2">{others.map((o) => <label key={o.id} className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm cursor-pointer ${r.onCharges.includes(o.id) ? "border-teal-700 bg-teal-50" : "border-ink-300"}`}><input type="checkbox" checked={r.onCharges.includes(o.id)} onChange={(e) => setR({ ...r, onCharges: e.target.checked ? [...r.onCharges, o.id] : r.onCharges.filter((x) => x !== o.id) })} />{o.printLabel}</label>)}{others.length === 0 && <span className="text-sm text-ink-500">No other rules yet.</span>}</div></Field>}
      <Field label="Rounding"><select className="input" value={r.rounding} onChange={(e) => setR({ ...r, rounding: e.target.value as ChargeRule["rounding"] })}><option value="total">Round once on the total (most jurisdictions)</option><option value="line">Round per line, then sum</option></select></Field>
      <Field label="On the document"><select className="input" value={r.showOnDocument} onChange={(e) => setR({ ...r, showOnDocument: e.target.value as ChargeRule["showOnDocument"] })}><option value="separate">Own line</option><option value="grouped">Fold into “Taxes & fees”</option></select></Field>
      <Field label="Effective from"><input className="input" type="date" value={r.effectiveFrom ?? ""} onChange={(e) => setR({ ...r, effectiveFrom: e.target.value || undefined })} /></Field>
      <Field label="Effective to" hint="Leave blank for open-ended. Use these when a rate changes: end the old rule, start the new one."><input className="input" type="date" value={r.effectiveTo ?? ""} onChange={(e) => setR({ ...r, effectiveTo: e.target.value || undefined })} /></Field>
      <div className="sm:col-span-2 flex flex-wrap gap-5"><Toggle checked={r.active} onChange={(v) => setR({ ...r, active: v })} label="Active" /><Toggle checked={r.passThrough} onChange={(v) => setR({ ...r, passThrough: v })} label="Pass-through (excluded from revenue, e.g. gratuity paid to staff)" /></div>
      <Field label="Notes (for your accountant)" className="sm:col-span-2"><textarea className="input" rows={2} value={r.notes} onChange={(e) => setR({ ...r, notes: e.target.value })} /></Field>
      <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button><button className="btn-primary">Save rule</button></div>
    </form>
  );
}

/** Try the rule set on a sample line before it touches a real invoice. */
function Playground({ s }: { s: Settings }) {
  const [cls, setCls] = useState(s.tax.defaultClassId);
  const [amt, setAmt] = useState(100);
  const [exempt, setExempt] = useState(false);
  const t = computeTotals({ items: [{ id: "x", name: "Sample", description: "", qty: 1, rate: amt, taxClassId: cls }], discount: { type: "none", value: 0, label: "" }, payments: [], taxExempt: exempt }, s.tax);
  return (
    <section className="card p-4">
      <h2 className="font-semibold flex items-center gap-2 text-sm"><FlaskConical size={15} /> Try it</h2>
      <div className="flex gap-2 mt-2"><select className="input py-1" value={cls} onChange={(e) => setCls(e.target.value)}>{s.tax.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input className="input py-1 w-24 num text-right" type="number" value={amt} onChange={(e) => setAmt(+e.target.value)} /></div>
      <label className="flex items-center gap-2 text-xs mt-2"><input type="checkbox" checked={exempt} onChange={(e) => setExempt(e.target.checked)} /> tax-exempt customer</label>
      <table className="w-full text-xs mt-2"><tbody>
        <tr><td className="py-0.5">Line</td><td className="text-right num">{num2(amt)}</td></tr>
        {t.charges.map((c) => <tr key={c.rule.id}><td className="py-0.5 text-ink-700">{c.rule.printLabel} <span className="text-ink-500">on {num2(c.base)}</span></td><td className="text-right num">{num2(c.amount)}</td></tr>)}
        <tr className="font-semibold border-t border-ink-100"><td className="py-1">Total</td><td className="text-right num">{money(t.total)}</td></tr>
        <tr><td className="text-ink-500">Effective rate</td><td className="text-right num text-ink-500">{amt ? `${((t.total / amt - 1) * 100).toFixed(3)}%` : "—"}</td></tr>
      </tbody></table>
    </section>
  );
}

/* ---------------------------------------------------------------- Document templates */
function Documents({ s, up }: P) {
  const [sel, setSel] = useState(s.defaultTemplateId);
  const tpl = s.templates.find((t) => t.id === sel) ?? s.templates[0];
  const setT = (patch: Partial<DocumentTemplate>) => up((x) => ({ ...x, templates: x.templates.map((t) => t.id === tpl.id ? { ...t, ...patch } : t) }));
  const sample = { ...seedInvoices[0], templateId: tpl.id, schedule: [{ id: "a", label: "Deposit", type: "percent" as const, value: 25, dueDate: "2024-10-01" }, { id: "b", label: "Balance", type: "balance" as const, value: 0, dueDate: "2024-10-20" }] };
  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
      <section className="card p-5 space-y-4">
        <div className="flex items-center gap-2"><select className="input" value={tpl.id} onChange={(e) => setSel(e.target.value)}>{s.templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.id === s.defaultTemplateId ? " (default)" : ""}</option>)}</select>
          <button className="btn-ghost px-2" title="Duplicate" onClick={() => { const id = uid("tpl"); up((x) => ({ ...x, templates: [...x.templates, { ...tpl, id, name: tpl.name + " copy" }] })); setSel(id); }}><Copy size={15} /></button>
          {s.templates.length > 1 && <button className="btn-ghost px-2 text-ink-500 hover:text-red-700" onClick={() => { up((x) => ({ ...x, templates: x.templates.filter((t) => t.id !== tpl.id), defaultTemplateId: x.defaultTemplateId === tpl.id ? x.templates.find((t) => t.id !== tpl.id)!.id : x.defaultTemplateId })); setSel(s.templates.find((t) => t.id !== tpl.id)!.id); }}><Trash2 size={15} /></button>}</div>
        <Field label="Template name"><input className="input" value={tpl.name} onChange={(e) => setT({ name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Layout"><select className="input" value={tpl.layout} onChange={(e) => setT({ layout: e.target.value as DocumentTemplate["layout"] })}><option value="classic">Classic</option><option value="modern">Modern</option><option value="compact">Compact</option></select></Field>
          <Field label="Accent color"><div className="flex items-center gap-2"><input type="color" className="h-9 w-12 rounded border border-ink-300 p-0.5" value={tpl.accentColor} onChange={(e) => setT({ accentColor: e.target.value })} /><input className="input" value={tpl.accentColor} onChange={(e) => setT({ accentColor: e.target.value })} /></div></Field>
          <Field label="Invoice title"><input className="input" value={tpl.titleInvoice} onChange={(e) => setT({ titleInvoice: e.target.value })} /></Field>
          <Field label="Estimate title"><input className="input" value={tpl.titleEstimate} onChange={(e) => setT({ titleEstimate: e.target.value })} /></Field>
          <Field label="Paper"><select className="input" value={tpl.paper} onChange={(e) => setT({ paper: e.target.value as DocumentTemplate["paper"] })}><option value="letter">US Letter</option><option value="a4">A4</option></select></Field>
        </div>
        <div className="grid gap-2">
          <Toggle checked={tpl.showLogo} onChange={(v) => setT({ showLogo: v })} label="Show logo" />
          <Toggle checked={tpl.showStub} onChange={(v) => setT({ showStub: v })} label="Payment stub page (invoices)" />
          <Toggle checked={tpl.showUnitColumn} onChange={(v) => setT({ showUnitColumn: v })} label="Unit column" />
          <Toggle checked={tpl.showLineTaxCodes} onChange={(v) => setT({ showLineTaxCodes: v })} label="Tax codes per line" />
          <Toggle checked={tpl.groupCharges} onChange={(v) => setT({ groupCharges: v })} label="Fold “grouped” rules into one Taxes & fees line" />
          <Toggle checked={tpl.showSchedule} onChange={(v) => setT({ showSchedule: v })} label="Print payment schedule" />
          <Toggle checked={tpl.showPaymentInstructions} onChange={(v) => setT({ showPaymentInstructions: v })} label="Print payment instructions" />
          <Toggle checked={tpl.signatureLine} onChange={(v) => setT({ signatureLine: v })} label="Signature line" />
        </div>
        <Field label="Terms & conditions (printed)"><textarea className="input" rows={3} value={tpl.termsText} onChange={(e) => setT({ termsText: e.target.value })} /></Field>
        <Field label="Footer"><input className="input" value={tpl.footerText} onChange={(e) => setT({ footerText: e.target.value })} placeholder="e.g. Thank you for choosing Sturbridge Host Hotel" /></Field>
        {s.defaultTemplateId !== tpl.id && <button className="btn-secondary w-full justify-center" onClick={() => up((x) => ({ ...x, defaultTemplateId: tpl.id }), "Default template set")}>Make default</button>}
        <p className="text-xs text-ink-500">Any document can pick a different template at print time.</p>
      </section>
      <div className="doc-wrap rounded-lg bg-ink-100 p-3 md:p-5 min-w-0"><FitDoc><InvoiceDocument inv={sample} settings={s} template={tpl} /></FitDoc></div>
    </div>
  );
}

/* ---------------------------------------------------------------- Fields & catalog */
function Fields({ s, up }: P) {
  const setF = (id: string, patch: Partial<CustomField>) => up((x) => ({ ...x, customFields: x.customFields.map((f) => f.id === id ? { ...f, ...patch } : f) }));
  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">Built-in fields</h2>
        <p className="text-xs text-ink-500">Hide what your property doesn't use.</p>
        {(Object.keys(s.builtInFields) as (keyof Settings["builtInFields"])[]).map((k) => <Toggle key={k} checked={s.builtInFields[k]} onChange={(v) => up((x) => ({ ...x, builtInFields: { ...x.builtInFields, [k]: v } }))} label={{ eventNumber: "Event number", eventName: "Event name", eventDates: "Event dates", poNumber: "P.O. number", salesPerson: "Sales person" }[k]} />)}
        <h2 className="font-semibold pt-4">Custom fields</h2>
        <p className="text-xs text-ink-500">Anything else the property tracks per document — guest counts, function rooms, BEO numbers, cost centers.</p>
        <ul className="space-y-3">{s.customFields.map((f) => (
          <li key={f.id} className="rounded-md border border-ink-100 p-3 grid grid-cols-2 gap-2">
            <input className="input py-1 col-span-2" value={f.label} onChange={(e) => setF(f.id, { label: e.target.value })} />
            <select className="input py-1" value={f.type} onChange={(e) => setF(f.id, { type: e.target.value as CustomField["type"] })}><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="select">Dropdown</option></select>
            <select className="input py-1" value={f.kinds.join(",")} onChange={(e) => setF(f.id, { kinds: e.target.value.split(",") as CustomField["kinds"] })}><option value="invoice,estimate">Invoices & estimates</option><option value="invoice">Invoices only</option><option value="estimate">Estimates only</option></select>
            {f.type === "select" && <div className="col-span-2"><ListEditor value={f.options} onChange={(options) => setF(f.id, { options })} placeholder="Add option, press Enter" /></div>}
            <div className="col-span-2 flex flex-wrap gap-4 items-center"><Toggle checked={f.showOnDocument} onChange={(v) => setF(f.id, { showOnDocument: v })} label="Print" /><Toggle checked={f.required} onChange={(v) => setF(f.id, { required: v })} label="Required" /><button className="btn-ghost px-1 ml-auto text-ink-500 hover:text-red-700" onClick={() => up((x) => ({ ...x, customFields: x.customFields.filter((c) => c.id !== f.id) }))}><Trash2 size={14} /></button></div>
          </li>))}</ul>
        <button className="btn-secondary" onClick={() => up((x) => ({ ...x, customFields: [...x.customFields, { id: uid("cf"), label: "New field", type: "text", options: [], showOnDocument: true, required: false, kinds: ["invoice", "estimate"] }] }))}><Plus size={14} /> Add custom field</button>
      </section>
      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">Catalog lists</h2>
        <Field label="Item categories" hint="Groups in the price list and quick-add menu."><ListEditor value={s.categories} onChange={(categories) => up((x) => ({ ...x, categories }))} /></Field>
        <Field label="Units"><ListEditor value={s.units} onChange={(units) => up((x) => ({ ...x, units }))} /></Field>
        <Field label="Payment methods"><ListEditor value={s.paymentMethods} onChange={(paymentMethods) => up((x) => ({ ...x, paymentMethods }))} /></Field>
        <Field label="Sales people"><ListEditor value={s.salesPeople} onChange={(salesPeople) => up((x) => ({ ...x, salesPeople }))} /></Field>
        <p className="text-xs text-ink-500">Import items and customers from CSV on their own pages.</p>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- Numbering & defaults */
function Numbering({ s, up }: P) {
  const N = (kind: "invoice" | "estimate") => {
    const r = s.numbering[kind];
    const set = (patch: Partial<typeof r>) => up((x) => ({ ...x, numbering: { ...x.numbering, [kind]: { ...x.numbering[kind], ...patch } } }));
    return (
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <Field label={`${kind === "invoice" ? "Invoice" : "Estimate"} pattern`} hint={<>Tokens: <code>{"{SEQ:4}"}</code> <code>{"{YYYY}"}</code> <code>{"{YY}"}</code> <code>{"{MM}"}</code>. Next: <b className="font-mono text-ink-900">{formatNumber(r, r.next)}</b></>}><input className="input font-mono" value={r.pattern} onChange={(e) => set({ pattern: e.target.value })} /></Field>
        <Field label="Next #"><input className="input num" type="number" min={1} value={r.next} onChange={(e) => set({ next: Math.max(1, +e.target.value) })} /></Field>
        <div className="col-span-2"><Toggle checked={r.resetYearly} onChange={(v) => set({ resetYearly: v })} label="Restart the sequence at 1 each January (pair with {YYYY})" /></div>
      </div>);
  };
  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <section className="card p-5 space-y-5"><h2 className="font-semibold">Numbering</h2>{N("invoice")}{N("estimate")}</section>
      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">Defaults for new documents</h2>
        <Field label="Payment terms"><select className="input" value={s.defaults.terms} onChange={(e) => up((x) => ({ ...x, defaults: { ...x.defaults, terms: e.target.value } }))}>{s.termsOptions.filter((t) => t !== "Custom").map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Terms offered" hint="“Net N” and “End of Month” compute due dates automatically."><ListEditor value={s.termsOptions} onChange={(termsOptions) => up((x) => ({ ...x, termsOptions }))} /></Field>
        <Field label="Estimates valid for (days)"><input className="input num" type="number" min={1} value={s.defaults.estimateValidDays} onChange={(e) => up((x) => ({ ...x, defaults: { ...x.defaults, estimateValidDays: +e.target.value } }))} /></Field>
        <Field label="Default sales person"><input className="input" list="sp" value={s.defaults.salesPerson} onChange={(e) => up((x) => ({ ...x, defaults: { ...x.defaults, salesPerson: e.target.value } }))} /><datalist id="sp">{s.salesPeople.map((p) => <option key={p} value={p} />)}</datalist></Field>
        <Field label="Default notes"><textarea className="input" rows={2} value={s.defaults.notes} onChange={(e) => up((x) => ({ ...x, defaults: { ...x.defaults, notes: e.target.value } }))} /></Field>
        <Field label="Payment instructions (printed on invoices)"><textarea className="input" rows={3} value={s.paymentInstructions} onChange={(e) => up((x) => ({ ...x, paymentInstructions: e.target.value }))} /></Field>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- Deposits */
function Deposits({ s, up }: P) {
  const setTpl = (id: string, fn: (t: DepositTemplate) => DepositTemplate) => up((x) => ({ ...x, deposits: { ...x.deposits, templates: x.deposits.templates.map((t) => t.id === id ? fn(t) : t) } }));
  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Deposit & payment-schedule templates</h2><p className="text-xs text-ink-500">Applied to an invoice with one click; every milestone stays editable per invoice. Offsets are days relative to the invoice date or the event date (negative = before).</p></div>
          <div className="flex gap-2"><select className="input w-auto" value={s.deposits.defaultTemplateId} onChange={(e) => up((x) => ({ ...x, deposits: { ...x.deposits, defaultTemplateId: e.target.value } }))}>{s.deposits.templates.map((t) => <option key={t.id} value={t.id}>Default: {t.name}</option>)}</select>
          <button className="btn-primary" onClick={() => up((x) => ({ ...x, deposits: { ...x.deposits, templates: [...x.deposits.templates, { id: uid("dep"), name: "New schedule", entries: [{ label: "Deposit", type: "percent", value: 50, offsetDays: 0, anchor: "invoice" }, { label: "Balance", type: "balance", value: 0, offsetDays: -14, anchor: "event" }] }] } }))}><Plus size={15} /> New template</button></div></div>
      </section>
      {s.deposits.templates.map((t) => (
        <section key={t.id} className="card p-5">
          <div className="flex items-center gap-2 mb-3"><input className="input max-w-sm" value={t.name} onChange={(e) => setTpl(t.id, (x) => ({ ...x, name: e.target.value }))} /><button className="btn-ghost text-ink-500 hover:text-red-700 ml-auto" onClick={() => up((x) => ({ ...x, deposits: { ...x.deposits, templates: x.deposits.templates.filter((y) => y.id !== t.id), defaultTemplateId: x.deposits.defaultTemplateId === t.id ? (x.deposits.templates.find((y) => y.id !== t.id)?.id ?? "") : x.deposits.defaultTemplateId } }))}><Trash2 size={15} /></button></div>
          {t.entries.length === 0 ? <p className="text-sm text-ink-500">No milestones — full balance due on the due date.</p> : (
            <table className="table"><thead><tr><th>Milestone</th><th className="w-32">Type</th><th className="w-24 text-right">Value</th><th className="w-24 text-right">Offset days</th><th className="w-36">From</th><th className="w-8"></th></tr></thead>
              <tbody>{t.entries.map((e, i) => (
                <tr key={i}><td><input className="input py-1" value={e.label} onChange={(ev) => setTpl(t.id, (x) => ({ ...x, entries: x.entries.map((y, j) => j === i ? { ...y, label: ev.target.value } : y) }))} /></td>
                  <td><select className="input py-1" value={e.type} onChange={(ev) => setTpl(t.id, (x) => ({ ...x, entries: x.entries.map((y, j) => j === i ? { ...y, type: ev.target.value as typeof e.type } : y) }))}><option value="percent">Percent</option><option value="amount">Amount</option><option value="balance">Balance</option></select></td>
                  <td>{e.type !== "balance" && <input className="input py-1 num text-right" type="number" value={e.value} onChange={(ev) => setTpl(t.id, (x) => ({ ...x, entries: x.entries.map((y, j) => j === i ? { ...y, value: +ev.target.value } : y) }))} />}</td>
                  <td><input className="input py-1 num text-right" type="number" value={e.offsetDays} onChange={(ev) => setTpl(t.id, (x) => ({ ...x, entries: x.entries.map((y, j) => j === i ? { ...y, offsetDays: +ev.target.value } : y) }))} /></td>
                  <td><select className="input py-1" value={e.anchor} onChange={(ev) => setTpl(t.id, (x) => ({ ...x, entries: x.entries.map((y, j) => j === i ? { ...y, anchor: ev.target.value as "invoice" | "event" } : y) }))}><option value="invoice">Invoice date</option><option value="event">Event date</option></select></td>
                  <td><button className="btn-ghost px-1 text-ink-500 hover:text-red-700" onClick={() => setTpl(t.id, (x) => ({ ...x, entries: x.entries.filter((_, j) => j !== i) }))}><Trash2 size={14} /></button></td></tr>))}</tbody></table>)}
          <button className="btn-ghost text-teal-700 mt-2" onClick={() => setTpl(t.id, (x) => ({ ...x, entries: [...x.entries, { label: "Payment", type: "percent", value: 25, offsetDays: 0, anchor: "invoice" }] }))}><Plus size={14} /> Add milestone</button>
        </section>))}
    </div>
  );
}

/* ---------------------------------------------------------------- Reminders & email */
function Email({ s, up }: P) {
  const T = (k: keyof Settings["email"], title: string) => (
    <section className="card p-5 space-y-3"><h2 className="font-semibold">{title}</h2>
      <Field label="Subject"><input className="input" value={s.email[k].subject} onChange={(e) => up((x) => ({ ...x, email: { ...x.email, [k]: { ...x.email[k], subject: e.target.value } } }))} /></Field>
      <Field label="Body"><textarea className="input font-mono text-xs" rows={7} value={s.email[k].body} onChange={(e) => up((x) => ({ ...x, email: { ...x.email, [k]: { ...x.email[k], body: e.target.value } } }))} /></Field>
    </section>);
  return (
    <div className="space-y-6">
      <section className="card p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-4"><h2 className="font-semibold">Reminders & late fees</h2><p className="text-xs text-ink-500">Drives the dashboard “needs attention” list and the reminder email button. Late fees are suggested, never added silently — you confirm each one.</p></div>
        <Field label="Show “due soon” (days before)"><input className="input num" type="number" min={0} value={s.reminders.dueSoonDays} onChange={(e) => up((x) => ({ ...x, reminders: { ...x.reminders, dueSoonDays: +e.target.value } }))} /></Field>
        <Field label="Late fee"><select className="input" value={s.reminders.lateFee.type} onChange={(e) => up((x) => ({ ...x, reminders: { ...x.reminders, lateFee: { ...x.reminders.lateFee, type: e.target.value as "none" | "percent" | "amount" } } }))}><option value="none">None</option><option value="percent">Percent of balance</option><option value="amount">Flat amount</option></select></Field>
        <Field label="Late fee value"><input className="input num" type="number" min={0} step="0.01" value={s.reminders.lateFee.value} onChange={(e) => up((x) => ({ ...x, reminders: { ...x.reminders, lateFee: { ...x.reminders.lateFee, value: +e.target.value } } }))} /></Field>
        <Field label="Grace period (days)"><input className="input num" type="number" min={0} value={s.reminders.lateFee.graceDays} onChange={(e) => up((x) => ({ ...x, reminders: { ...x.reminders, lateFee: { ...x.reminders.lateFee, graceDays: +e.target.value } } }))} /></Field>
      </section>
      <p className="text-xs text-ink-500">Merge tokens: <code>{"{{number}} {{contact}} {{company}} {{business}} {{event}} {{total}} {{balance}} {{dueDate}} {{overdueDays}} {{salesPerson}} {{phone}} {{paymentInstructions}} {{paymentAmount}}"}</code>. Emails open in your mail app with the document attached as a PDF you save from the print view.</p>
      <div className="grid lg:grid-cols-2 gap-6">{T("invoice", "Invoice email")}{T("estimate", "Estimate email")}{T("reminder", "Payment reminder")}{T("receipt", "Payment receipt")}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- Team & data */
function Data({ flash }: { flash: (m: string) => void }) {
  const store = useStore();
  const [reset, setReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <section className="card p-5 space-y-3">
        <h2 className="font-semibold">Team access</h2>
        <p className="text-sm text-ink-700">Two passcodes, set as environment variables on the host:</p>
        <ul className="text-sm space-y-1"><li><code className="bg-ink-100 px-1 rounded">INVOICE_PASSCODE</code> — admin: everything, including these settings.</li><li><code className="bg-ink-100 px-1 rounded">STAFF_PASSCODE</code> — staff: create and send documents, record payments; no settings.</li></ul>
        <p className="text-xs text-ink-500">Production version: named users with roles (admin, sales, accounting) via single sign-on, plus a per-user audit trail. Every document already carries an activity log.</p>
      </section>
      <section className="card p-5 space-y-3">
        <h2 className="font-semibold">Data</h2>
        <p className="text-xs text-ink-500">This prototype stores data in this browser. Export a backup before switching devices, or to hand data to the production database later. Backups include settings, templates and the logo.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([store.exportJSON()], { type: "application/json" })); a.download = `invoicing-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); }}><Download size={15} /> Export backup</button>
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}><Upload size={15} /> Restore backup</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const r = store.importJSON(await f.text()); flash(r.ok ? "Backup restored" : r.error); }} />
          <button className="btn-danger" onClick={() => setReset(true)}><RotateCcw size={15} /> Reset to demo data</button>
        </div>
        <p className="text-xs text-ink-500">Bulk import: <Link className="text-teal-700" href="/customers">Customers → Import CSV</Link> and <Link className="text-teal-700" href="/items">Items → Import CSV</Link>.</p>
      </section>
      <Confirm open={reset} onClose={() => setReset(false)} title="Reset to demo data?" body="All documents, customers, items, templates and settings in this browser will be replaced with the sample data." confirmLabel="Reset" danger onConfirm={() => { store.resetToDemo(); flash("Demo data restored"); }} />
    </div>
  );
}
