import type { CatalogItem, Customer, Database, Invoice, Settings } from "./types";

const FNB = { meals: true, service: true, house: true };
const NONE = { meals: false, service: false, house: false };

export const defaultSettings: Settings = {
  hotel: {
    name: "Sturbridge Host Hotel + Conference Center",
    address1: "366 Main Street",
    city: "Sturbridge",
    state: "Massachusetts",
    zip: "01566",
    country: "U.S.A",
    phone: "508-347-7393",
    website: "www.sturbridgehosthotel.com",
    email: "sales@sturbridgehosthotel.com",
  },
  numbering: { prefix: "INV-SHH", next: 1003, padding: 4 },
  taxes: { mealsTaxRate: 0.07, serviceChargeRate: 0.14, houseChargeRate: 0.08, salesTaxRate: 0.0625, salesTaxOnCharges: true },
  defaults: { terms: "Due on Receipt", notes: "Thanks for your business.", salesPerson: "Lise Hunt" },
  salesPeople: ["Lise Hunt"],
  paymentInstructions:
    "Please make checks payable to Sturbridge Host Hotel and mail to 366 Main Street, Sturbridge, MA 01566. Credit card payments can be taken by phone at 508-347-7393.",
};

export const seedCatalog: CatalogItem[] = [
  { id: "cat_seminar", name: "Seminar Room", description: "Room Rental", category: "Room Rental", rate: 800, unit: "per day", tax: NONE, active: true },
  { id: "cat_boardroom", name: "Boardroom", description: "Room Rental", category: "Room Rental", rate: 300, unit: "per day", tax: NONE, active: true },
  { id: "cat_ballroom", name: "Grand Ballroom", description: "Room Rental", category: "Room Rental", rate: 2500, unit: "per day", tax: NONE, active: true },
  { id: "cat_ballroom_half", name: "Ballroom (Half)", description: "Room Rental", category: "Room Rental", rate: 1400, unit: "per day", tax: NONE, active: true },
  { id: "cat_bose", name: "BOSE S1 Audio System with 1 small Microphone", description: "BOSE S1 Audio System with 1 small Microphone", category: "Audio Visual", rate: 200, unit: "each", tax: NONE, active: true },
  { id: "cat_projector", name: "LCD Projector & Screen", description: "Projector, screen, HDMI/VGA cabling", category: "Audio Visual", rate: 250, unit: "per day", tax: NONE, active: true },
  { id: "cat_flipchart", name: "Flip Chart with Markers", description: "", category: "Audio Visual", rate: 35, unit: "each", tax: NONE, active: true },
  { id: "cat_wifi", name: "Wi-Fi - Seminar Room", description: "Wi-Fi - No Guaranteed for Speed.", category: "Audio Visual", rate: 150, unit: "each", tax: NONE, active: true },
  { id: "cat_lunch", name: "Lunch per Person", description: "Variable Pricing as per Menu per person", category: "Food & Beverage", rate: 26, unit: "per person", tax: FNB, active: true },
  { id: "cat_breakfast", name: "Continental Breakfast per Person", description: "Pastries, fruit, juice, coffee & tea", category: "Food & Beverage", rate: 16, unit: "per person", tax: FNB, active: true },
  { id: "cat_dinner", name: "Plated Dinner per Person", description: "Variable Pricing as per Menu per person", category: "Food & Beverage", rate: 48, unit: "per person", tax: FNB, active: true },
  { id: "cat_break", name: "Afternoon Break per Person", description: "Cookies, brownies, soft drinks", category: "Food & Beverage", rate: 9, unit: "per person", tax: FNB, active: true },
  { id: "cat_coffee", name: "Coffee and Tea Service", description: "", category: "Beverage", rate: 3.5, unit: "per person", tax: FNB, active: true },
  { id: "cat_softdrinks", name: "Assorted Soft Drinks and Bottled Water on Consumption", description: "", category: "Beverage", rate: 2.5, unit: "each", tax: FNB, active: true },
  { id: "cat_bar", name: "Cash Bar Bartender Fee", description: "Per bartender, up to 4 hours", category: "Beverage", rate: 125, unit: "each", tax: NONE, active: true },
  { id: "cat_guestroom", name: "Guest Room - Standard King", description: "Group block rate, per room per night", category: "Guest Rooms", rate: 159, unit: "per night", tax: NONE, active: true },
];

export const seedCustomers: Customer[] = [
  { id: "cus_cornerstone", company: "Cornerstone Building Brands", contactName: "Geoffrey Ching", email: "geoffrey.ching@example.com", phone: "860-555-0142", address1: "15 Talcott Mountain Rd", address2: "", city: "Simsbury", state: "CT", zip: "06070", country: "USA", notes: "", createdAt: "2024-10-01T12:00:00.000Z" },
  { id: "cus_sheriff", company: "County's Sheriff Conference", contactName: "Kevin Sullivan", email: "ksullivan@example.com", phone: "978-555-0198", address1: "20 Manning Avenue", address2: "", city: "Middleton", state: "MA", zip: "01949", country: "USA", notes: "", createdAt: "2024-10-01T12:00:00.000Z" },
  { id: "cus_oldsturbridge", company: "Old Sturbridge Rotary Club", contactName: "Maria Alvarez", email: "maria@example.com", phone: "508-555-0117", address1: "1 Old Sturbridge Village Rd", address2: "", city: "Sturbridge", state: "MA", zip: "01566", country: "USA", notes: "Monthly luncheon, second Tuesday.", createdAt: "2025-01-15T12:00:00.000Z" },
];

const li = (id: string, cat: CatalogItem, qty: number, rate = cat.rate, description = cat.description) => ({
  id, catalogItemId: cat.id, name: cat.name, description, qty, rate, tax: cat.tax,
});
const c = (id: string) => seedCatalog.find((x) => x.id === id)!;
const snap = (cu: Customer) => ({ company: cu.company, contactName: cu.contactName, email: cu.email, address1: cu.address1, address2: cu.address2, city: cu.city, state: cu.state, zip: cu.zip, country: cu.country });

export const seedInvoices: Invoice[] = [
  {
    id: "inv_1001", number: "INV-SHH1001", status: "sent", customerId: "cus_cornerstone", billTo: snap(seedCustomers[0]),
    invoiceDate: "2024-10-22", terms: "Due on Receipt", dueDate: "2024-10-22", salesPerson: "Lise Hunt",
    eventNumber: "002556", eventName: "Cornerstone Sales Training", eventStart: "2024-10-22", eventEnd: "2024-10-23", poNumber: "",
    items: [
      li("l1", c("cat_seminar"), 2, 800, "Room Rental 10/22/24 & 10/23/24"),
      li("l2", c("cat_bose"), 1),
      li("l3", c("cat_wifi"), 1),
      li("l4", c("cat_lunch"), 35, 26),
      li("l5", c("cat_softdrinks"), 2),
      li("l6", c("cat_coffee"), 30),
      li("l7", c("cat_lunch"), 35, 32),
    ],
    discount: { type: "none", value: 0, label: "" },
    notes: "Thanks for your business.", internalNotes: "", payments: [],
    createdAt: "2024-10-22T21:19:54.000Z", updatedAt: "2024-10-22T21:19:54.000Z", sentAt: "2024-10-22T21:20:00.000Z",
  },
  {
    id: "inv_1002", number: "INV-SHH1002", status: "sent", customerId: "cus_sheriff", billTo: snap(seedCustomers[1]),
    invoiceDate: "2024-10-22", terms: "Due on Receipt", dueDate: "2024-10-22", salesPerson: "Lise Hunt",
    eventNumber: "002564", eventName: "County Sheriff Quarterly Meeting", eventStart: "2024-10-22", eventEnd: "2024-10-23", poNumber: "",
    items: [li("l1", c("cat_boardroom"), 1), li("l2", c("cat_lunch"), 22, 20, "")],
    discount: { type: "none", value: 0, label: "" },
    notes: "Thanks for your business.", internalNotes: "", payments: [
      { id: "pay_1", date: "2024-11-05", amount: 873.65, method: "Check", reference: "#40211", note: "" },
    ],
    createdAt: "2024-10-22T21:25:00.000Z", updatedAt: "2024-11-05T15:00:00.000Z", sentAt: "2024-10-22T21:26:00.000Z",
  },
];

export function buildSeedDatabase(): Database {
  return { version: 1, settings: defaultSettings, customers: seedCustomers, catalog: seedCatalog, invoices: seedInvoices };
}
