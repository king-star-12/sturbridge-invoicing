import type { Invoice, NumberingRule, ScheduleEntry, Settings } from "./types";
import { addDays, todayISO } from "./format";
import { computeTotals } from "./engine";
export { computeTotals, lineGross as lineAmount, pctLabel } from "./engine";

export function dueDateFor(invoiceDate: string, terms: string, custom?: string): string {
  const m = /net\s*(\d+)/i.exec(terms);
  if (m) return addDays(invoiceDate, +m[1]);
  if (/receipt/i.test(terms)) return invoiceDate;
  const eom = /end of month/i.test(terms);
  if (eom) { const d = new Date(invoiceDate); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0); return last.toISOString().slice(0, 10); }
  return custom || invoiceDate;
}

export type DerivedStatus = "draft" | "sent" | "partial" | "paid" | "overdue" | "void" | "accepted" | "declined" | "converted" | "expired";

export function derivedStatus(inv: Invoice, tax: Settings["tax"], today = todayISO()): DerivedStatus {
  if (inv.status === "void") return "void";
  if (inv.status === "draft") return "draft";
  if (inv.kind === "estimate") {
    if (inv.status === "accepted" || inv.status === "declined" || inv.status === "converted") return inv.status;
    return inv.dueDate < today ? "expired" : "sent";
  }
  const t = computeTotals(inv, tax);
  if (t.balance <= 0.004 && t.total > 0) return "paid";
  if (t.paid > 0) return inv.dueDate < today ? "overdue" : "partial";
  return inv.dueDate < today ? "overdue" : "sent";
}

export const isOpen = (s: DerivedStatus) => s === "sent" || s === "partial" || s === "overdue";

/** Pattern tokens: {SEQ:4} {YYYY} {YY} {MM} — anything else is literal. */
export function formatNumber(rule: NumberingRule, seq: number, date = new Date()): string {
  return rule.pattern.replace(/\{SEQ(?::(\d+))?\}/g, (_, pad) => String(seq).padStart(pad ? +pad : 1, "0"))
    .replace(/\{YYYY\}/g, String(date.getFullYear()))
    .replace(/\{YY\}/g, String(date.getFullYear()).slice(-2))
    .replace(/\{MM\}/g, String(date.getMonth() + 1).padStart(2, "0"));
}

/** Advance a numbering rule, honouring yearly reset. Returns [number, nextRule]. */
export function takeNumber(rule: NumberingRule, date = new Date()): [string, NumberingRule] {
  let r = { ...rule };
  const year = date.getFullYear();
  if (r.resetYearly && r.lastResetYear !== year) r = { ...r, next: 1, lastResetYear: year };
  return [formatNumber(r, r.next, date), { ...r, next: r.next + 1, lastResetYear: r.resetYearly ? year : r.lastResetYear }];
}

/** Expand a deposit template into concrete schedule entries for an invoice. */
export function buildSchedule(template: Settings["deposits"]["templates"][number] | undefined, inv: Pick<Invoice, "invoiceDate" | "eventStart">): ScheduleEntry[] {
  if (!template) return [];
  return template.entries.map((e, i) => {
    const anchor = e.anchor === "event" && inv.eventStart ? inv.eventStart : inv.invoiceDate;
    return { id: `sch_${i}`, label: e.label, type: e.type, value: e.value, dueDate: addDays(anchor, e.offsetDays) };
  });
}

/** Resolve schedule entries to amounts and mark which are covered by payments (FIFO). */
export function resolveSchedule(schedule: ScheduleEntry[], total: number, paid: number) {
  let remaining = total;
  const rows = schedule.map((e) => {
    const amount = e.type === "balance" ? remaining : e.type === "percent" ? Math.round(total * e.value) / 100 : e.value;
    const amt = Math.min(Math.max(amount, 0), remaining);
    remaining = Math.round((remaining - amt) * 100) / 100;
    return { ...e, amount: amt };
  });
  let cash = paid;
  return rows.map((r) => { const covered = Math.min(cash, r.amount); cash = Math.round((cash - covered) * 100) / 100; return { ...r, paid: covered, settled: covered >= r.amount - 0.004 }; });
}

export function lateFeeFor(inv: Invoice, balance: number, s: Settings["reminders"]["lateFee"], today = todayISO()): number {
  if (s.type === "none" || balance <= 0) return 0;
  if (addDays(inv.dueDate, s.graceDays) >= today) return 0;
  return Math.round((s.type === "percent" ? balance * s.value / 100 : s.value) * 100) / 100;
}

/** Merge tokens for email templates. */
export function mergeTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}
