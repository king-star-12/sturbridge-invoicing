"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Customer } from "@/lib/types";
import { Field } from "./ui";

export default function CustomerForm({ initial, onDone, onCancel }: { initial?: Customer; onDone: (c: Customer) => void; onCancel: () => void }) {
  const store = useStore();
  const [c, setC] = useState<Partial<Customer> & { company: string }>(initial ?? { company: "", contactName: "", email: "", phone: "", address1: "", address2: "", city: "", state: "", zip: "", country: "USA", notes: "" });
  const [err, setErr] = useState("");
  const f = (k: keyof Customer) => ({ value: (c[k] as string) ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setC({ ...c, [k]: e.target.value }) });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!c.company.trim()) return setErr("Company / organization name is required.");
    if (c.email && !/^\S+@\S+\.\S+$/.test(c.email)) return setErr("That email address doesn't look valid.");
    onDone(store.upsertCustomer(c));
  }
  return (
    <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
      <Field label="Company / organization" className="sm:col-span-2"><input className="input" autoFocus {...f("company")} /></Field>
      <Field label="Contact name"><input className="input" {...f("contactName")} /></Field>
      <Field label="Email"><input className="input" type="email" {...f("email")} /></Field>
      <Field label="Phone"><input className="input" {...f("phone")} /></Field>
      <Field label="Address"><input className="input" {...f("address1")} /></Field>
      <Field label="Address line 2"><input className="input" {...f("address2")} /></Field>
      <div className="grid grid-cols-[1fr_70px_90px] gap-2">
        <Field label="City"><input className="input" {...f("city")} /></Field>
        <Field label="State"><input className="input" {...f("state")} /></Field>
        <Field label="ZIP"><input className="input" {...f("zip")} /></Field>
      </div>
      <Field label="Country"><input className="input" {...f("country")} /></Field>
      <Field label="Notes" className="sm:col-span-2"><textarea className="input" {...f("notes")} /></Field>
      {err && <p className="text-sm text-red-700 sm:col-span-2">{err}</p>}
      <div className="sm:col-span-2 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary">{initial ? "Save customer" : "Add customer"}</button>
      </div>
    </form>
  );
}
