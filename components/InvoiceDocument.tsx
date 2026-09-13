/* eslint-disable @next/next/no-img-element */
import type { Invoice, Settings } from "@/lib/types";
import { computeTotals, lineAmount } from "@/lib/calc";
import { eventDateRange, fmtDate, money, num2 } from "@/lib/format";

/**
 * The printable invoice. Mirrors the layout of the hotel's existing invoices
 * (logo, teal "Invoice" header, Bill To / meta block, teal item table, totals,
 * notes, and a detachable Payment Stub page).
 */
export default function InvoiceDocument({ inv, settings, showStub = true }: { inv: Invoice; settings: Settings; showStub?: boolean }) {
  const t = computeTotals(inv, settings.taxes);
  const h = settings.hotel;
  const b = inv.billTo;
  const teal = "#1a7a6b";
  const isPaid = t.balance <= 0.004 && t.total > 0;
  const status = inv.status === "void" ? "VOID" : isPaid ? "PAID" : null;

  return (
    <div className="doc relative shadow-card">
      {status && (
        <div className="absolute right-[0.65in] top-[2.2in] rotate-[-12deg] rounded border-4 px-6 py-1 text-3xl font-bold tracking-widest opacity-30" style={{ color: status === "VOID" ? "#b91c1c" : teal, borderColor: status === "VOID" ? "#b91c1c" : teal }}>{status}</div>
      )}
      {/* header */}
      <div className="flex justify-between items-start">
        <div>
          <img src="/logo.png" alt="" style={{ width: 128, height: 125 }} />
          <div className="mt-3 font-semibold text-[12pt]">{h.name}</div>
          <div>{h.address1}</div>
          <div>{h.city} {h.state} {h.zip}</div>
          <div>{h.country}</div>
          <div>{h.phone}</div>
          <div>{h.website}</div>
        </div>
        <div className="text-right">
          <div className="font-light" style={{ color: teal, fontSize: "30pt", lineHeight: 1.1 }}>Invoice</div>
          <div className="font-semibold text-[11pt] mt-1"># {inv.number}</div>
          <div className="mt-6 font-semibold text-[9.5pt]">Balance Due</div>
          <div className="font-semibold text-[15pt] num">{money(t.balance)}</div>
        </div>
      </div>

      {/* bill to + meta */}
      <div className="flex justify-between items-end mt-8 gap-8">
        <div className="min-w-0">
          <div className="mb-1">Bill To</div>
          <div className="font-semibold">{b.company}</div>
          {b.contactName && <div>{b.contactName}</div>}
          {b.address1 && <div>{b.address1}</div>}
          {b.address2 && <div>{b.address2}</div>}
          <div>{[b.city, [b.zip, b.state].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</div>
          {b.country && <div>{b.country}</div>}
        </div>
        <table className="text-[10.5pt]" style={{ minWidth: "3.4in" }}>
          <tbody>
            <Meta k="Invoice Date" v={fmtDate(inv.invoiceDate)} />
            <Meta k="Terms" v={inv.terms} />
            <Meta k="Due Date" v={fmtDate(inv.dueDate)} />
            {inv.salesPerson && <Meta k="Sales person" v={inv.salesPerson} />}
            {inv.eventNumber && <Meta k="Event Number" v={inv.eventNumber} />}
            {inv.eventName && <Meta k="Event" v={inv.eventName} />}
            {inv.eventStart && <Meta k="Event Date(s)" v={eventDateRange(inv.eventStart, inv.eventEnd)} />}
            {inv.poNumber && <Meta k="P.O. Number" v={inv.poNumber} />}
          </tbody>
        </table>
      </div>

      {/* items */}
      <table className="w-full mt-6 text-[10.5pt]" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: teal, color: "#fff" }}>
            <th className="text-left font-normal py-2 pl-3 pr-2 w-[0.4in]">#</th>
            <th className="text-left font-normal py-2 px-2">Item & Description</th>
            <th className="text-right font-normal py-2 px-2 w-[0.9in]">Qty</th>
            <th className="text-right font-normal py-2 px-2 w-[1in]">Rate</th>
            <th className="text-right font-normal py-2 pl-2 pr-3 w-[1.1in]">Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((li, i) => (
            <tr key={li.id} style={{ borderBottom: "1px solid #c9ccd1" }}>
              <td className="py-2.5 pl-3 pr-2 align-top">{i + 1}</td>
              <td className="py-2.5 px-2 align-top">
                <div>{li.name}</div>
                {li.description && <div className="text-[9pt] text-ink-700">{li.description}</div>}
              </td>
              <td className="py-2.5 px-2 text-right align-top num">{num2(li.qty)}</td>
              <td className="py-2.5 px-2 text-right align-top num">{num2(li.rate)}</td>
              <td className="py-2.5 pl-2 pr-3 text-right align-top num">{num2(lineAmount(li))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* totals */}
      <div className="flex justify-end mt-3">
        <table className="text-[10.5pt]" style={{ minWidth: "3.6in" }}>
          <tbody>
            <Tot k="Sub Total" v={num2(t.subtotal)} />
            {t.discount > 0 && <Tot k={`Discount${inv.discount.label ? ` (${inv.discount.label})` : ""}`} v={`-${num2(t.discount)}`} />}
            {t.lines.map((l) => <Tot key={l.label} k={l.label} v={num2(l.amount)} />)}
            <Tot k="Total" v={money(t.total)} bold />
            {t.paid > 0 && <Tot k="Payments Received" v={`(-) ${num2(t.paid)}`} />}
            <tr style={{ background: "#e8f4f1" }}>
              <td className="py-2.5 pl-4 pr-3 text-right font-semibold">Balance Due</td>
              <td className="py-2.5 pr-3 text-right font-semibold num" style={{ minWidth: "1.2in" }}>{money(t.balance)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {(inv.notes || settings.paymentInstructions) && (
        <div className="mt-8 text-[9.5pt]">
          {inv.notes && (<><div className="text-[11pt] mb-1">Notes</div><div className="whitespace-pre-wrap">{inv.notes}</div></>)}
          {settings.paymentInstructions && (<><div className="text-[11pt] mt-4 mb-1">Payment</div><div className="whitespace-pre-wrap text-ink-700">{settings.paymentInstructions}</div></>)}
        </div>
      )}

      {showStub && (
        <div className="page-break pt-4">
          <div className="flex justify-between gap-8">
            <div className="w-[3.5in]">
              <div>From</div>
              <div className="font-semibold">{b.company}</div>
              <div className="border-b border-dotted border-ink-700 pb-0.5">{b.contactName || " "}</div>
              <table className="mt-8 text-[10.5pt]"><tbody>
                <tr><td className="pr-6 py-0.5">#</td><td className="pr-3">:</td><td>{inv.number}</td></tr>
                <tr><td className="pr-6 py-0.5">Invoice Date</td><td className="pr-3">:</td><td>{fmtDate(inv.invoiceDate)}</td></tr>
                <tr><td className="pr-6 py-0.5">Balance Due</td><td className="pr-3">:</td><td className="num">{money(t.balance)}</td></tr>
              </tbody></table>
              <div className="mt-3 flex border border-ink-300" style={{ width: "2.8in" }}>
                <div className="bg-ink-100 px-3 py-2 text-center font-semibold text-[9.5pt] leading-tight">Amount<br />Enclosed</div>
                <div className="flex-1" />
              </div>
            </div>
            <div className="w-[3.4in]">
              <div className="text-[20pt] font-light mb-12">Payment Stub</div>
              <div className="font-semibold uppercase">{h.name}</div>
              <div className="uppercase">{h.address1}</div>
              <div className="uppercase">{h.city} {h.state} {h.zip}</div>
              <div className="uppercase">{h.country}</div>
              <div>{h.phone}</div>
              <div className="uppercase">{h.website}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (<tr><td className="text-right pr-4 py-1 whitespace-nowrap">{k} :</td><td className="text-right py-1 whitespace-nowrap">{v}</td></tr>);
}
function Tot({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (<tr><td className={`py-1.5 pl-4 pr-3 text-right ${bold ? "font-semibold" : ""}`} style={{ maxWidth: "2.6in" }}>{k}</td><td className={`py-1.5 pr-3 text-right num ${bold ? "font-semibold" : ""}`} style={{ minWidth: "1.2in" }}>{v}</td></tr>);
}
