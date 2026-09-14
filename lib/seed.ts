import type { CatalogItem, Customer, Database, DocumentTemplate, Invoice, Settings } from "./types";
import { getPreset } from "./presets";

export const classicTemplate: DocumentTemplate = {
  id: "tpl_classic", name: "Classic (current hotel layout)", layout: "classic", accentColor: "#1a7a6b", showLogo: true, showStub: true,
  showUnitColumn: false, showLineTaxCodes: false, showPaymentInstructions: true, showSchedule: true, groupCharges: false,
  titleInvoice: "Invoice", titleEstimate: "Estimate", footerText: "", termsText: "", signatureLine: false, paper: "letter",
};
export const modernTemplate: DocumentTemplate = { ...classicTemplate, id: "tpl_modern", name: "Modern", layout: "modern", accentColor: "#2f3237", showLineTaxCodes: true, showUnitColumn: true, termsText: "Final guaranteed guest count is due 72 hours before the event. Charges are based on the guaranteed count or the number served, whichever is greater. Balance due per the payment schedule above.", signatureLine: true };
export const compactTemplate: DocumentTemplate = { ...classicTemplate, id: "tpl_compact", name: "Compact (one page)", layout: "compact", showStub: false, showPaymentInstructions: false, groupCharges: true };

const ma = getPreset("ma_hospitality");

export const defaultSettings: Settings = {
  business: {
    name: "Sturbridge Host Hotel + Conference Center", legalName: "", address1: "366 Main Street", address2: "", city: "Sturbridge", state: "Massachusetts", zip: "01566", country: "U.S.A",
    phone: "508-347-7393", website: "www.sturbridgehosthotel.com", email: "sales@sturbridgehosthotel.com", taxId: "", logoDataUrl: "",
  },
  locale: { currency: "USD", locale: "en-US", dateFormat: "MMM d, yyyy" },
  numbering: { invoice: { pattern: "INV-SHH{SEQ:4}", next: 1003, resetYearly: false }, estimate: { pattern: "EST-SHH{SEQ:4}", next: 1, resetYearly: false } },
  tax: { presetId: ma.id, classes: ma.classes, rules: ma.rules, defaultClassId: "fnb" },
  categories: ["Room Rental", "Audio Visual", "Food & Beverage", "Beverage", "Bar", "Guest Rooms", "Labor & Staffing", "Other"],
  units: ["each", "per person", "per day", "per night", "per hour", "per dozen", "per gallon"],
  customFields: [
    { id: "cf_guests", label: "Guaranteed guest count", type: "number", options: [], showOnDocument: true, required: false, kinds: ["invoice", "estimate"] },
    { id: "cf_room", label: "Function room", type: "select", options: ["Seminar Room", "Boardroom", "Grand Ballroom", "Ballroom (Half)", "Terrace"], showOnDocument: true, required: false, kinds: ["invoice", "estimate"] },
    { id: "cf_beo", label: "BEO #", type: "text", options: [], showOnDocument: false, required: false, kinds: ["invoice"] },
  ],
  builtInFields: { eventNumber: true, eventName: true, eventDates: true, poNumber: true, salesPerson: true },
  templates: [classicTemplate, modernTemplate, compactTemplate],
  defaultTemplateId: "tpl_classic",
  defaults: { terms: "Due on Receipt", notes: "Thanks for your business.", salesPerson: "Lise Hunt", estimateValidDays: 30 },
  termsOptions: ["Due on Receipt", "Net 7", "Net 15", "Net 30", "Net 45", "Net 60", "End of Month", "Custom"],
  salesPeople: ["Lise Hunt"],
  paymentMethods: ["Check", "Credit Card", "ACH / Wire", "Cash", "Direct Bill", "Other"],
  paymentInstructions: "Please make checks payable to Sturbridge Host Hotel and mail to 366 Main Street, Sturbridge, MA 01566. Credit card payments can be taken by phone at 508-347-7393.",
  deposits: {
    templates: [
      { id: "dep_none", name: "No deposit — pay in full", entries: [] },
      { id: "dep_standard", name: "Standard event (25% / 50% / balance)", entries: [
        { label: "Deposit to hold the date", type: "percent", value: 25, offsetDays: 0, anchor: "invoice" },
        { label: "Second payment", type: "percent", value: 50, offsetDays: -30, anchor: "event" },
        { label: "Final balance", type: "balance", value: 0, offsetDays: -14, anchor: "event" },
      ] },
      { id: "dep_wedding", name: "Wedding (flat hold + 50% + balance)", entries: [
        { label: "Date hold", type: "amount", value: 1000, offsetDays: 0, anchor: "invoice" },
        { label: "50% at 90 days", type: "percent", value: 50, offsetDays: -90, anchor: "event" },
        { label: "Final balance", type: "balance", value: 0, offsetDays: -14, anchor: "event" },
      ] },
    ],
    defaultTemplateId: "dep_none",
  },
  reminders: { dueSoonDays: 7, overdueEveryDays: 7, lateFee: { type: "percent", value: 1.5, graceDays: 10 } },
  email: {
    invoice: { subject: "Invoice {{number}} from {{business}}", body: "Hello {{contact}},\n\nPlease find attached invoice {{number}} for {{event}} in the amount of {{total}}, due {{dueDate}}.\n\n{{paymentInstructions}}\n\nThank you,\n{{salesPerson}}\n{{business}}\n{{phone}}" },
    estimate: { subject: "Estimate {{number}} from {{business}}", body: "Hello {{contact}},\n\nAttached is estimate {{number}} for {{event}}, totaling {{total}}. It is valid until {{dueDate}}. Reply to this email to confirm and we'll hold the date.\n\nThank you,\n{{salesPerson}}\n{{business}}\n{{phone}}" },
    reminder: { subject: "Reminder: invoice {{number}} is {{overdueDays}} days past due", body: "Hello {{contact}},\n\nThis is a friendly reminder that invoice {{number}} for {{total}} was due on {{dueDate}}. The balance of {{balance}} remains open.\n\n{{paymentInstructions}}\n\nThank you,\n{{salesPerson}}\n{{business}}" },
    receipt: { subject: "Payment received — invoice {{number}}", body: "Hello {{contact}},\n\nThank you — we've received {{paymentAmount}} toward invoice {{number}}. Remaining balance: {{balance}}.\n\n{{salesPerson}}\n{{business}}" },
  },
};

export const seedCatalog: CatalogItem[] = [
  { id: "cat_seminar", name: "Seminar Room", description: "Room Rental", category: "Room Rental", rate: 800, unit: "per day", taxClassId: "room_rental", active: true },
  { id: "cat_boardroom", name: "Boardroom", description: "Room Rental", category: "Room Rental", rate: 300, unit: "per day", taxClassId: "room_rental", active: true },
  { id: "cat_ballroom", name: "Grand Ballroom", description: "Room Rental", category: "Room Rental", rate: 2500, unit: "per day", taxClassId: "room_rental", active: true },
  { id: "cat_ballroom_half", name: "Ballroom (Half)", description: "Room Rental", category: "Room Rental", rate: 1400, unit: "per day", taxClassId: "room_rental", active: true },
  { id: "cat_bose", name: "BOSE S1 Audio System with 1 small Microphone", description: "BOSE S1 Audio System with 1 small Microphone", category: "Audio Visual", rate: 200, unit: "each", taxClassId: "av", active: true },
  { id: "cat_projector", name: "LCD Projector & Screen", description: "Projector, screen, HDMI/VGA cabling", category: "Audio Visual", rate: 250, unit: "per day", taxClassId: "av", active: true },
  { id: "cat_flipchart", name: "Flip Chart with Markers", description: "", category: "Audio Visual", rate: 35, unit: "each", taxClassId: "av", active: true },
  { id: "cat_wifi", name: "Wi-Fi - Seminar Room", description: "Wi-Fi - No Guaranteed for Speed.", category: "Audio Visual", rate: 150, unit: "each", taxClassId: "av", active: true },
  { id: "cat_lunch", name: "Lunch per Person", description: "Variable Pricing as per Menu per person", category: "Food & Beverage", rate: 26, unit: "per person", taxClassId: "fnb", active: true },
  { id: "cat_breakfast", name: "Continental Breakfast per Person", description: "Pastries, fruit, juice, coffee & tea", category: "Food & Beverage", rate: 16, unit: "per person", taxClassId: "fnb", active: true },
  { id: "cat_dinner", name: "Plated Dinner per Person", description: "Variable Pricing as per Menu per person", category: "Food & Beverage", rate: 48, unit: "per person", taxClassId: "fnb", active: true },
  { id: "cat_break", name: "Afternoon Break per Person", description: "Cookies, brownies, soft drinks", category: "Food & Beverage", rate: 9, unit: "per person", taxClassId: "fnb", active: true },
  { id: "cat_coffee", name: "Coffee and Tea Service", description: "", category: "Beverage", rate: 3.5, unit: "per person", taxClassId: "fnb", active: true },
  { id: "cat_softdrinks", name: "Assorted Soft Drinks and Bottled Water on Consumption", description: "", category: "Beverage", rate: 2.5, unit: "each", taxClassId: "fnb", active: true },
  { id: "cat_wine", name: "House Wine (bottle)", description: "Red or white, per bottle consumed", category: "Bar", rate: 34, unit: "each", taxClassId: "alcohol", active: true },
  { id: "cat_bar", name: "Bartender Fee", description: "Per bartender, up to 4 hours", category: "Labor & Staffing", rate: 125, unit: "each", taxClassId: "exempt", active: true },
  { id: "cat_guestroom", name: "Guest Room - Standard King", description: "Group block rate, per room per night", category: "Guest Rooms", rate: 159, unit: "per night", taxClassId: "guest_rooms", active: true },
];

export const seedCustomers: Customer[] = [
  { id: "cus_cornerstone", company: "Cornerstone Building Brands", contactName: "Geoffrey Ching", email: "geoffrey.ching@example.com", phone: "860-555-0142", address1: "15 Talcott Mountain Rd", address2: "", city: "Simsbury", state: "CT", zip: "06070", country: "USA", notes: "", taxExempt: false, taxExemptId: "", tags: ["corporate"], createdAt: "2024-10-01T12:00:00.000Z" },
  { id: "cus_sheriff", company: "County's Sheriff Conference", contactName: "Kevin Sullivan", email: "ksullivan@example.com", phone: "978-555-0198", address1: "20 Manning Avenue", address2: "", city: "Middleton", state: "MA", zip: "01949", country: "USA", notes: "", taxExempt: false, taxExemptId: "", tags: ["government"], createdAt: "2024-10-01T12:00:00.000Z" },
  { id: "cus_oldsturbridge", company: "Old Sturbridge Rotary Club", contactName: "Maria Alvarez", email: "maria@example.com", phone: "508-555-0117", address1: "1 Old Sturbridge Village Rd", address2: "", city: "Sturbridge", state: "MA", zip: "01566", country: "USA", notes: "Monthly luncheon, second Tuesday.", taxExempt: true, taxExemptId: "ST-2-04-118822", tags: ["non-profit"], createdAt: "2025-01-15T12:00:00.000Z" },
];

const li = (id: string, cat: CatalogItem, qty: number, rate = cat.rate, description = cat.description) => ({ id, catalogItemId: cat.id, name: cat.name, description, qty, rate, unit: cat.unit, taxClassId: cat.taxClassId });
const c = (id: string) => seedCatalog.find((x) => x.id === id)!;
const snap = (cu: Customer) => ({ company: cu.company, contactName: cu.contactName, email: cu.email, address1: cu.address1, address2: cu.address2, city: cu.city, state: cu.state, zip: cu.zip, country: cu.country });
const base = { kind: "invoice" as const, taxExempt: false, custom: {}, schedule: [], discount: { type: "none" as const, value: 0, label: "" }, internalNotes: "", activity: [] as Invoice["activity"] };

export const seedInvoices: Invoice[] = [
  {
    ...base, id: "inv_1001", number: "INV-SHH1001", status: "sent", customerId: "cus_cornerstone", billTo: snap(seedCustomers[0]),
    invoiceDate: "2024-10-22", terms: "Due on Receipt", dueDate: "2024-10-22", salesPerson: "Lise Hunt",
    eventNumber: "002556", eventName: "Cornerstone Sales Training", eventStart: "2024-10-22", eventEnd: "2024-10-23", poNumber: "",
    custom: { cf_guests: "35", cf_room: "Seminar Room" },
    items: [
      li("l1", c("cat_seminar"), 2, 800, "Room Rental 10/22/24 & 10/23/24"), li("l2", c("cat_bose"), 1), li("l3", c("cat_wifi"), 1),
      li("l4", c("cat_lunch"), 35, 26), li("l5", c("cat_softdrinks"), 2), li("l6", c("cat_coffee"), 30), li("l7", c("cat_lunch"), 35, 32),
    ],
    notes: "Thanks for your business.", payments: [],
    activity: [{ at: "2024-10-22T21:19:54.000Z", event: "Created" }, { at: "2024-10-22T21:20:00.000Z", event: "Marked as sent" }],
    createdAt: "2024-10-22T21:19:54.000Z", updatedAt: "2024-10-22T21:19:54.000Z", sentAt: "2024-10-22T21:20:00.000Z",
  },
  {
    ...base, id: "inv_1002", number: "INV-SHH1002", status: "sent", customerId: "cus_sheriff", billTo: snap(seedCustomers[1]),
    invoiceDate: "2024-10-22", terms: "Due on Receipt", dueDate: "2024-10-22", salesPerson: "Lise Hunt",
    eventNumber: "002564", eventName: "County Sheriff Quarterly Meeting", eventStart: "2024-10-22", eventEnd: "2024-10-23", poNumber: "",
    custom: { cf_guests: "22", cf_room: "Boardroom" },
    items: [li("l1", c("cat_boardroom"), 1), li("l2", c("cat_lunch"), 22, 20, "")],
    notes: "Thanks for your business.",
    payments: [{ id: "pay_1", date: "2024-11-05", amount: 873.65, method: "Check", reference: "#40211", note: "" }],
    activity: [{ at: "2024-10-22T21:25:00.000Z", event: "Created" }, { at: "2024-11-05T15:00:00.000Z", event: "Payment recorded", detail: "$873.65 by Check #40211" }],
    createdAt: "2024-10-22T21:25:00.000Z", updatedAt: "2024-11-05T15:00:00.000Z", sentAt: "2024-10-22T21:26:00.000Z",
  },
];

export function buildSeedDatabase(): Database {
  return { version: 2, settings: defaultSettings, customers: seedCustomers, catalog: seedCatalog, invoices: seedInvoices };
}
