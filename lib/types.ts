/* ------------------------------------------------------------------ */
/* Tax & charge engine                                                 */
/* ------------------------------------------------------------------ */

/** A tax class groups items that are taxed the same way (e.g. Food & Beverage, Room Rental). */
export type TaxClass = { id: string; name: string; description: string; color: string };

export type ChargeKind = "tax" | "service" | "fee" | "gratuity";

export type ChargeRule = {
  id: string;
  name: string;              // internal name
  printLabel: string;        // as printed on the document, e.g. "Meals Tax"
  kind: ChargeKind;
  calc: { type: "percent"; rate: number } | { type: "flat"; amount: number; per: "invoice" | "line" | "unit" };
  /** Percent rules: base = matching line amounts (by tax class) + selected other charges. */
  appliesToClasses: string[];   // tax class ids
  onCharges: string[];          // other rule ids whose computed amount joins the base (compounding)
  rounding: "total" | "line";   // round once on the sum, or per line then sum
  passThrough: boolean;         // e.g. gratuity remitted to staff — excluded from revenue reports
  showOnDocument: "separate" | "grouped"; // own line, or folded into "Taxes & fees"
  active: boolean;
  effectiveFrom?: string;       // ISO date, inclusive
  effectiveTo?: string;         // ISO date, inclusive
  notes: string;
};

export type TaxPreset = { id: string; name: string; region: string; description: string; classes: TaxClass[]; rules: ChargeRule[] };

/* ------------------------------------------------------------------ */
/* Catalog, customers                                                  */
/* ------------------------------------------------------------------ */

export type CatalogItem = {
  id: string;
  name: string;
  description: string;
  category: string;       // user-defined; see settings.categories
  rate: number;
  unit: string;
  taxClassId: string;
  active: boolean;
  sku?: string;
};

export type LineItem = {
  id: string;
  catalogItemId?: string;
  name: string;
  description: string;
  qty: number;
  rate: number;
  unit?: string;
  taxClassId: string;
  /** Per-line exceptions to the rule set: rules to add or drop for this line only. */
  ruleOverrides?: { include: string[]; exclude: string[] };
  discount?: { type: "percent" | "amount"; value: number };
};

export type Customer = {
  id: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  notes: string;
  taxExempt: boolean;          // 501(c)(3) etc. — suppresses "tax" kind rules
  taxExemptId: string;         // certificate number
  defaultTerms?: string;
  tags: string[];
  createdAt: string;
};

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export type DocKind = "invoice" | "estimate";
export type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "void" | "accepted" | "declined" | "converted";

export type Payment = {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference: string;
  note: string;
};

export type Discount = { type: "none" | "percent" | "amount"; value: number; label: string };

export type ScheduleEntry = { id: string; label: string; type: "percent" | "amount" | "balance"; value: number; dueDate: string };

export type ActivityEntry = { at: string; event: string; detail?: string };

export type Invoice = {
  id: string;
  kind: DocKind;
  number: string;
  status: InvoiceStatus;
  customerId: string;
  billTo: Pick<Customer, "company" | "contactName" | "email" | "address1" | "address2" | "city" | "state" | "zip" | "country">;
  taxExempt: boolean;
  invoiceDate: string;
  terms: string;
  dueDate: string;
  salesPerson: string;
  eventNumber: string;
  eventName: string;
  eventStart: string;
  eventEnd: string;
  poNumber: string;
  custom: Record<string, string>;
  items: LineItem[];
  discount: Discount;
  schedule: ScheduleEntry[];
  notes: string;
  internalNotes: string;
  payments: Payment[];
  activity: ActivityEntry[];
  convertedFromId?: string;
  convertedToId?: string;
  templateId?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
};

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export type CustomField = {
  id: string;
  label: string;
  type: "text" | "date" | "number" | "select";
  options: string[];
  showOnDocument: boolean;
  required: boolean;
  kinds: DocKind[];
};

export type DocumentTemplate = {
  id: string;
  name: string;
  layout: "classic" | "modern" | "compact";
  accentColor: string;
  showLogo: boolean;
  showStub: boolean;
  showUnitColumn: boolean;
  showLineTaxCodes: boolean;
  showPaymentInstructions: boolean;
  showSchedule: boolean;
  groupCharges: boolean;         // fold "grouped" rules into one "Taxes & fees" line
  titleInvoice: string;
  titleEstimate: string;
  footerText: string;
  termsText: string;
  signatureLine: boolean;
  paper: "letter" | "a4";
};

export type NumberingRule = { pattern: string; next: number; resetYearly: boolean; lastResetYear?: number };

export type DepositTemplate = { id: string; name: string; entries: { label: string; type: "percent" | "amount" | "balance"; value: number; offsetDays: number; anchor: "invoice" | "event" }[] };

export type EmailTemplate = { subject: string; body: string };

export type Settings = {
  business: {
    name: string; legalName: string; address1: string; address2: string; city: string; state: string; zip: string; country: string;
    phone: string; website: string; email: string; taxId: string; logoDataUrl: string;
  };
  locale: { currency: string; locale: string; dateFormat: "MMM d, yyyy" | "MM/dd/yyyy" | "dd/MM/yyyy" | "yyyy-MM-dd" };
  numbering: { invoice: NumberingRule; estimate: NumberingRule };
  tax: { presetId: string; classes: TaxClass[]; rules: ChargeRule[]; defaultClassId: string };
  categories: string[];
  units: string[];
  customFields: CustomField[];
  builtInFields: { eventNumber: boolean; eventName: boolean; eventDates: boolean; poNumber: boolean; salesPerson: boolean };
  templates: DocumentTemplate[];
  defaultTemplateId: string;
  defaults: { terms: string; notes: string; salesPerson: string; estimateValidDays: number };
  termsOptions: string[];
  salesPeople: string[];
  paymentMethods: string[];
  paymentInstructions: string;
  deposits: { templates: DepositTemplate[]; defaultTemplateId: string };
  reminders: { dueSoonDays: number; overdueEveryDays: number; lateFee: { type: "none" | "percent" | "amount"; value: number; graceDays: number } };
  email: { invoice: EmailTemplate; estimate: EmailTemplate; reminder: EmailTemplate; receipt: EmailTemplate };
};

export type Database = {
  version: 2;
  settings: Settings;
  customers: Customer[];
  catalog: CatalogItem[];
  invoices: Invoice[];
};
