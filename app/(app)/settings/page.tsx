"use client";
import { useRef, useState } from "react";
import { Download, Upload, RotateCcw } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Settings } from "@/lib/types";
import { formatInvoiceNumber } from "@/lib/calc";
import { Confirm, Field, PageHeader } from "@/components/ui";

export default function SettingsPage() {
  const store = useStore();
  const s = store.settings;
  const [saved, setSaved] = useState("");
  const [reset, setReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const flash = (m: string) => { setSaved(m); setTimeout(() => setSaved(""), 2000); };
  const up = (fn: (s: Settings) => Settings) => { store.updateSettings(fn); flash("Saved"); };
  const pctIn = (v: number) => +(v * 100).toFixed(4);

  function exportBackup() {
    const blob = new Blob([store.exportJSON()], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `sturbridge-invoicing-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  }
  async function importBackup(f: File) {
    const r = store.importJSON(await f.text());
    flash(r.ok ? "Backup restored" : r.error);
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Changes save automatically." actions={saved && <span className="text-sm text-teal-700">{saved}</span>} />
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-5 space-y-4">
          <h2 className="font-semibold">Hotel details</h2>
          <p className="text-xs text-ink-500">Printed in the invoice header and payment stub.</p>
          {(["name", "address1", "city", "state", "zip", "country", "phone", "website", "email"] as const).map((k) => (
            <Field key={k} label={{ name: "Business name", address1: "Street address", city: "City", state: "State", zip: "ZIP", country: "Country", phone: "Phone", website: "Website", email: "Billing email" }[k]}>
              <input className="input" value={s.hotel[k]} onChange={(e) => up((x) => ({ ...x, hotel: { ...x.hotel, [k]: e.target.value } }))} />
            </Field>))}
        </section>

        <div className="space-y-6">
          <section className="card p-5 space-y-4">
            <h2 className="font-semibold">Taxes & charges</h2>
            <p className="text-xs text-ink-500">Applied only to lines flagged with the matching chip. Rooms and AV are typically exempt; food & beverage carries all three.</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Meals tax %"><input className="input num" type="number" step="0.01" value={pctIn(s.taxes.mealsTaxRate)} onChange={(e) => up((x) => ({ ...x, taxes: { ...x.taxes, mealsTaxRate: +e.target.value / 100 } }))} /></Field>
              <Field label="Service charge %"><input className="input num" type="number" step="0.01" value={pctIn(s.taxes.serviceChargeRate)} onChange={(e) => up((x) => ({ ...x, taxes: { ...x.taxes, serviceChargeRate: +e.target.value / 100 } }))} /></Field>
              <Field label="House charge %"><input className="input num" type="number" step="0.01" value={pctIn(s.taxes.houseChargeRate)} onChange={(e) => up((x) => ({ ...x, taxes: { ...x.taxes, houseChargeRate: +e.target.value / 100 } }))} /></Field>
              <Field label="Sales tax % on SC + HC"><input className="input num" type="number" step="0.01" value={pctIn(s.taxes.salesTaxRate)} onChange={(e) => up((x) => ({ ...x, taxes: { ...x.taxes, salesTaxRate: +e.target.value / 100 } }))} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.taxes.salesTaxOnCharges} onChange={(e) => up((x) => ({ ...x, taxes: { ...x.taxes, salesTaxOnCharges: e.target.checked } }))} /> Apply sales tax to service and house charges (Massachusetts rule)</label>
          </section>

          <section className="card p-5 space-y-4">
            <h2 className="font-semibold">Invoice numbering</h2>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Prefix"><input className="input" value={s.numbering.prefix} onChange={(e) => up((x) => ({ ...x, numbering: { ...x.numbering, prefix: e.target.value } }))} /></Field>
              <Field label="Next number"><input className="input num" type="number" min={1} value={s.numbering.next} onChange={(e) => up((x) => ({ ...x, numbering: { ...x.numbering, next: Math.max(1, +e.target.value) } }))} /></Field>
              <Field label="Min digits"><input className="input num" type="number" min={1} max={8} value={s.numbering.padding} onChange={(e) => up((x) => ({ ...x, numbering: { ...x.numbering, padding: Math.min(8, Math.max(1, +e.target.value)) } }))} /></Field>
            </div>
            <p className="text-xs text-ink-500">Next invoice will be <span className="font-mono text-ink-900">{formatInvoiceNumber(s.numbering, s.numbering.next)}</span></p>
          </section>

          <section className="card p-5 space-y-4">
            <h2 className="font-semibold">Defaults</h2>
            <Field label="Default terms"><select className="input" value={s.defaults.terms} onChange={(e) => up((x) => ({ ...x, defaults: { ...x.defaults, terms: e.target.value } }))}>{["Due on Receipt", "Net 7", "Net 15", "Net 30", "Net 45", "Net 60"].map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Default sales person"><input className="input" value={s.defaults.salesPerson} onChange={(e) => up((x) => ({ ...x, defaults: { ...x.defaults, salesPerson: e.target.value } }))} /></Field>
            <Field label="Sales people (one per line)"><textarea className="input" rows={3} value={s.salesPeople.join("\n")} onChange={(e) => up((x) => ({ ...x, salesPeople: e.target.value.split("\n").map((v) => v.trim()).filter(Boolean) }))} /></Field>
            <Field label="Default invoice notes"><textarea className="input" rows={2} value={s.defaults.notes} onChange={(e) => up((x) => ({ ...x, defaults: { ...x.defaults, notes: e.target.value } }))} /></Field>
            <Field label="Payment instructions (printed on every invoice)"><textarea className="input" rows={3} value={s.paymentInstructions} onChange={(e) => up((x) => ({ ...x, paymentInstructions: e.target.value }))} /></Field>
          </section>

          <section className="card p-5 space-y-3">
            <h2 className="font-semibold">Data</h2>
            <p className="text-xs text-ink-500">This prototype stores data in this browser. Export a backup before switching devices, or to hand data to the production database later.</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={exportBackup}><Download size={15} /> Export backup</button>
              <button className="btn-secondary" onClick={() => fileRef.current?.click()}><Upload size={15} /> Restore backup</button>
              <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
              <button className="btn-danger" onClick={() => setReset(true)}><RotateCcw size={15} /> Reset to demo data</button>
            </div>
          </section>
        </div>
      </div>
      <Confirm open={reset} onClose={() => setReset(false)} title="Reset to demo data?" body="All invoices, customers, items and settings in this browser will be replaced with the sample data." confirmLabel="Reset" danger onConfirm={() => { store.resetToDemo(); flash("Demo data restored"); }} />
    </>
  );
}
