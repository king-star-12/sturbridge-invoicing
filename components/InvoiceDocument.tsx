/* eslint-disable @next/next/no-img-element */
import type { Invoice, Settings, DocumentTemplate } from "@/lib/types";
import { computeTotals, lineGross, lineNet, rulesForLine } from "@/lib/engine";
import { resolveSchedule } from "@/lib/calc";
import { eventDateRange, fmtDate, money, num2 } from "@/lib/format";

/**
 * The printable document. Three layouts share one data pipeline:
 *  classic  — mirrors the hotel's existing Zoho invoice (logo, teal header, stub page)
 *  modern   — bolder header band, line tax codes, terms + signature
 *  compact  — one page, grouped taxes, no stub
 */
export default function InvoiceDocument({ inv, settings, template, showStub }: { inv: Invoice; settings: Settings; template?: DocumentTemplate; showStub?: boolean }) {
  const tpl = template ?? settings.templates.find((t) => t.id === (inv.templateId ?? settings.defaultTemplateId)) ?? settings.templates[0];
  const t = computeTotals(inv, settings.tax);
  const rows = tpl.groupCharges ? groupRows(t) : t.charges.map((c) => ({ label: chargeLabelFor(c.rule), amount: c.amount }));
  const h = settings.business;
  const b = inv.billTo;
  const accent = tpl.accentColor;
  const isEstimate = inv.kind === "estimate";
  const title = isEstimate ? tpl.titleEstimate : tpl.titleInvoice;
  const stub = (showStub ?? tpl.showStub) && !isEstimate;
  const isPaid = t.balance <= 0.004 && t.total > 0 && !isEstimate;
  const stamp = inv.status === "void" ? "VOID" : isPaid ? "PAID" : inv.status === "accepted" ? "ACCEPTED" : null;
  const logo = h.logoDataUrl || "/logo.png";
  const cf = settings.customFields.filter((f) => f.showOnDocument && f.kinds.includes(inv.kind) && inv.custom?.[f.id]);
  const schedule = tpl.showSchedule && inv.schedule.length ? resolveSchedule(inv.schedule, t.total, t.paid) : [];
  const classCode = (id: string) => settings.tax.classes.find((c) => c.id === id)?.name ?? "";
  const ruleCodes = (li: Invoice["items"][number]) => rulesForLine(li, settings.tax.rules.filter((r) => r.active)).map((r) => r.printLabel.split(" ").map((w) => w[0]).join("").toUpperCase()).join(" ");
  const compact = tpl.layout === "compact";
  const fs = compact ? "9.5pt" : "10.5pt";

  const meta: [string, string][] = [
    [isEstimate ? "Estimate Date" : "Invoice Date", fmtDate(inv.invoiceDate)],
    ...(isEstimate ? [["Valid Until", fmtDate(inv.dueDate)] as [string, string]] : [["Terms", inv.terms] as [string, string], ["Due Date", fmtDate(inv.dueDate)] as [string, string]]),
    ...(settings.builtInFields.salesPerson && inv.salesPerson ? [["Sales person", inv.salesPerson] as [string, string]] : []),
    ...(settings.builtInFields.eventNumber && inv.eventNumber ? [["Event Number", inv.eventNumber] as [string, string]] : []),
    ...(settings.builtInFields.eventName && inv.eventName ? [["Event", inv.eventName] as [string, string]] : []),
    ...(settings.builtInFields.eventDates && inv.eventStart ? [["Event Date(s)", eventDateRange(inv.eventStart, inv.eventEnd)] as [string, string]] : []),
    ...(settings.builtInFields.poNumber && inv.poNumber ? [["P.O. Number", inv.poNumber] as [string, string]] : []),
    ...cf.map((f) => [f.label, f.type === "date" ? fmtDate(inv.custom[f.id]) : inv.custom[f.id]] as [string, string]),
  ];

  return (
    <div className={`doc relative shadow-card ${tpl.paper === "a4" ? "doc-a4" : ""}`} style={{ fontSize: fs, padding: compact ? "0.45in 0.55in" : undefined }}>
      {stamp && <div className="absolute right-[0.65in] top-[2.2in] rotate-[-12deg] rounded border-4 px-6 py-1 text-3xl font-bold tracking-widest opacity-30" style={{ color: stamp === "VOID" ? "#b91c1c" : accent, borderColor: stamp === "VOID" ? "#b91c1c" : accent }}>{stamp}</div>}

      {/* header */}
      {tpl.layout === "modern" ? (
        <div className="-mx-[0.65in] -mt-[0.6in] px-[0.65in] pt-[0.5in] pb-5 mb-6 text-white" style={{ background: accent }}>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              {tpl.showLogo && <img src={logo} alt="" style={{ width: 72, height: 70, background: "#fff", borderRadius: 8, padding: 4 }} />}
              <div><div className="font-semibold text-[13pt]">{h.name}</div><div className="opacity-90 text-[9.5pt]">{h.address1}{h.address2 ? `, ${h.address2}` : ""} · {h.city}, {h.state} {h.zip} · {h.phone}</div></div>
            </div>
            <div className="text-right"><div className="font-light" style={{ fontSize: "28pt", lineHeight: 1 }}>{title}</div><div className="font-semibold mt-1"># {inv.number}</div></div>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-start">
          <div>
            {tpl.showLogo && <img src={logo} alt="" style={{ width: compact ? 80 : 128, height: compact ? 78 : 125 }} />}
            <div className="mt-3 font-semibold text-[12pt]">{h.name}</div>
            <div>{h.address1}</div>{h.address2 && <div>{h.address2}</div>}
            <div>{h.city} {h.state} {h.zip}</div><div>{h.country}</div><div>{h.phone}</div><div>{h.website}</div>
            {h.taxId && <div className="text-ink-700">Tax ID {h.taxId}</div>}
          </div>
          <div className="text-right">
            <div className="font-light" style={{ color: accent, fontSize: "30pt", lineHeight: 1.1 }}>{title}</div>
            <div className="font-semibold text-[11pt] mt-1"># {inv.number}</div>
            <div className="mt-6 font-semibold text-[9.5pt]">{isEstimate ? "Estimated Total" : "Balance Due"}</div>
            <div className="font-semibold text-[15pt] num">{money(isEstimate ? t.total : t.balance)}</div>
          </div>
        </div>
      )}

      {/* bill to + meta */}
      <div className="flex justify-between items-end mt-8 gap-8">
        <div className="min-w-0">
          <div className="mb-1">{isEstimate ? "Prepared For" : "Bill To"}</div>
          <div className="font-semibold">{b.company}</div>
          {b.contactName && <div>{b.contactName}</div>}
          {b.address1 && <div>{b.address1}</div>}{b.address2 && <div>{b.address2}</div>}
          <div>{[b.city, [b.zip, b.state].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</div>
          {b.country && <div>{b.country}</div>}
          {inv.taxExempt && <div className="text-ink-700 text-[9pt] mt-1">Tax exempt</div>}
        </div>
        <table style={{ minWidth: "3.4in" }}><tbody>{meta.map(([k, v]) => <tr key={k}><td className="text-right pr-4 py-1 whitespace-nowrap">{k} :</td><td className="text-right py-1 whitespace-nowrap">{v}</td></tr>)}</tbody></table>
      </div>

      {/* items */}
      <table className="w-full mt-6" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: accent, color: "#fff" }}>
            <th className="text-left font-normal py-2 pl-3 pr-2 w-[0.4in]">#</th>
            <th className="text-left font-normal py-2 px-2">Item & Description</th>
            <th className="text-right font-normal py-2 px-2 w-[0.8in]">Qty</th>
            {tpl.showUnitColumn && <th className="text-left font-normal py-2 px-2 w-[0.9in]">Unit</th>}
            <th className="text-right font-normal py-2 px-2 w-[1in]">Rate</th>
            {tpl.showLineTaxCodes && <th className="text-left font-normal py-2 px-2 w-[0.9in]">Tax</th>}
            <th className="text-right font-normal py-2 pl-2 pr-3 w-[1.1in]">Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((li, i) => (
            <tr key={li.id} style={{ borderBottom: "1px solid #c9ccd1" }}>
              <td className="py-2.5 pl-3 pr-2 align-top">{i + 1}</td>
              <td className="py-2.5 px-2 align-top"><div>{li.name}</div>{li.description && <div className="text-[9pt] text-ink-700">{li.description}</div>}{li.discount && li.discount.value > 0 && <div className="text-[9pt] text-ink-700">Less discount {li.discount.type === "percent" ? `${li.discount.value}%` : money(li.discount.value)}</div>}</td>
              <td className="py-2.5 px-2 text-right align-top num">{num2(li.qty)}</td>
              {tpl.showUnitColumn && <td className="py-2.5 px-2 align-top text-ink-700">{li.unit ?? ""}</td>}
              <td className="py-2.5 px-2 text-right align-top num">{num2(li.rate)}</td>
              {tpl.showLineTaxCodes && <td className="py-2.5 px-2 align-top text-[8.5pt] text-ink-700" title={classCode(li.taxClassId)}>{ruleCodes(li) || "—"}</td>}
              <td className="py-2.5 pl-2 pr-3 text-right align-top num">{num2(li.discount && li.discount.value > 0 ? lineNet(li) : lineGross(li))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* totals */}
      <div className="flex justify-end mt-3">
        <table style={{ minWidth: "3.6in" }}><tbody>
          <Tot k="Sub Total" v={num2(t.subtotal - t.lineDiscounts)} />
          {t.invoiceDiscount > 0 && <Tot k={`Discount${inv.discount.label ? ` (${inv.discount.label})` : ""}`} v={`-${num2(t.invoiceDiscount)}`} />}
          {rows.map((r) => <Tot key={r.label} k={r.label} v={num2(r.amount)} />)}
          <Tot k="Total" v={money(t.total)} bold />
          {!isEstimate && t.paid > 0 && <Tot k="Payments Received" v={`(-) ${num2(t.paid)}`} />}
          {!isEstimate && <tr style={{ background: `${accent}1f` }}><td className="py-2.5 pl-4 pr-3 text-right font-semibold">Balance Due</td><td className="py-2.5 pr-3 text-right font-semibold num" style={{ minWidth: "1.2in" }}>{money(t.balance)}</td></tr>}
        </tbody></table>
      </div>

      {schedule.length > 0 && (
        <div className="mt-6">
          <div className="text-[11pt] mb-1">Payment Schedule</div>
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <tbody>{schedule.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid #eef0f2" }}>
                <td className="py-1 pr-3">{s.label}</td><td className="py-1 pr-3 text-ink-700 whitespace-nowrap">due {fmtDate(s.dueDate)}</td>
                <td className="py-1 text-right num whitespace-nowrap">{money(s.amount)}</td><td className="py-1 pl-3 text-right text-[9pt] w-[1in]">{s.settled ? "Received" : s.paid > 0 ? `${money(s.paid)} received` : ""}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}

      {(inv.notes || (tpl.showPaymentInstructions && settings.paymentInstructions) || tpl.termsText) && (
        <div className="mt-8 text-[9.5pt]">
          {inv.notes && (<><div className="text-[11pt] mb-1">Notes</div><div className="whitespace-pre-wrap">{inv.notes}</div></>)}
          {tpl.showPaymentInstructions && settings.paymentInstructions && !isEstimate && (<><div className="text-[11pt] mt-4 mb-1">Payment</div><div className="whitespace-pre-wrap text-ink-700">{settings.paymentInstructions}</div></>)}
          {tpl.termsText && (<><div className="text-[11pt] mt-4 mb-1">Terms & Conditions</div><div className="whitespace-pre-wrap text-ink-700">{tpl.termsText}</div></>)}
        </div>
      )}
      {tpl.signatureLine && (
        <div className="mt-10 flex gap-12 text-[9.5pt]">
          <div className="flex-1"><div className="border-b border-ink-700 h-8" /><div className="mt-1 text-ink-700">{isEstimate ? "Accepted by (client signature)" : "Client signature"}</div></div>
          <div className="w-[1.6in]"><div className="border-b border-ink-700 h-8" /><div className="mt-1 text-ink-700">Date</div></div>
        </div>
      )}
      {tpl.footerText && <div className="mt-8 pt-3 border-t border-ink-100 text-center text-[8.5pt] text-ink-500 whitespace-pre-wrap">{tpl.footerText}</div>}

      {stub && (
        <div className="page-break pt-4">
          <div className="flex justify-between gap-8">
            <div className="w-[3.5in]">
              <div>From</div><div className="font-semibold">{b.company}</div>
              <div className="border-b border-dotted border-ink-700 pb-0.5">{b.contactName || " "}</div>
              <table className="mt-8"><tbody>
                <tr><td className="pr-6 py-0.5">#</td><td className="pr-3">:</td><td>{inv.number}</td></tr>
                <tr><td className="pr-6 py-0.5">Invoice Date</td><td className="pr-3">:</td><td>{fmtDate(inv.invoiceDate)}</td></tr>
                <tr><td className="pr-6 py-0.5">Balance Due</td><td className="pr-3">:</td><td className="num">{money(t.balance)}</td></tr>
              </tbody></table>
              <div className="mt-3 flex border border-ink-300" style={{ width: "2.8in" }}><div className="bg-ink-100 px-3 py-2 text-center font-semibold text-[9.5pt] leading-tight">Amount<br />Enclosed</div><div className="flex-1" /></div>
            </div>
            <div className="w-[3.4in]">
              <div className="text-[20pt] font-light mb-12">Payment Stub</div>
              <div className="font-semibold uppercase">{h.name}</div><div className="uppercase">{h.address1}</div><div className="uppercase">{h.city} {h.state} {h.zip}</div><div className="uppercase">{h.country}</div><div>{h.phone}</div><div className="uppercase">{h.website}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function chargeLabelFor(rule: Settings["tax"]["rules"][number]) { return rule.calc.type === "percent" ? `${rule.printLabel} (${+(rule.calc.rate * 100).toFixed(3)}%)` : rule.printLabel; }
function groupRows(t: ReturnType<typeof computeTotals>) {
  const sep = t.charges.filter((c) => c.rule.showOnDocument === "separate").map((c) => ({ label: chargeLabelFor(c.rule), amount: c.amount }));
  const grp = t.charges.filter((c) => c.rule.showOnDocument === "grouped");
  return grp.length ? [...sep, { label: "Taxes & fees", amount: Math.round(grp.reduce((a, c) => a + c.amount, 0) * 100) / 100 }] : sep;
}
function Tot({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (<tr><td className={`py-1.5 pl-4 pr-3 text-right ${bold ? "font-semibold" : ""}`} style={{ maxWidth: "2.6in" }}>{k}</td><td className={`py-1.5 pr-3 text-right num ${bold ? "font-semibold" : ""}`} style={{ minWidth: "1.2in" }}>{v}</td></tr>);
}
