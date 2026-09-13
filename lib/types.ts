export type TaxFlags = {
  meals: boolean;   // MA meals tax
  service: boolean; // service charge (gratuity)
  house: boolean;   // house/administrative charge
};

export type ItemCategory = "Room Rental" | "Audio Visual" | "Food & Beverage" | "Beverage" | "Guest Rooms" | "Other";

export type CatalogItem = {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  rate: number;
  unit: string; // "each", "per person", "per day"
  tax: TaxFlags;
  active: boolean;
};

export type LineItem = {
  id: string;
  catalogItemId?: string;
  name: string;
  description: string;
  qty: number;
  rate: number;
  tax: TaxFlags;
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
  createdAt: string;
};

export type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "void";

export type Payment = {
  id: string;
  date: string; // ISO date
  amount: number;
  method: "Check" | "Credit Card" | "ACH / Wire" | "Cash" | "Other";
  reference: string;
  note: string;
};

export type Discount = { type: "none" | "percent" | "amount"; value: number; label: string };

export type Invoice = {
  id: string;
  number: string;
  status: InvoiceStatus;
  customerId: string;
  // snapshot of customer at time of issue so edits to the customer don't rewrite history
  billTo: Pick<Customer, "company" | "contactName" | "email" | "address1" | "address2" | "city" | "state" | "zip" | "country">;
  invoiceDate: string;
  terms: string; // "Due on Receipt" | "Net 15" | "Net 30" | "Custom"
  dueDate: string;
  salesPerson: string;
  eventNumber: string;
  eventName: string;
  eventStart: string;
  eventEnd: string;
  poNumber: string;
  items: LineItem[];
  discount: Discount;
  notes: string;
  internalNotes: string;
  payments: Payment[];
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
};

export type Settings = {
  hotel: {
    name: string;
    address1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone: string;
    website: string;
    email: string;
  };
  numbering: { prefix: string; next: number; padding: number };
  taxes: {
    mealsTaxRate: number;     // 0.07
    serviceChargeRate: number; // 0.14
    houseChargeRate: number;   // 0.08
    salesTaxRate: number;      // 0.0625 — applied to service + house charge
    salesTaxOnCharges: boolean;
  };
  defaults: { terms: string; notes: string; salesPerson: string };
  salesPeople: string[];
  paymentInstructions: string;
};

export type Database = {
  version: 1;
  settings: Settings;
  customers: Customer[];
  catalog: CatalogItem[];
  invoices: Invoice[];
};
