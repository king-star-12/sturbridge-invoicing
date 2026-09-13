"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useStore } from "@/lib/store";
import InvoiceForm, { blankDraft } from "@/components/InvoiceForm";
import { PageHeader } from "@/components/ui";

function NewInvoice() {
  const store = useStore();
  const params = useSearchParams();
  if (!store.ready) return null;
  const draft = blankDraft(store.settings);
  const cid = params.get("customer");
  const c = cid ? store.getCustomer(cid) : undefined;
  if (c) { draft.customerId = c.id; draft.billTo = { company: c.company, contactName: c.contactName, email: c.email, address1: c.address1, address2: c.address2, city: c.city, state: c.state, zip: c.zip, country: c.country }; }
  return (
    <>
      <PageHeader title="New invoice" subtitle={`Will be numbered ${store.nextInvoiceNumber()} when saved`} />
      <InvoiceForm initial={draft} number={store.nextInvoiceNumber()} />
    </>
  );
}
export default function Page() { return <Suspense><NewInvoice /></Suspense>; }
