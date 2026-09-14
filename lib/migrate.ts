/* Upgrades older saved databases to the current shape. Never throws — falls back to defaults per field. */
import type { Customer, Database, Invoice, Settings } from "./types";
import { defaultSettings } from "./seed";

type AnyRec = Record<string, unknown>;

export function migrate(raw: unknown): Database | null {
  if (!raw || typeof raw !== "object") return null;
  const db = raw as AnyRec;
  if (db.version === 2) return normalize(db as unknown as Database);
  if (db.version === 1) return normalize(fromV1(db));
  return null;
}

function fromV1(db: AnyRec): Database {
  const s1 = (db.settings ?? {}) as AnyRec;
  const hotel = (s1.hotel ?? {}) as AnyRec;
  const taxes = (s1.taxes ?? {}) as AnyRec;
  const num = (s1.numbering ?? {}) as AnyRec;
  const settings: Settings = {
    ...defaultSettings,
    business: { ...defaultSettings.business, name: str(hotel.name, defaultSettings.business.name), address1: str(hotel.address1), city: str(hotel.city), state: str(hotel.state), zip: str(hotel.zip), country: str(hotel.country), phone: str(hotel.phone), website: str(hotel.website), email: str(hotel.email) },
    numbering: { ...defaultSettings.numbering, invoice: { pattern: `${str(num.prefix, "INV-SHH")}{SEQ:${Number(num.padding) || 4}}`, next: Number(num.next) || 1, resetYearly: false } },
    tax: {
      ...defaultSettings.tax,
      rules: defaultSettings.tax.rules.map((r) => {
        if (r.id === "ma_meals" && typeof taxes.mealsTaxRate === "number") return { ...r, calc: { type: "percent", rate: taxes.mealsTaxRate } };
        if (r.id === "svc" && typeof taxes.serviceChargeRate === "number") return { ...r, calc: { type: "percent", rate: taxes.serviceChargeRate } };
        if (r.id === "house" && typeof taxes.houseChargeRate === "number") return { ...r, calc: { type: "percent", rate: taxes.houseChargeRate } };
        if (r.id === "ma_sales_on_charges") return { ...r, calc: { type: "percent", rate: typeof taxes.salesTaxRate === "number" ? taxes.salesTaxRate : 0.0625 }, active: taxes.salesTaxOnCharges !== false };
        return r;
      }),
    },
    defaults: { ...defaultSettings.defaults, ...((s1.defaults ?? {}) as object) },
    salesPeople: Array.isArray(s1.salesPeople) ? (s1.salesPeople as string[]) : defaultSettings.salesPeople,
    paymentInstructions: str(s1.paymentInstructions, defaultSettings.paymentInstructions),
  };
  const flagsToClass = (t: AnyRec | undefined) => (t && t.meals && t.service && t.house ? "fnb" : "exempt");
  const catalog = ((db.catalog ?? []) as AnyRec[]).map((c) => ({ id: str(c.id), name: str(c.name), description: str(c.description), category: str(c.category, "Other"), rate: Number(c.rate) || 0, unit: str(c.unit, "each"), taxClassId: flagsToClass(c.tax as AnyRec), active: c.active !== false }));
  const customers = ((db.customers ?? []) as AnyRec[]).map((c) => ({ id: str(c.id), company: str(c.company), contactName: str(c.contactName), email: str(c.email), phone: str(c.phone), address1: str(c.address1), address2: str(c.address2), city: str(c.city), state: str(c.state), zip: str(c.zip), country: str(c.country, "USA"), notes: str(c.notes), taxExempt: false, taxExemptId: "", tags: [], createdAt: str(c.createdAt, new Date().toISOString()) }));
  const invoices = ((db.invoices ?? []) as AnyRec[]).map((i) => {
    const items = ((i.items ?? []) as AnyRec[]).map((l) => {
      const t = l.tax as AnyRec | undefined;
      const all = !!(t && t.meals && t.service && t.house), none = !(t && (t.meals || t.service || t.house));
      const ov = all || none ? undefined : { include: [t?.meals ? "ma_meals" : "", t?.service ? "svc" : "", t?.house ? "house" : ""].filter(Boolean), exclude: [] };
      return { id: str(l.id), catalogItemId: l.catalogItemId as string | undefined, name: str(l.name), description: str(l.description), qty: Number(l.qty) || 0, rate: Number(l.rate) || 0, taxClassId: all ? "fnb" : "exempt", ruleOverrides: ov };
    });
    return { kind: "invoice", taxExempt: false, custom: {}, schedule: [], activity: [], ...(i as object), items } as unknown as Invoice;
  });
  return { version: 2, settings, customers, catalog, invoices };
}

function normalize(db: Database): Database {
  const s = db.settings ?? defaultSettings;
  const settings: Settings = {
    ...defaultSettings, ...s,
    business: { ...defaultSettings.business, ...s.business }, locale: { ...defaultSettings.locale, ...s.locale },
    numbering: { invoice: { ...defaultSettings.numbering.invoice, ...s.numbering?.invoice }, estimate: { ...defaultSettings.numbering.estimate, ...s.numbering?.estimate } },
    tax: { ...defaultSettings.tax, ...s.tax }, defaults: { ...defaultSettings.defaults, ...s.defaults },
    builtInFields: { ...defaultSettings.builtInFields, ...s.builtInFields }, deposits: { ...defaultSettings.deposits, ...s.deposits },
    reminders: { ...defaultSettings.reminders, ...s.reminders, lateFee: { ...defaultSettings.reminders.lateFee, ...s.reminders?.lateFee } },
    email: { ...defaultSettings.email, ...s.email },
    templates: s.templates?.length ? s.templates : defaultSettings.templates,
  };
  const invoices = ((db.invoices ?? []) as Partial<Invoice>[]).map((i) => ({ kind: "invoice" as const, taxExempt: false, custom: {}, schedule: [], activity: [], payments: [], ...i } as Invoice));
  const customers = ((db.customers ?? []) as Partial<Customer>[]).map((c) => ({ taxExempt: false, taxExemptId: "", tags: [], ...c } as Customer));
  return { version: 2, settings, customers, catalog: db.catalog ?? [], invoices };
}

const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
