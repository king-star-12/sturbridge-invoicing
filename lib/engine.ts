/**
 * Plug-and-play charge engine.
 *
 * Every tax, service charge, fee and gratuity is a ChargeRule. A rule's base is
 *   Σ (line net amounts whose tax class is in rule.appliesToClasses)
 * + Σ (already-computed amounts of the rules listed in rule.onCharges)
 * so "6.25% sales tax on service charge + house charge" is just a rule whose
 * base is two other rules. Rules are evaluated in dependency order, so the
 * order they are listed in doesn't matter.
 */
import type { ChargeRule, Discount, Invoice, LineItem, Settings, TaxClass } from "./types";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type LineBreakdown = { lineId: string; gross: number; discount: number; net: number; charges: Record<string, number> };
export type ChargeResult = { rule: ChargeRule; base: number; amount: number };

export type Totals = {
  subtotal: number;          // Σ line gross
  lineDiscounts: number;     // Σ per-line discounts
  invoiceDiscount: number;   // invoice-level discount
  net: number;               // taxable base before charges
  charges: ChargeResult[];   // in evaluation order, only non-zero
  chargesTotal: number;
  taxesTotal: number;        // kind === "tax"
  passThroughTotal: number;  // rules flagged passThrough (e.g. gratuity)
  total: number;
  paid: number;
  balance: number;
  lines: LineBreakdown[];
  /** Ready-to-print rows, honouring showOnDocument grouping. */
  displayRows: { label: string; amount: number; ruleIds: string[] }[];
};

export const lineGross = (li: LineItem) => r2((Number(li.qty) || 0) * (Number(li.rate) || 0));
export const lineDiscountAmount = (li: LineItem) => {
  const g = lineGross(li);
  if (!li.discount || !(li.discount.value > 0)) return 0;
  return Math.min(g, r2(li.discount.type === "percent" ? g * li.discount.value / 100 : li.discount.value));
};
export const lineNet = (li: LineItem) => r2(lineGross(li) - lineDiscountAmount(li));

export function ruleIsEffective(rule: ChargeRule, onDate: string): boolean {
  if (!rule.active) return false;
  if (rule.effectiveFrom && onDate < rule.effectiveFrom) return false;
  if (rule.effectiveTo && onDate > rule.effectiveTo) return false;
  return true;
}

/** Which rules touch a given line (class membership + per-line overrides). */
export function rulesForLine(li: LineItem, rules: ChargeRule[]): ChargeRule[] {
  return rules.filter((r) => {
    if (li.ruleOverrides?.exclude.includes(r.id)) return false;
    if (li.ruleOverrides?.include.includes(r.id)) return true;
    return r.appliesToClasses.includes(li.taxClassId);
  });
}

/** Topological order so a rule that compounds on others is computed after them. */
export function orderRules(rules: ChargeRule[]): ChargeRule[] {
  const byId = new Map(rules.map((r) => [r.id, r]));
  const out: ChargeRule[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (r: ChargeRule) => {
    const s = state.get(r.id);
    if (s === "done") return;
    if (s === "visiting") return; // cycle — ignore the back-edge
    state.set(r.id, "visiting");
    for (const dep of r.onCharges) { const d = byId.get(dep); if (d) visit(d); }
    state.set(r.id, "done");
    out.push(r);
  };
  rules.forEach(visit);
  return out;
}

export type ComputeInput = Pick<Invoice, "items" | "discount" | "payments"> & { invoiceDate?: string; taxExempt?: boolean };

export function computeTotals(inv: ComputeInput, tax: Settings["tax"]): Totals {
  const date = inv.invoiceDate ?? "9999-12-31";
  const active = orderRules(tax.rules.filter((r) => ruleIsEffective(r, date) && !(inv.taxExempt && r.kind === "tax")));

  const subtotal = r2(inv.items.reduce((a, li) => a + lineGross(li), 0));
  const lineDiscounts = r2(inv.items.reduce((a, li) => a + lineDiscountAmount(li), 0));
  const afterLine = r2(subtotal - lineDiscounts);

  let invoiceDiscount = 0;
  const d: Discount = inv.discount ?? { type: "none", value: 0, label: "" };
  if (d.type === "percent") invoiceDiscount = r2(afterLine * (d.value / 100));
  else if (d.type === "amount") invoiceDiscount = r2(d.value);
  invoiceDiscount = Math.min(invoiceDiscount, afterLine);
  const factor = afterLine > 0 ? (afterLine - invoiceDiscount) / afterLine : 1;

  const lines: LineBreakdown[] = inv.items.map((li) => ({ lineId: li.id, gross: lineGross(li), discount: lineDiscountAmount(li), net: r2(lineNet(li) * factor), charges: {} }));
  const net = r2(lines.reduce((a, l) => a + l.net, 0));

  const amounts = new Map<string, number>();
  const charges: ChargeResult[] = [];
  for (const rule of active) {
    let base = 0, amount = 0;
    if (rule.calc.type === "percent") {
      const rate = rule.calc.rate;
      if (rule.rounding === "line") {
        for (let i = 0; i < inv.items.length; i++) {
          const li = inv.items[i];
          if (!rulesForLine(li, [rule]).length) continue;
          const c = r2(lines[i].net * rate);
          lines[i].charges[rule.id] = c; base += lines[i].net; amount += c;
        }
        for (const dep of rule.onCharges) { const v = amounts.get(dep) ?? 0; base += v; amount += r2(v * rate); }
        base = r2(base); amount = r2(amount);
      } else {
        for (let i = 0; i < inv.items.length; i++) {
          const li = inv.items[i];
          if (!rulesForLine(li, [rule]).length) continue;
          base += lines[i].net;
          lines[i].charges[rule.id] = r2(lines[i].net * rate); // informational
        }
        for (const dep of rule.onCharges) base += amounts.get(dep) ?? 0;
        base = r2(base); amount = r2(base * rate);
      }
    } else {
      const { amount: flat, per } = rule.calc;
      if (per === "invoice") { amount = inv.items.some((li) => rulesForLine(li, [rule]).length) ? flat : 0; base = amount ? 1 : 0; }
      else {
        for (let i = 0; i < inv.items.length; i++) {
          const li = inv.items[i];
          if (!rulesForLine(li, [rule]).length) continue;
          const c = r2(per === "unit" ? flat * (Number(li.qty) || 0) : flat);
          lines[i].charges[rule.id] = c; amount += c; base += 1;
        }
        amount = r2(amount);
      }
    }
    amounts.set(rule.id, amount);
    if (amount !== 0) charges.push({ rule, base, amount });
  }

  const chargesTotal = r2(charges.reduce((a, c) => a + c.amount, 0));
  const taxesTotal = r2(charges.filter((c) => c.rule.kind === "tax").reduce((a, c) => a + c.amount, 0));
  const passThroughTotal = r2(charges.filter((c) => c.rule.passThrough).reduce((a, c) => a + c.amount, 0));
  const total = r2(net + chargesTotal);
  const paid = r2((inv.payments ?? []).reduce((a, p) => a + (Number(p.amount) || 0), 0));
  const balance = r2(total - paid);

  const displayRows: Totals["displayRows"] = [];
  const grouped = charges.filter((c) => c.rule.showOnDocument === "grouped");
  for (const c of charges.filter((c) => c.rule.showOnDocument === "separate")) {
    displayRows.push({ label: chargeLabel(c.rule), amount: c.amount, ruleIds: [c.rule.id] });
  }
  if (grouped.length) displayRows.push({ label: "Taxes & fees", amount: r2(grouped.reduce((a, c) => a + c.amount, 0)), ruleIds: grouped.map((c) => c.rule.id) });

  return { subtotal, lineDiscounts, invoiceDiscount, net, charges, chargesTotal, taxesTotal, passThroughTotal, total, paid, balance, lines, displayRows };
}

export const pctLabel = (r: number) => `${+(r * 100).toFixed(3)}%`;
export function chargeLabel(rule: ChargeRule): string {
  if (rule.calc.type === "percent") return `${rule.printLabel} (${pctLabel(rule.calc.rate)})`;
  return rule.printLabel;
}

/** Human explanation of a rule for the settings screen. */
export function describeRule(rule: ChargeRule, classes: TaxClass[]): string {
  const cls = rule.appliesToClasses.map((id) => classes.find((c) => c.id === id)?.name ?? id);
  const parts: string[] = [];
  if (rule.calc.type === "percent") parts.push(`${pctLabel(rule.calc.rate)} of`);
  else parts.push(`$${rule.calc.amount.toFixed(2)} per ${rule.calc.per} on`);
  const on: string[] = [];
  if (cls.length) on.push(cls.join(", "));
  if (rule.onCharges.length) on.push(`the ${rule.onCharges.length === 1 ? "amount" : "amounts"} of ${rule.onCharges.length} other charge${rule.onCharges.length === 1 ? "" : "s"}`);
  parts.push(on.length ? on.join(" + ") : "nothing yet");
  return parts.join(" ");
}

/** Problems the settings screen should surface before a rule set is used. */
export function validateRules(rules: ChargeRule[], classes: TaxClass[]): string[] {
  const issues: string[] = [];
  const ids = new Set(rules.map((r) => r.id));
  const classIds = new Set(classes.map((c) => c.id));
  for (const r of rules) {
    if (!r.printLabel.trim()) issues.push(`Rule "${r.name || r.id}" has no printed label.`);
    if (r.calc.type === "percent" && !(r.calc.rate >= 0 && r.calc.rate < 1)) issues.push(`"${r.name}" rate should be between 0% and 100%.`);
    for (const d of r.onCharges) if (!ids.has(d)) issues.push(`"${r.name}" compounds on a charge that no longer exists.`);
    for (const c of r.appliesToClasses) if (!classIds.has(c)) issues.push(`"${r.name}" applies to a tax class that no longer exists.`);
    if (r.calc.type === "percent" && !r.appliesToClasses.length && !r.onCharges.length && r.active) issues.push(`"${r.name}" applies to nothing and will never charge.`);
  }
  // cycle check
  const ordered = orderRules(rules);
  const pos = new Map(ordered.map((r, i) => [r.id, i]));
  for (const r of rules) for (const d of r.onCharges) if ((pos.get(d) ?? -1) > (pos.get(r.id) ?? -1)) issues.push(`"${r.name}" and another rule compound on each other (circular).`);
  return issues;
}
