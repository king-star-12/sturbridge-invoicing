"use client";
import { X } from "lucide-react";
import { useEffect } from "react";
import type { DerivedStatus } from "@/lib/calc";

export function StatusBadge({ status }: { status: DerivedStatus }) {
  const map: Record<DerivedStatus, [string, string]> = {
    draft: ["bg-ink-100 text-ink-700", "Draft"], sent: ["bg-blue-50 text-blue-700", "Sent"], partial: ["bg-amber-50 text-amber-700", "Partially paid"],
    paid: ["bg-teal-50 text-teal-800", "Paid"], overdue: ["bg-red-50 text-red-700", "Overdue"], void: ["bg-ink-100 text-ink-500 line-through", "Void"],
    accepted: ["bg-teal-50 text-teal-800", "Accepted"], declined: ["bg-red-50 text-red-700", "Declined"], converted: ["bg-ink-100 text-ink-700", "Converted"], expired: ["bg-amber-50 text-amber-700", "Expired"],
  };
  const [cls, label] = map[status];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${cls}`}>{label}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div><h1 className="text-2xl font-semibold text-ink-900">{title}</h1>{subtitle && <div className="text-sm text-ink-500 mt-0.5">{subtitle}</div>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => { if (!open) return; const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 no-print" onMouseDown={onClose}>
      <div className={`card w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[92vh] overflow-auto rounded-b-none sm:rounded-lg`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100 sticky top-0 bg-white z-10"><h2 className="font-semibold text-ink-900">{title}</h2><button className="btn-ghost px-1.5 py-1" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint, className = "" }: { label: string; children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (<div className={className}><label className="label">{label}</label>{children}{hint && <p className="text-xs text-ink-500 mt-1">{hint}</p>}</div>);
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (<div className="card p-10 text-center"><div className="font-medium text-ink-900">{title}</div>{body && <p className="text-sm text-ink-500 mt-1">{body}</p>}{action && <div className="mt-4">{action}</div>}</div>);
}

export function Stat({ label, value, tone = "default", sub }: { label: string; value: string; tone?: "default" | "good" | "warn" | "bad"; sub?: string }) {
  const color = { default: "text-ink-900", good: "text-teal-800", warn: "text-amber-700", bad: "text-red-700" }[tone];
  return (<div className="card p-4"><div className="text-xs uppercase tracking-wide text-ink-500">{label}</div><div className={`text-2xl font-semibold mt-1 num ${color}`}>{value}</div>{sub && <div className="text-xs text-ink-500 mt-1">{sub}</div>}</div>);
}

export function Confirm({ open, onClose, onConfirm, title, body, confirmLabel = "Confirm", danger }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: string; confirmLabel?: string; danger?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-ink-700">{body}</p>
      <div className="flex justify-end gap-2 mt-5"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className={danger ? "btn-danger" : "btn-primary"} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button></div>
    </Modal>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <span role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-teal-700" : "bg-ink-300"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-[18px]" : "left-0.5"}`} /></span>
      <span>{label}</span>
    </label>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: string }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-ink-100 mb-5 -mx-1 overflow-x-auto">
      {tabs.map((t) => <button key={t.key} onClick={() => onChange(t.key)} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${value === t.key ? "border-teal-700 text-teal-800" : "border-transparent text-ink-500 hover:text-ink-900"}`}>{t.label}</button>)}
    </div>
  );
}

/** Small pill list editor: comma-free tag input for lists of strings. */
export function ListEditor({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5 items-center rounded-md border border-ink-300 bg-white p-1.5">
      {value.map((v, i) => <span key={i} className="inline-flex items-center gap-1 rounded bg-ink-100 px-2 py-0.5 text-xs">{v}<button type="button" className="text-ink-500 hover:text-red-700" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove ${v}`}>×</button></span>)}
      <input className="flex-1 min-w-[120px] text-sm px-1 py-0.5 outline-none" placeholder={placeholder ?? "Type and press Enter"} onKeyDown={(e) => { const el = e.currentTarget; if (e.key === "Enter" && el.value.trim()) { e.preventDefault(); onChange([...value, el.value.trim()]); el.value = ""; } }} />
    </div>
  );
}
