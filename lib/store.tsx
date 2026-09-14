"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogItem, Customer, Database, DocKind, Invoice, Settings } from "./types";
import { buildSeedDatabase } from "./seed";
import { migrate } from "./migrate";
import { takeNumber } from "./calc";
import { configureFormat } from "./format";
import { uid } from "./id";

/**
 * Storage layer. Persists to localStorage so the prototype runs with zero
 * infrastructure. Every mutation goes through `commit`; swapping in Postgres
 * later means replacing `load`/`persist` (and adding API routes) only.
 */
const KEY = "shh-invoicing-v2";
const LEGACY_KEY = "shh-invoicing-v1";

function load(): Database {
  if (typeof window === "undefined") return buildSeedDatabase();
  try {
    const raw = window.localStorage.getItem(KEY) ?? window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return buildSeedDatabase();
    return migrate(JSON.parse(raw)) ?? buildSeedDatabase();
  } catch { return buildSeedDatabase(); }
}
function persist(db: Database) { try { window.localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* quota / private mode */ } }

export type Role = "admin" | "staff";
const readRole = (): Role => (typeof document !== "undefined" && /(?:^|; )shh_role=staff/.test(document.cookie) ? "staff" : "admin");

type Store = {
  db: Database; ready: boolean; role: Role;
  settings: Settings; invoices: Invoice[]; customers: Customer[]; catalog: CatalogItem[];
  getInvoice: (id: string) => Invoice | undefined;
  getCustomer: (id: string) => Customer | undefined;
  peekNumber: (kind: DocKind) => string;
  createInvoice: (draft: Omit<Invoice, "id" | "number" | "createdAt" | "updatedAt">) => Invoice;
  updateInvoice: (id: string, patch: Partial<Invoice> | ((inv: Invoice) => Invoice), activity?: string) => void;
  deleteInvoice: (id: string) => void;
  duplicateInvoice: (id: string, kind?: DocKind) => Invoice | undefined;
  convertEstimate: (id: string) => Invoice | undefined;
  upsertCustomer: (c: Partial<Customer> & { company: string }) => Customer;
  deleteCustomer: (id: string) => void;
  importCustomers: (rows: Partial<Customer>[]) => number;
  upsertCatalogItem: (c: Partial<CatalogItem> & { name: string }) => CatalogItem;
  deleteCatalogItem: (id: string) => void;
  importCatalog: (rows: Partial<CatalogItem>[]) => number;
  updateSettings: (patch: Partial<Settings> | ((s: Settings) => Settings)) => void;
  exportJSON: () => string;
  importJSON: (json: string) => { ok: true } | { ok: false; error: string };
  resetToDemo: () => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Database>(() => buildSeedDatabase());
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<Role>("admin");
  const dbRef = useRef(db); dbRef.current = db;

  useEffect(() => {
    const d = load(); setDb(d); setRole(readRole()); setReady(true);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setDb(load()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => { configureFormat(db.settings.locale.currency, db.settings.locale.locale, db.settings.locale.dateFormat); }, [db.settings.locale]);

  const commit = useCallback((fn: (d: Database) => Database) => { setDb((prev) => { const next = fn(prev); dbRef.current = next; persist(next); return next; }); }, []);

  const store = useMemo<Store>(() => {
    const now = () => new Date().toISOString();
    const act = (event: string, detail?: string) => ({ at: now(), event, detail });
    const issue = (draft: Omit<Invoice, "id" | "number" | "createdAt" | "updatedAt">, extra: Partial<Invoice> = {}): Invoice => {
      const d = dbRef.current;
      const kind = draft.kind ?? "invoice";
      const [number, nextRule] = takeNumber(d.settings.numbering[kind]);
      const inv: Invoice = { ...draft, ...extra, id: uid("inv"), number, createdAt: now(), updatedAt: now(), activity: [...(draft.activity ?? []), act("Created")] };
      commit((cur) => ({ ...cur, invoices: [inv, ...cur.invoices], settings: { ...cur.settings, numbering: { ...cur.settings.numbering, [kind]: nextRule } } }));
      return inv;
    };
    return {
      db, ready, role,
      settings: db.settings, invoices: db.invoices, customers: db.customers, catalog: db.catalog,
      getInvoice: (id) => db.invoices.find((i) => i.id === id),
      getCustomer: (id) => db.customers.find((c) => c.id === id),
      peekNumber: (kind) => takeNumber(db.settings.numbering[kind])[0],
      createInvoice: (draft) => issue(draft),
      updateInvoice: (id, patch, activity) => commit((cur) => ({
        ...cur,
        invoices: cur.invoices.map((i) => {
          if (i.id !== id) return i;
          const next = typeof patch === "function" ? patch(i) : { ...i, ...patch };
          return { ...next, updatedAt: now(), activity: activity ? [...(next.activity ?? []), act(activity)] : next.activity };
        }),
      })),
      deleteInvoice: (id) => commit((cur) => ({ ...cur, invoices: cur.invoices.filter((i) => i.id !== id) })),
      duplicateInvoice: (id, kind) => {
        const src = dbRef.current.invoices.find((i) => i.id === id); if (!src) return undefined;
        const { id: _i, number: _n, createdAt: _c, updatedAt: _u, ...rest } = src;
        return issue({ ...rest, kind: kind ?? src.kind, status: "draft", payments: [], sentAt: undefined, convertedFromId: undefined, convertedToId: undefined, activity: [act(`Duplicated from ${src.number}`)], items: src.items.map((li) => ({ ...li, id: uid("li") })) });
      },
      convertEstimate: (id) => {
        const src = dbRef.current.invoices.find((i) => i.id === id); if (!src || src.kind !== "estimate") return undefined;
        const { id: _i, number: _n, createdAt: _c, updatedAt: _u, ...rest } = src;
        const inv = issue({ ...rest, kind: "invoice", status: "draft", payments: [], sentAt: undefined, convertedFromId: src.id, convertedToId: undefined, activity: [act(`Converted from estimate ${src.number}`)], items: src.items.map((li) => ({ ...li, id: uid("li") })) });
        commit((cur) => ({ ...cur, invoices: cur.invoices.map((i) => i.id === src.id ? { ...i, status: "converted", convertedToId: inv.id, updatedAt: now(), activity: [...i.activity, act(`Converted to ${inv.number}`)] } : i) }));
        return inv;
      },
      upsertCustomer: (c) => {
        const existing = c.id ? dbRef.current.customers.find((x) => x.id === c.id) : undefined;
        const cust: Customer = { id: existing?.id ?? uid("cus"), contactName: "", email: "", phone: "", address1: "", address2: "", city: "", state: "", zip: "", country: "USA", notes: "", taxExempt: false, taxExemptId: "", tags: [], createdAt: existing?.createdAt ?? now(), ...existing, ...c } as Customer;
        commit((cur) => ({ ...cur, customers: existing ? cur.customers.map((x) => x.id === cust.id ? cust : x) : [cust, ...cur.customers] }));
        return cust;
      },
      deleteCustomer: (id) => commit((cur) => ({ ...cur, customers: cur.customers.filter((c) => c.id !== id) })),
      importCustomers: (rows) => {
        const valid = rows.filter((r) => r.company?.trim());
        commit((cur) => ({ ...cur, customers: [...valid.map((r) => ({ id: uid("cus"), contactName: "", email: "", phone: "", address1: "", address2: "", city: "", state: "", zip: "", country: "USA", notes: "", taxExempt: false, taxExemptId: "", tags: [], createdAt: now(), ...r, company: r.company!.trim() } as Customer)), ...cur.customers] }));
        return valid.length;
      },
      upsertCatalogItem: (c) => {
        const existing = c.id ? dbRef.current.catalog.find((x) => x.id === c.id) : undefined;
        const item: CatalogItem = { id: existing?.id ?? uid("cat"), description: "", category: "Other", rate: 0, unit: "each", taxClassId: dbRef.current.settings.tax.defaultClassId, active: true, ...existing, ...c } as CatalogItem;
        commit((cur) => ({ ...cur, catalog: existing ? cur.catalog.map((x) => x.id === item.id ? item : x) : [...cur.catalog, item] }));
        return item;
      },
      deleteCatalogItem: (id) => commit((cur) => ({ ...cur, catalog: cur.catalog.filter((c) => c.id !== id) })),
      importCatalog: (rows) => {
        const valid = rows.filter((r) => r.name?.trim());
        commit((cur) => ({ ...cur, catalog: [...cur.catalog, ...valid.map((r) => ({ id: uid("cat"), description: "", category: "Other", unit: "each", taxClassId: cur.settings.tax.defaultClassId, active: true, ...r, name: r.name!.trim(), rate: Number(r.rate) || 0 } as CatalogItem))] }));
        return valid.length;
      },
      updateSettings: (patch) => commit((cur) => ({ ...cur, settings: typeof patch === "function" ? patch(cur.settings) : { ...cur.settings, ...patch } })),
      exportJSON: () => JSON.stringify(dbRef.current, null, 2),
      importJSON: (json) => {
        try {
          const parsed = migrate(JSON.parse(json));
          if (!parsed) return { ok: false, error: "That file is not a Sturbridge Invoicing backup." };
          commit(() => parsed);
          return { ok: true };
        } catch (e) { return { ok: false, error: (e as Error).message }; }
      },
      resetToDemo: () => commit(() => buildSeedDatabase()),
    };
  }, [db, ready, role, commit]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside <StoreProvider>");
  return s;
}
