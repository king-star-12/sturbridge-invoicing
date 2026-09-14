"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useStore } from "@/lib/store";
import InvoiceForm, { blankDraft } from "@/components/InvoiceForm";
import { PageHeader } from "@/components/ui";

function NewDoc() {
  const store = useStore();
  const params = useSearchParams();
  if (!store.ready) return null;
  const kind = params.get("kind") === "estimate" ? "estimate" : "invoice";
  const draft = blankDraft(store.settings, kind);
  const cid = params.get("customer");
  const c = cid ? store.getCustomer(cid) : undefined;
  if (c) { draft.customerId = c.id; draft.taxExempt = c.taxExempt; draft.billTo = { company: c.company, contactName: c.contactName, email: c.email, address1: c.address1, address2: c.address2, city: c.city, state: c.state, zip: c.zip, country: c.country }; }
  const n = store.peekNumber(kind);
  return (<><PageHeader title={kind === "estimate" ? "New estimate" : "New invoice"} subtitle={`Will be numbered ${n} when saved`} /><InvoiceForm key={kind} initial={draft} number={n} /></>);
}
export default function Page() { return <Suspense><NewDoc /></Suspense>; }
