import type { Invoice, Settings } from "./types";
import type { Totals } from "./engine";
import { mergeTemplate } from "./calc";
import { daysBetween, fmtDate, money, todayISO } from "./format";

export function emailVars(inv: Invoice, s: Settings, t: Totals, extra: Record<string, string> = {}): Record<string, string> {
  return { number: inv.number, contact: inv.billTo.contactName || "there", company: inv.billTo.company, business: s.business.name, event: inv.eventName || "your event", total: money(t.total), balance: money(t.balance), dueDate: fmtDate(inv.dueDate, "long"), overdueDays: String(Math.max(0, daysBetween(inv.dueDate, todayISO()))), salesPerson: inv.salesPerson, phone: s.business.phone, paymentInstructions: s.paymentInstructions, ...extra };
}
export function openMail(to: string, tpl: { subject: string; body: string }, vars: Record<string, string>) {
  window.location.href = `mailto:${to}?subject=${encodeURIComponent(mergeTemplate(tpl.subject, vars))}&body=${encodeURIComponent(mergeTemplate(tpl.body, vars))}`;
}
