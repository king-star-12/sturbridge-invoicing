"use client";
import { X } from "lucide-react";
import { useEffect } from "react";
import type { DerivedStatus } from "@/lib/calc";

export function StatusBadge({ status }: { status: DerivedStatus }) {
  const map: Record<DerivedStatus, string> = {
    draft: "bg-ink-100 text-ink-700",
    sent: "bg-blue-50 text-blue-700",
    partial: "bg-amber-50 text-amber-700",
    paid: "bg-teal-50 text-teal-800",
    overdue: "bg-red-50 text-red-700",
    void: "bg-ink-100 text-ink-500 line-through",
  };
  const label: Record<DerivedStatus, string> = { draft: "Draft", sent: "Sent", partial: "Partially paid", paid: "Paid", overdue: "Overdue", void: "Void" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${map[status]}`}>{label[status]}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">{title}</h1>
        {subtitle && <div className="text-sm text-ink-500 mt-0.5">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 no-print" onMouseDown={onClose}>
      <div className={`card w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[92vh] overflow-auto rounded-b-none sm:rounded-lg`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100 sticky top-0 bg-white">
          <h2 className="font-semibold text-ink-900">{title}</h2>
          <button className="btn-ghost px-1.5 py-1" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint, className = "" }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="text-xs text-ink-500 mt-1">{hint}</p>}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="card p-10 text-center">
      <div className="font-medium text-ink-900">{title}</div>
      {body && <p className="text-sm text-ink-500 mt-1">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, tone = "default", sub }: { label: string; value: string; tone?: "default" | "good" | "warn" | "bad"; sub?: string }) {
  const color = { default: "text-ink-900", good: "text-teal-800", warn: "text-amber-700", bad: "text-red-700" }[tone];
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
      <div className={`text-2xl font-semibold mt-1 num ${color}`}>{value}</div>
      {sub && <div className="text-xs text-ink-500 mt-1">{sub}</div>}
    </div>
  );
}

/** Confirm dialog replacement for window.confirm, keeps styling consistent. */
export function Confirm({ open, onClose, onConfirm, title, body, confirmLabel = "Confirm", danger }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: string; confirmLabel?: string; danger?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-ink-700">{body}</p>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className={danger ? "btn-danger" : "btn-primary"} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
