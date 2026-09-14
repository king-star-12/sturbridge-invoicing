"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRightLeft, Ban, BellRing, Check, Copy, CreditCard, History, Mail, Pencil, Printer, Send, ThumbsDown, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { computeTotals, derivedStatus, lateFeeFor, resolveSchedule } from "@/lib/calc";
import { fmtDate, money, todayISO } from "@/lib/format";
import { emailVars, openMail } from "@/lib/email";
import { uid } from "@/lib/id";
import type { Payment } from "@/lib/types";
import InvoiceDocument from "@/components/InvoiceDocument";
import FitDoc from "@/components/FitDoc";
import { Confirm, Empty, Field, Modal, PageHeader, StatusBadge } from "@/components/ui";

export default function DocDetail() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const router = useRouter();
  const [pay, setPay] = useState(false);
  const [voidC, setVoidC] = useState(false);
  const [delC, setDelC] = useState(false);
  const [delPay, setDelPay] = useState<string | null>(null);
  const [lateC, setLateC] = useState(false);
  const [toast, setToast] = useState("");
  if (!store.ready) return null;
  const inv = store.getInvoice(id);
  if (!inv) return <Empty title="Document not found" action={<Link href="/invoices" className="btn-secondary">Back to invoices</Link>} />;
  const s = store.settings;
  const t = computeTotals(inv, s.tax);
  const st = derivedStatus(inv, s.tax);
  const isEst = inv.kind === "estimate";
  const locked = inv.status === "void" || inv.status === "converted";
  const lateFee = !isEst ? lateFeeFor(inv, t.balance, s.reminders.lateFee) : 0;
  const sched = inv.schedule.length ? resolveSchedule(inv.schedule, t.total, t.paid) : [];
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2500); };
  const markSent = () => { store.updateInvoice(inv.id, { status: "sent", sentAt: new Date().toISOString() }, "Marked as sent"); flash("Marked as sent."); };
  const email = (kind: "invoice" | "estimate" | "reminder") => { openMail(inv.billTo.email, s.email[kind], emailVars(inv, s, t)); store.updateInvoice(inv.id, (i) => ({ ...i, status: i.status === "draft" ? "sent" : i.status, sentAt: i.sentAt ?? new Date().toISOString() }), kind === "reminder" ? "Reminder emailed" : "Emailed to customer"); };
  const addLateFee = () => store.updateInvoice(inv.id, (i) => ({ ...i, items: [...i.items, { id: uid("li"), name: "Late payment fee", description: `Per terms: ${s.reminders.lateFee.type === "percent" ? `${s.reminders.lateFee.value}% of overdue balance` : "flat fee"}`, qty: 1, rate: lateFee, taxClassId: "exempt" }] }), `Late fee added: ${money(lateFee)}`);

  return (
    <>
      <PageHeader title={inv.number} subtitle={<span className="flex items-center gap-2"><StatusBadge status={st} /><span>{inv.billTo.company}{inv.eventName ? ` · ${inv.eventName}` : ""}</span>{inv.convertedFromId && <Link className="text-teal-700 text-xs" href={`/invoices/${inv.convertedFromId}`}>from estimate</Link>}{inv.convertedToId && <Link className="text-teal-700 text-xs" href={`/invoices/${inv.convertedToId}`}>→ invoice</Link>}</span>}
        actions={<>
          {!locked && <Link href={`/invoices/${inv.id}/edit`} className="btn-secondary"><Pencil size={15} /> Edit</Link>}
          <Link href={`/print/${inv.id}`} target="_blank" className="btn-secondary"><Printer size={15} /> Print / PDF</Link>
          {!locked && <button className="btn-secondary" onClick={() => email(isEst ? "estimate" : "invoice")}><Mail size={15} /> Email</button>}
          {!locked && !isEst && st === "overdue" && <button className="btn-secondary text-red-700" onClick={() => email("reminder")}><BellRing size={15} /> Send reminder</button>}
          {!locked && !isEst && st !== "paid" && <button className="btn-primary" onClick={() => setPay(true)}><CreditCard size={15} /> Record payment</button>}
          {!locked && isEst && (st === "sent" || st === "expired" || st === "draft") && <button className="btn-primary" onClick={() => store.updateInvoice(inv.id, { status: "accepted" }, "Marked accepted")}><Check size={15} /> Mark accepted</button>}
          {!locked && isEst && st === "accepted" && <button className="btn-primary" onClick={() => { const n = store.convertEstimate(inv.id); if (n) router.push(`/invoices/${n.id}/edit`); }}><ArrowRightLeft size={15} /> Convert to invoice</button>}
        </>} />
      {toast && <div className="fixed bottom-6 right-6 z-50 rounded-md bg-ink-900 text-white text-sm px-4 py-2 shadow-lg">{toast}</div>}

      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="doc-wrap rounded-lg bg-ink-100 p-3 md:p-6 min-w-0"><FitDoc><InvoiceDocument inv={inv} settings={s} showStub={false} /></FitDoc></div>
        <aside className="space-y-4">
          <section className="card p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-500">Total</span><span className="num font-medium">{money(t.total)}</span></div>
            {!isEst && <div className="flex justify-between"><span className="text-ink-500">Paid</span><span className="num">{money(t.paid)}</span></div>}
            {!isEst && <div className="flex justify-between font-semibold text-base border-t border-ink-100 pt-2"><span>Balance due</span><span className="num">{money(t.balance)}</span></div>}
            {t.taxesTotal > 0 && <div className="flex justify-between text-xs text-ink-500"><span>of which taxes</span><span className="num">{money(t.taxesTotal)}</span></div>}
            <div className="text-xs text-ink-500 pt-1">{isEst ? "Valid until" : "Due"} {fmtDate(inv.dueDate)}{inv.sentAt ? ` · Sent ${fmtDate(inv.sentAt)}` : ""}</div>
            {lateFee > 0 && !inv.items.some((l) => l.name === "Late payment fee") && <button className="btn-secondary w-full justify-center text-red-700 mt-1" onClick={() => setLateC(true)}>Add {money(lateFee)} late fee</button>}
          </section>
          {sched.length > 0 && (<section className="card"><div className="px-4 py-3 border-b border-ink-100 font-semibold text-sm">Payment schedule</div><ul className="divide-y divide-ink-100">{sched.map((r) => <li key={r.id} className="px-4 py-2 text-sm flex justify-between gap-2"><div><div className={r.settled ? "line-through text-ink-500" : ""}>{r.label}</div><div className="text-xs text-ink-500">due {fmtDate(r.dueDate)}{!r.settled && r.dueDate < todayISO() ? " · late" : ""}</div></div><div className="num text-right">{money(r.amount)}{r.paid > 0 && !r.settled && <div className="text-xs text-ink-500">{money(r.paid)} in</div>}</div></li>)}</ul></section>)}
          {!isEst && (<section className="card"><div className="px-4 py-3 border-b border-ink-100 font-semibold text-sm">Payments</div>
            {inv.payments.length === 0 ? <div className="px-4 py-3 text-sm text-ink-500">No payments recorded.</div> : (<ul className="divide-y divide-ink-100">{inv.payments.map((p) => (<li key={p.id} className="px-4 py-2.5 text-sm flex justify-between gap-2"><div><div className="font-medium num">{money(p.amount)}</div><div className="text-xs text-ink-500">{fmtDate(p.date)} · {p.method}{p.reference ? ` · ${p.reference}` : ""}</div>{p.note && <div className="text-xs text-ink-500">{p.note}</div>}</div><div className="flex items-start gap-1">{inv.billTo.email && <button className="btn-ghost px-1 text-ink-500" title="Email receipt" onClick={() => openMail(inv.billTo.email, s.email.receipt, emailVars(inv, s, t, { paymentAmount: money(p.amount) }))}><Mail size={14} /></button>}{!locked && <button className="btn-ghost px-1 text-ink-500 hover:text-red-700" title="Remove payment" onClick={() => setDelPay(p.id)}><Trash2 size={14} /></button>}</div></li>))}</ul>)}
          </section>)}
          {inv.internalNotes && <section className="card p-4 text-sm"><div className="font-semibold mb-1">Internal notes</div><div className="whitespace-pre-wrap text-ink-700">{inv.internalNotes}</div></section>}
          <section className="card p-2 flex flex-col">
            {inv.status === "draft" && <button className="btn-ghost justify-start" onClick={markSent}><Send size={15} /> Mark as sent</button>}
            {isEst && !locked && st !== "declined" && <button className="btn-ghost justify-start" onClick={() => store.updateInvoice(inv.id, { status: "declined" }, "Marked declined")}><ThumbsDown size={15} /> Mark declined</button>}
            <button className="btn-ghost justify-start" onClick={() => { const d = store.duplicateInvoice(inv.id); if (d) router.push(`/invoices/${d.id}/edit`); }}><Copy size={15} /> Duplicate</button>
            {!isEst && <button className="btn-ghost justify-start" onClick={() => { const d = store.duplicateInvoice(inv.id, "estimate"); if (d) router.push(`/invoices/${d.id}/edit`); }}><Copy size={15} /> Copy as estimate</button>}
            {!locked && <button className="btn-ghost justify-start" onClick={() => setVoidC(true)}><Ban size={15} /> Void</button>}
            {inv.status === "draft" && <button className="btn-ghost justify-start text-red-700" onClick={() => setDelC(true)}><Trash2 size={15} /> Delete draft</button>}
          </section>
          <section className="card"><div className="px-4 py-2.5 border-b border-ink-100 font-semibold text-sm flex items-center gap-2"><History size={14} /> Activity</div><ul className="divide-y divide-ink-100 max-h-56 overflow-auto">{[...(inv.activity ?? [])].reverse().map((a, i) => <li key={i} className="px-4 py-1.5 text-xs"><span className="text-ink-500">{fmtDate(a.at)}</span> · {a.event}{a.detail ? ` — ${a.detail}` : ""}</li>)}{(inv.activity ?? []).length === 0 && <li className="px-4 py-2 text-xs text-ink-500">No activity yet.</li>}</ul></section>
        </aside>
      </div>

      <PaymentModal open={pay} onClose={() => setPay(false)} balance={t.balance} methods={s.paymentMethods} suggested={sched.find((r) => !r.settled)?.amount} onSave={(p) => { store.updateInvoice(inv.id, (i) => ({ ...i, status: i.status === "draft" ? "sent" : i.status, payments: [...i.payments, p] }), `Payment recorded: ${money(p.amount)} by ${p.method}${p.reference ? ` ${p.reference}` : ""}`); setPay(false); flash("Payment recorded."); }} />
      <Confirm open={voidC} onClose={() => setVoidC(false)} title={`Void ${inv.number}?`} body="It stays on record marked VOID and can no longer be edited or paid. Numbering stays intact." confirmLabel="Void" danger onConfirm={() => store.updateInvoice(inv.id, { status: "void" }, "Voided")} />
      <Confirm open={delC} onClose={() => setDelC(false)} title="Delete this draft?" body="Deleting removes it permanently. The number will not be reused." confirmLabel="Delete" danger onConfirm={() => { store.deleteInvoice(inv.id); router.push(isEst ? "/estimates" : "/invoices"); }} />
      <Confirm open={!!delPay} onClose={() => setDelPay(null)} title="Remove this payment?" body="The balance due will increase by the payment amount." confirmLabel="Remove" danger onConfirm={() => store.updateInvoice(inv.id, (i) => ({ ...i, payments: i.payments.filter((p) => p.id !== delPay) }), "Payment removed")} />
      <Confirm open={lateC} onClose={() => setLateC(false)} title={`Add a ${money(lateFee)} late fee?`} body="A non-taxable line is added to the invoice per your late-fee policy. You can edit or remove it afterwards." confirmLabel="Add late fee" onConfirm={addLateFee} />
    </>
  );
}

function PaymentModal({ open, onClose, balance, methods, suggested, onSave }: { open: boolean; onClose: () => void; balance: number; methods: string[]; suggested?: number; onSave: (p: Payment) => void }) {
  const [p, setP] = useState<Payment>({ id: "", date: todayISO(), amount: balance, method: methods[0] ?? "Check", reference: "", note: "" });
  const [err, setErr] = useState("");
  const [seen, setSeen] = useState(false);
  if (open && !seen) { setSeen(true); setP({ id: "", date: todayISO(), amount: Math.max(suggested ?? balance, 0), method: methods[0] ?? "Check", reference: "", note: "" }); }
  if (!open && seen) setSeen(false);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!(p.amount > 0)) return setErr("Enter an amount greater than zero.");
    if (p.amount > balance + 0.004) return setErr(`That's more than the ${money(balance)} balance. Reduce the amount or note an overpayment.`);
    if (!p.date) return setErr("Payment date is required.");
    onSave({ ...p, id: uid("pay"), amount: Math.round(p.amount * 100) / 100 });
  }
  return (
    <Modal open={open} onClose={onClose} title="Record payment">
      <form onSubmit={submit} className="grid grid-cols-2 gap-4">
        <Field label="Amount" hint={suggested && suggested < balance ? `Next milestone: ${money(suggested)}` : undefined}><input className="input num" type="number" step="0.01" min={0} autoFocus value={p.amount} onChange={(e) => setP({ ...p, amount: +e.target.value })} onFocus={(e) => e.target.select()} /></Field>
        <Field label="Date"><input className="input" type="date" value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} /></Field>
        <Field label="Method"><select className="input" value={p.method} onChange={(e) => setP({ ...p, method: e.target.value })}>{methods.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Reference"><input className="input" placeholder="Check # / last 4 / confirmation" value={p.reference} onChange={(e) => setP({ ...p, reference: e.target.value })} /></Field>
        <Field label="Note" className="col-span-2"><input className="input" value={p.note} onChange={(e) => setP({ ...p, note: e.target.value })} /></Field>
        {err && <p className="col-span-2 text-sm text-red-700">{err}</p>}
        <div className="col-span-2 flex justify-between items-center"><span className="text-xs text-ink-500">Balance due: {money(balance)}</span><div className="flex gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary">Save payment</button></div></div>
      </form>
    </Modal>
  );
}
