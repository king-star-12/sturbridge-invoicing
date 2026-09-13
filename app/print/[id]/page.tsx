"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Printer, X } from "lucide-react";
import { useStore } from "@/lib/store";
import InvoiceDocument from "@/components/InvoiceDocument";
import FitDoc from "@/components/FitDoc";

/** Clean, shell-free page used for printing and "Save as PDF". */
export default function PrintPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const [stub, setStub] = useState(true);
  const inv = store.ready ? store.getInvoice(id) : undefined;
  useEffect(() => { if (inv) document.title = `${inv.number} — ${inv.billTo.company}`; }, [inv]);
  if (!store.ready) return null;
  if (!inv) return <div className="p-10 text-center text-ink-500">Invoice not found.</div>;
  return (
    <div className="doc-wrap min-h-screen bg-ink-100 py-6">
      <div className="no-print mx-auto mb-4 flex items-center justify-between gap-3" style={{ width: "8.5in", maxWidth: "100%" }}>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={stub} onChange={(e) => setStub(e.target.checked)} /> Include payment stub page</label>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => window.close()}><X size={15} /> Close</button>
          <button className="btn-primary" onClick={() => window.print()}><Printer size={15} /> Print / Save as PDF</button>
        </div>
      </div>
      <div className="mx-auto" style={{ width: "8.5in", maxWidth: "100%" }}><FitDoc><InvoiceDocument inv={inv} settings={store.settings} showStub={stub} /></FitDoc></div>
    </div>
  );
}
