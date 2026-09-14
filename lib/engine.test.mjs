// Regression test: the engine must reproduce the hotel's real invoices. Run: node lib/engine.test.mjs
import { computeTotals } from "./engine.ts";
import { buildSeedDatabase } from "./seed.ts";
import { getPreset } from "./presets.ts";
const db = buildSeedDatabase();
const t1 = computeTotals(db.invoices[0], db.settings.tax);
const t2 = computeTotals(db.invoices[1], db.settings.tax);
const chk = (name, got, want) => { const ok = Math.abs(got - want) < 0.005; console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${got} (want ${want})`); if (!ok) process.exitCode = 1; };
chk("1001 subtotal", t1.subtotal, 4090); chk("1001 meals", t1.charges.find(c => c.rule.id === "ma_meals").amount, 149.80);
chk("1001 svc", t1.charges.find(c => c.rule.id === "svc").amount, 299.60); chk("1001 house", t1.charges.find(c => c.rule.id === "house").amount, 171.20);
chk("1001 sales on charges", t1.charges.find(c => c.rule.id === "ma_sales_on_charges").amount, 29.43); chk("1001 total", t1.total, 4740.03);
chk("1002 total", t2.total, 873.65); chk("1002 balance", t2.balance, 0);
// tax-exempt customer: taxes drop, service/house stay
const te = computeTotals({ ...db.invoices[1], taxExempt: true }, db.settings.tax);
chk("exempt: no meals tax", te.charges.some(c => c.rule.id === "ma_meals") ? 1 : 0, 0); chk("exempt: svc stays", te.charges.find(c => c.rule.id === "svc").amount, 61.60);
// guest rooms: occupancy taxes
const gr = computeTotals({ items: [{ id: "x", name: "Room", description: "", qty: 10, rate: 159, taxClassId: "guest_rooms" }], discount: { type: "none", value: 0, label: "" }, payments: [] }, db.settings.tax);
chk("rooms state 5.7%", gr.charges.find(c => c.rule.id === "ma_rooms_state").amount, 90.63); chk("rooms local 6%", gr.charges.find(c => c.rule.id === "ma_rooms_local").amount, 95.40);
// preset swap: HST compounds on gratuity
const ca = getPreset("ca_hst");
const hst = computeTotals({ items: [{ id: "x", name: "Dinner", description: "", qty: 100, rate: 50, taxClassId: "fnb" }], discount: { type: "none", value: 0, label: "" }, payments: [] }, { ...db.settings.tax, rules: ca.rules, classes: ca.classes });
chk("HST on 5000 + 900 gratuity", hst.charges.find(c => c.rule.id === "hst").amount, 767); chk("HST total", hst.total, 6667);
// line override: exclude service charge on one F&B line
const ov = computeTotals({ ...db.invoices[1], items: db.invoices[1].items.map(l => l.id === "l2" ? { ...l, ruleOverrides: { include: [], exclude: ["svc"] } } : l) }, db.settings.tax);
chk("override drops svc", ov.charges.some(c => c.rule.id === "svc") ? 1 : 0, 0);
// invoice discount 10% flows into bases
const disc = computeTotals({ ...db.invoices[1], discount: { type: "percent", value: 10, label: "" } }, db.settings.tax);
chk("discounted meals base 396", disc.charges.find(c => c.rule.id === "ma_meals").amount, 27.72);
