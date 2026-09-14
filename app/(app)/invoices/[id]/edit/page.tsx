"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store";
import InvoiceForm from "@/components/InvoiceForm";
import { Empty, PageHeader } from "@/components/ui";

export default function EditDoc() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  if (!store.ready) return null;
  const inv = store.getInvoice(id);
  if (!inv) return <Empty title="Document not found" action={<Link href="/invoices" className="btn-secondary">Back to invoices</Link>} />;
  if (inv.status === "void" || inv.status === "converted") return <Empty title={`${inv.number} is ${inv.status}`} body="It can't be edited. Duplicate it to start a new one." action={<Link href={`/invoices/${inv.id}`} className="btn-secondary">Back</Link>} />;
  const { id: _i, number, createdAt: _c, updatedAt: _u, ...draft } = inv;
  return (<><PageHeader title={`Edit ${number}`} subtitle={inv.payments.length > 0 ? "This invoice has payments recorded — totals will be re-checked against them." : undefined} /><InvoiceForm key={inv.id} initial={draft} invoiceId={inv.id} number={number} /></>);
}
