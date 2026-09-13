"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Copy, CreditCard, Mail, Pencil, Printer, Send, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { computeTotals, derivedStatus } from "@/lib/calc";
import { fmtDate, money, todayISO } from "@/lib/format";
import { uid } from "@/lib/id";
import type { Payment } from "@/lib/types";
import InvoiceDocument from "@/components/InvoiceDocument";
import FitDoc from "@/components/FitDoc";
import { Confirm, Empty, Field, Modal, PageHeader, StatusBadge } from "@/components/ui";

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const router = useRouter();
  const [pay, setPay] = useState(false);
  const [voidC, setVoidC] = useState(false);
  const [delC, setDelC] = useState(false);
  const [delPay, setDelPay] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  if (!store.ready) return null;
  const inv = store.getInvoice(id);
  if (!inv) return <Empty title="Invoice not found" action={<Link href="/invoices" className="btn-secondary">Back to invoices</Link>} />;
  const t = computeTotals(inv, store.settings.taxes);
  const st = derivedStatus(inv, store.settings.taxes);
  const canEdit = inv.status !== "void";

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(""), 2500); }
  function markSent() { store.updateInvoice(inv!.id, { status: "sent", sentAt: new Date().toISOString() }); flash("Marked as sent."); }
  function emailInvoice() {
    const h = store.settings.hotel;
    const subject = encodeURIComponent(`Invoice ${inv!.number} from ${h.name}`);
    const body = encodeURIComponent(`Hello ${inv!.billTo.contactName || ""},\n\nPlease find attached invoice ${inv!.number} for ${inv!.eventName || "your event"} in the amount of ${money(t.total)}, due ${fmtDate(inv!.dueDate, "long")}.\n\n${store.settings.paymentInstructions}\n\nThank you,\n${inv!.salesPerson}\n${h.name}\n${h.phone}`);
    window.location.href = `mailto:${inv!.billTo.email}?subject=${subject}&body=${body}`;
    if (inv!.status === "draft") markSent();
  }

  return (
    <>
      <PageHeader title={inv.number} subtitle={<span className="flex items-center gap-2"><StatusBadge status={st} /><span>{inv.billTo.company}{inv.eventName ? ` · ${inv.eventName}` : ""}</span></span>}
        actions={<>
          {canEdit && <Link href={`/invoices/${inv.id}/edit`} className="btn-secondary"><Pencil size={15} /> Edit</Link>}
          <Link href={`/print/${inv.id}`} target="_blank" className="btn-secondary"><Printer size={15} /> Print / PDF</Link>
          {canEdit && <button className="btn-secondary" onClick={emailInvoice}><Mail size={15} /> Email</button>}
          {canEdit && st !== "paid" && <button className="btn-primary" onClick={() => setPay(true)}><CreditCard size={15} /> Record payment</button>}
        </>} />

      {toast && <div className="fixed bottom-6 right-6 z-50 rounded-md bg-ink-900 text-white text-sm px-4 py-2 shadow-lg">{toast}</div>}

      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="doc-wrap rounded-lg bg-ink-100 p-3 md:p-6 min-w-0">
          <FitDoc><InvoiceDocument inv={inv} settings={store.settings} showStub={false} /></FitDoc>
        </div>

        <aside className="space-y-4">
          <section className="card p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-500">Total</span><span className="num font-medium">{money(t.total)}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Paid</span><span className="num">{money(t.paid)}</span></div>
            <div className="flex justify-between font-semibold text-base border-t border-ink-100 pt-2"><span>Balance due</span><span className="num">{money(t.balance)}</span></div>
            <div className="text-xs text-ink-500 pt-1">Issued {fmtDate(inv.invoiceDate)} · Due {fmtDate(inv.dueDate)}{inv.sentAt ? ` · Sent ${fmtDate(inv.sentAt.slice(0, 10))}` : ""}</div>
          </section>

          <section className="card">
            <div className="px-4 py-3 border-b border-ink-100 font-semibold text-sm">Payments</div>
            {inv.payments.length === 0 ? <div className="px-4 py-3 text-sm text-ink-500">No payments recorded.</div> : (
              <ul className="divide-y divide-ink-100">{inv.payments.map((p) => (
                <li key={p.id} className="px-4 py-2.5 text-sm flex justify-between gap-2">
                  <div><div className="font-medium num">{money(p.amount)}</div><div className="text-xs text-ink-500">{fmtDate(p.date)} · {p.method}{p.reference ? ` · ${p.reference}` : ""}</div>{p.note && <div className="text-xs text-ink-500">{p.note}</div>}</div>
                  {canEdit && <button className="btn-ghost px-1 text-ink-500 hover:text-red-700" title="Remove payment" onClick={() => setDelPay(p.id)}><Trash2 size={14} /></button>}
                </li>))}</ul>)}
          </section>

          {inv.internalNotes && <section className="card p-4 text-sm"><div className="font-semibold mb-1">Internal notes</div><div className="whitespace-pre-wrap text-ink-700">{inv.internalNotes}</div></section>}

          <section className="card p-2 flex flex-col">
            {inv.status === "draft" && <button className="btn-ghost justify-start" onClick={markSent}><Send size={15} /> Mark as sent</button>}
            <button className="btn-ghost justify-start" onClick={() => { const d = store.duplicateInvoice(inv.id); if (d) router.push(`/invoices/${d.id}/edit`); }}><Copy size={15} /> Duplicate</button>
            {canEdit && <button className="btn-ghost justify-start" onClick={() => setVoidC(true)}><Ban size={15} /> Void invoice</button>}
            {inv.status === "draft" && <button className="btn-ghost justify-start text-red-700" onClick={() => setDelC(true)}><Trash2 size={15} /> Delete draft</button>}
          </section>
        </aside>
      </div>

      <PaymentModal open={pay} onClose={() => setPay(false)} balance={t.balance} onSave={(p) => { store.updateInvoice(inv.id, (i) => ({ ...i, status: i.status === "draft" ? "sent" : i.status, payments: [...i.payments, p] })); setPay(false); flash("Payment recorded."); }} />
      <Confirm open={voidC} onClose={() => setVoidC(false)} title={`Void ${inv.number}?`} body="The invoice stays on record marked VOID and can no longer be edited or paid. This keeps your numbering sequence intact." confirmLabel="Void invoice" danger onConfirm={() => store.updateInvoice(inv.id, { status: "void" })} />
      <Confirm open={delC} onClose={() => setDelC(false)} title="Delete this draft?" body="Deleting removes it permanently. The invoice number will not be reused." confirmLabel="Delete" danger onConfirm={() => { store.deleteInvoice(inv.id); router.push("/invoices"); }} />
      <Confirm open={!!delPay} onClose={() => setDelPay(null)} title="Remove this payment?" body="The balance due will increase by the payment amount." confirmLabel="Remove" danger onConfirm={() => store.updateInvoice(inv.id, (i) => ({ ...i, payments: i.payments.filter((p) => p.id !== delPay) }))} />
    </>
  );
}

function PaymentModal({ open, onClose, balance, onSave }: { open: boolean; onClose: () => void; balance: number; onSave: (p: Payment) => void }) {
  const [p, setP] = useState<Payment>({ id: "", date: todayISO(), amount: balance, method: "Check", reference: "", note: "" });
  const [err, setErr] = useState("");
  // reset amount to the current balance every time the dialog opens
  const [seen, setSeen] = useState(false);
  if (open && !seen) { setSeen(true); setP({ id: "", date: todayISO(), amount: Math.max(balance, 0), method: "Check", reference: "", note: "" }); }
  if (!open && seen) setSeen(false);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!(p.amount > 0)) return setErr("Enter an amount greater than zero.");
    if (p.amount > balance + 0.004) return setErr(`That's more than the ${money(balance)} balance. Reduce the amount or record an overpayment note.`);
    if (!p.date) return setErr("Payment date is required.");
    onSave({ ...p, id: uid("pay"), amount: Math.round(p.amount * 100) / 100 });
  }
  return (
    <Modal open={open} onClose={onClose} title="Record payment">
      <form onSubmit={submit} className="grid grid-cols-2 gap-4">
        <Field label="Amount"><input className="input num" type="number" step="0.01" min={0} autoFocus value={p.amount} onChange={(e) => setP({ ...p, amount: +e.target.value })} onFocus={(e) => e.target.select()} /></Field>
        <Field label="Date"><input className="input" type="date" value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} /></Field>
        <Field label="Method"><select className="input" value={p.method} onChange={(e) => setP({ ...p, method: e.target.value as Payment["method"] })}>{["Check", "Credit Card", "ACH / Wire", "Cash", "Other"].map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Reference"><input className="input" placeholder="Check # / last 4 / confirmation" value={p.reference} onChange={(e) => setP({ ...p, reference: e.target.value })} /></Field>
        <Field label="Note" className="col-span-2"><input className="input" value={p.note} onChange={(e) => setP({ ...p, note: e.target.value })} /></Field>
        {err && <p className="col-span-2 text-sm text-red-700">{err}</p>}
        <div className="col-span-2 flex justify-between items-center"><span className="text-xs text-ink-500">Balance due: {money(balance)}</span><div className="flex gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary">Save payment</button></div></div>
      </form>
    </Modal>
  );
}
