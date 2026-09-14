"use client";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Printer, X } from "lucide-react";
import { useStore } from "@/lib/store";
import InvoiceDocument from "@/components/InvoiceDocument";
import FitDoc from "@/components/FitDoc";

function Print() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const store = useStore();
  const inv = store.ready ? store.getInvoice(id) : undefined;
  const [tplId, setTplId] = useState<string>("");
  const [stub, setStub] = useState<boolean | undefined>(undefined);
  useEffect(() => { if (inv) { document.title = `${inv.number} — ${inv.billTo.company}`; setTplId(params.get("template") ?? inv.templateId ?? store.settings.defaultTemplateId); } }, [inv, params, store.settings.defaultTemplateId]);
  if (!store.ready) return null;
  if (!inv) return <div className="p-10 text-center text-ink-500">Document not found.</div>;
  const tpl = store.settings.templates.find((t) => t.id === tplId) ?? store.settings.templates[0];
  return (
    <div className="doc-wrap min-h-screen bg-ink-100 py-6">
      <div className="no-print mx-auto mb-4 flex flex-wrap items-center justify-between gap-3" style={{ width: "8.5in", maxWidth: "100%" }}>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <select className="input w-auto py-1.5" value={tpl.id} onChange={(e) => setTplId(e.target.value)}>{store.settings.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          {inv.kind === "invoice" && <label className="flex items-center gap-2"><input type="checkbox" checked={stub ?? tpl.showStub} onChange={(e) => setStub(e.target.checked)} /> Payment stub page</label>}
        </div>
        <div className="flex gap-2"><button className="btn-secondary" onClick={() => window.close()}><X size={15} /> Close</button><button className="btn-primary" onClick={() => window.print()}><Printer size={15} /> Print / Save as PDF</button></div>
      </div>
      <div className="mx-auto" style={{ width: "8.5in", maxWidth: "100%" }}><FitDoc><InvoiceDocument inv={inv} settings={store.settings} template={tpl} showStub={stub} /></FitDoc></div>
    </div>
  );
}
export default function PrintPage() { return <Suspense><Print /></Suspense>; }
