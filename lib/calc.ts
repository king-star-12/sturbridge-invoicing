import type { Invoice, LineItem, Settings } from "./types";
import { addDays, todayISO } from "./format";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type Totals = {
  subtotal: number;
  discount: number;
  taxableBase: { meals: number; service: number; house: number };
  mealsTax: number;
  serviceCharge: number;
  houseCharge: number;
  salesTaxOnCharges: number;
  total: number;
  paid: number;
  balance: number;
  lines: { label: string; amount: number }[];
};

export const lineAmount = (li: LineItem) => r2((Number(li.qty) || 0) * (Number(li.rate) || 0));

export function computeTotals(inv: Pick<Invoice, "items" | "discount" | "payments">, s: Settings["taxes"]): Totals {
  const subtotal = r2(inv.items.reduce((a, li) => a + lineAmount(li), 0));

  let discount = 0;
  if (inv.discount?.type === "percent") discount = r2(subtotal * (inv.discount.value / 100));
  else if (inv.discount?.type === "amount") discount = r2(inv.discount.value);
  discount = Math.min(discount, subtotal);
  const discountFactor = subtotal > 0 ? (subtotal - discount) / subtotal : 1;

  // Taxable bases are computed per line so mixed invoices (rooms + F&B) charge correctly.
  const base = { meals: 0, service: 0, house: 0 };
  for (const li of inv.items) {
    const amt = lineAmount(li) * discountFactor;
    if (li.tax.meals) base.meals += amt;
    if (li.tax.service) base.service += amt;
    if (li.tax.house) base.house += amt;
  }
  base.meals = r2(base.meals); base.service = r2(base.service); base.house = r2(base.house);

  const mealsTax = r2(base.meals * s.mealsTaxRate);
  const serviceCharge = r2(base.service * s.serviceChargeRate);
  const houseCharge = r2(base.house * s.houseChargeRate);
  const salesTaxOnCharges = s.salesTaxOnCharges ? r2((serviceCharge + houseCharge) * s.salesTaxRate) : 0;

  const total = r2(subtotal - discount + mealsTax + serviceCharge + houseCharge + salesTaxOnCharges);
  const paid = r2((inv.payments ?? []).reduce((a, p) => a + (Number(p.amount) || 0), 0));
  const balance = r2(total - paid);

  const lines: Totals["lines"] = [];
  if (mealsTax) lines.push({ label: `Meals Tax (${pctLabel(s.mealsTaxRate)})`, amount: mealsTax });
  if (serviceCharge) lines.push({ label: `Service Charge (${pctLabel(s.serviceChargeRate)})`, amount: serviceCharge });
  if (houseCharge) lines.push({ label: `House Charge (${pctLabel(s.houseChargeRate)})`, amount: houseCharge });
  if (salesTaxOnCharges) lines.push({ label: `MA Sales Tax on SC + HC (${pctLabel(s.salesTaxRate)})`, amount: salesTaxOnCharges });

  return { subtotal, discount, taxableBase: base, mealsTax, serviceCharge, houseCharge, salesTaxOnCharges, total, paid, balance, lines };
}

export const pctLabel = (r: number) => `${+(r * 100).toFixed(3)}%`;

export function dueDateFor(invoiceDate: string, terms: string, custom?: string): string {
  const m = /net\s*(\d+)/i.exec(terms);
  if (m) return addDays(invoiceDate, +m[1]);
  if (/receipt/i.test(terms)) return invoiceDate;
  return custom || invoiceDate;
}

export type DerivedStatus = "draft" | "sent" | "partial" | "paid" | "overdue" | "void";

/** Status shown in the UI: stored status + overdue derived from due date and balance. */
export function derivedStatus(inv: Invoice, taxes: Settings["taxes"], today = todayISO()): DerivedStatus {
  if (inv.status === "void") return "void";
  if (inv.status === "draft") return "draft";
  const t = computeTotals(inv, taxes);
  if (t.balance <= 0.004 && t.total > 0) return "paid";
  if (t.paid > 0) return inv.dueDate < today ? "overdue" : "partial";
  return inv.dueDate < today ? "overdue" : "sent";
}

export function formatInvoiceNumber(n: Settings["numbering"], value: number): string {
  return `${n.prefix}${String(value).padStart(n.padding, "0")}`;
}
