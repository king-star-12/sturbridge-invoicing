"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogItem, Customer, Database, Invoice, Settings } from "./types";
import { buildSeedDatabase, defaultSettings } from "./seed";
import { formatInvoiceNumber } from "./calc";
import { uid } from "./id";

/**
 * Storage layer. The prototype persists to localStorage so it runs with zero
 * infrastructure on Vercel. Every mutation goes through `commit`, so swapping in
 * Postgres/Prisma later means replacing `load`/`persist` only.
 */
const KEY = "shh-invoicing-v1";

function load(): Database {
  if (typeof window === "undefined") return buildSeedDatabase();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return buildSeedDatabase();
    const db = JSON.parse(raw) as Database;
    if (!db || db.version !== 1) return buildSeedDatabase();
    // forward-compat: fill any settings keys added after the user first saved
    db.settings = { ...defaultSettings, ...db.settings, hotel: { ...defaultSettings.hotel, ...db.settings.hotel }, taxes: { ...defaultSettings.taxes, ...db.settings.taxes }, numbering: { ...defaultSettings.numbering, ...db.settings.numbering }, defaults: { ...defaultSettings.defaults, ...db.settings.defaults } };
    return db;
  } catch {
    return buildSeedDatabase();
  }
}
function persist(db: Database) {
  try { window.localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* quota / private mode */ }
}

type Store = {
  db: Database;
  ready: boolean;
  settings: Settings;
  invoices: Invoice[];
  customers: Customer[];
  catalog: CatalogItem[];
  getInvoice: (id: string) => Invoice | undefined;
  getCustomer: (id: string) => Customer | undefined;
  nextInvoiceNumber: () => string;
  createInvoice: (draft: Omit<Invoice, "id" | "number" | "createdAt" | "updatedAt">) => Invoice;
  updateInvoice: (id: string, patch: Partial<Invoice> | ((inv: Invoice) => Invoice)) => void;
  deleteInvoice: (id: string) => void;
  duplicateInvoice: (id: string) => Invoice | undefined;
  upsertCustomer: (c: Partial<Customer> & { company: string }) => Customer;
  deleteCustomer: (id: string) => void;
  upsertCatalogItem: (c: Partial<CatalogItem> & { name: string }) => CatalogItem;
  deleteCatalogItem: (id: string) => void;
  updateSettings: (patch: Partial<Settings> | ((s: Settings) => Settings)) => void;
  exportJSON: () => string;
  importJSON: (json: string) => { ok: true } | { ok: false; error: string };
  resetToDemo: () => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Database>(() => buildSeedDatabase());
  const [ready, setReady] = useState(false);
  const dbRef = useRef(db);
  dbRef.current = db;

  useEffect(() => {
    setDb(load());
    setReady(true);
    // keep tabs in sync
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setDb(load()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const commit = useCallback((fn: (d: Database) => Database) => {
    setDb((prev) => { const next = fn(prev); persist(next); return next; });
  }, []);

  const store = useMemo<Store>(() => {
    const now = () => new Date().toISOString();
    return {
      db, ready,
      settings: db.settings, invoices: db.invoices, customers: db.customers, catalog: db.catalog,
      getInvoice: (id) => db.invoices.find((i) => i.id === id),
      getCustomer: (id) => db.customers.find((c) => c.id === id),
      nextInvoiceNumber: () => formatInvoiceNumber(db.settings.numbering, db.settings.numbering.next),
      createInvoice: (draft) => {
        const d = dbRef.current;
        const inv: Invoice = { ...draft, id: uid("inv"), number: formatInvoiceNumber(d.settings.numbering, d.settings.numbering.next), createdAt: now(), updatedAt: now() };
        commit((cur) => ({ ...cur, invoices: [inv, ...cur.invoices], settings: { ...cur.settings, numbering: { ...cur.settings.numbering, next: cur.settings.numbering.next + 1 } } }));
        return inv;
      },
      updateInvoice: (id, patch) => commit((cur) => ({
        ...cur,
        invoices: cur.invoices.map((i) => i.id !== id ? i : { ...(typeof patch === "function" ? patch(i) : { ...i, ...patch }), updatedAt: now() }),
      })),
      deleteInvoice: (id) => commit((cur) => ({ ...cur, invoices: cur.invoices.filter((i) => i.id !== id) })),
      duplicateInvoice: (id) => {
        const src = dbRef.current.invoices.find((i) => i.id === id);
        if (!src) return undefined;
        const d = dbRef.current;
        const inv: Invoice = { ...src, id: uid("inv"), number: formatInvoiceNumber(d.settings.numbering, d.settings.numbering.next), status: "draft", payments: [], sentAt: undefined, createdAt: now(), updatedAt: now(), items: src.items.map((li) => ({ ...li, id: uid("li") })) };
        commit((cur) => ({ ...cur, invoices: [inv, ...cur.invoices], settings: { ...cur.settings, numbering: { ...cur.settings.numbering, next: cur.settings.numbering.next + 1 } } }));
        return inv;
      },
      upsertCustomer: (c) => {
        const existing = c.id ? dbRef.current.customers.find((x) => x.id === c.id) : undefined;
        const cust: Customer = { id: existing?.id ?? uid("cus"), contactName: "", email: "", phone: "", address1: "", address2: "", city: "", state: "", zip: "", country: "USA", notes: "", createdAt: existing?.createdAt ?? now(), ...existing, ...c } as Customer;
        commit((cur) => ({ ...cur, customers: existing ? cur.customers.map((x) => x.id === cust.id ? cust : x) : [cust, ...cur.customers] }));
        return cust;
      },
      deleteCustomer: (id) => commit((cur) => ({ ...cur, customers: cur.customers.filter((c) => c.id !== id) })),
      upsertCatalogItem: (c) => {
        const existing = c.id ? dbRef.current.catalog.find((x) => x.id === c.id) : undefined;
        const item: CatalogItem = { id: existing?.id ?? uid("cat"), description: "", category: "Other", rate: 0, unit: "each", tax: { meals: false, service: false, house: false }, active: true, ...existing, ...c } as CatalogItem;
        commit((cur) => ({ ...cur, catalog: existing ? cur.catalog.map((x) => x.id === item.id ? item : x) : [...cur.catalog, item] }));
        return item;
      },
      deleteCatalogItem: (id) => commit((cur) => ({ ...cur, catalog: cur.catalog.filter((c) => c.id !== id) })),
      updateSettings: (patch) => commit((cur) => ({ ...cur, settings: typeof patch === "function" ? patch(cur.settings) : { ...cur.settings, ...patch } })),
      exportJSON: () => JSON.stringify(dbRef.current, null, 2),
      importJSON: (json) => {
        try {
          const parsed = JSON.parse(json) as Database;
          if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.invoices) || !Array.isArray(parsed.customers)) return { ok: false, error: "That file is not a Sturbridge Invoicing backup." };
          commit(() => parsed);
          return { ok: true };
        } catch (e) { return { ok: false, error: (e as Error).message }; }
      },
      resetToDemo: () => commit(() => buildSeedDatabase()),
    };
  }, [db, ready, commit]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside <StoreProvider>");
  return s;
}
