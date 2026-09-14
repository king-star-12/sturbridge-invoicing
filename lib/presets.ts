import type { ChargeRule, TaxClass, TaxPreset } from "./types";

const rule = (p: Partial<ChargeRule> & Pick<ChargeRule, "id" | "name" | "printLabel" | "kind" | "calc">): ChargeRule => ({
  appliesToClasses: [], onCharges: [], rounding: "total", passThrough: false, showOnDocument: "separate", active: true, notes: "", ...p,
});
const cls = (id: string, name: string, description: string, color: string): TaxClass => ({ id, name, description, color });

const HOSPITALITY_CLASSES: TaxClass[] = [
  cls("fnb", "Food & Beverage", "Meals, catering, coffee service, soft drinks", "#1a7a6b"),
  cls("alcohol", "Alcohol", "Bar packages, wine, beer, spirits", "#7c3aed"),
  cls("room_rental", "Room Rental", "Function and meeting space", "#b9834f"),
  cls("av", "Audio Visual", "AV equipment, Wi-Fi, technician", "#2563eb"),
  cls("guest_rooms", "Guest Rooms", "Sleeping rooms (room occupancy excise)", "#dc2626"),
  cls("exempt", "Non-taxable", "Deposits, pass-through, labor", "#6b7078"),
];

export const presets: TaxPreset[] = [
  {
    id: "ma_hospitality",
    name: "Massachusetts — hotel banquet (default)",
    region: "Massachusetts, USA",
    description: "Meals tax 7% (6.25% state + 0.75% local option) on food & beverage; 14% service charge and 8% house charge on F&B with 6.25% sales tax on those charges; room occupancy excise on sleeping rooms. Matches the hotel's current invoices.",
    classes: HOSPITALITY_CLASSES,
    rules: [
      rule({ id: "ma_meals", name: "MA meals tax", printLabel: "Meals Tax", kind: "tax", calc: { type: "percent", rate: 0.07 }, appliesToClasses: ["fnb", "alcohol"], notes: "6.25% state + 0.75% local option, filed on the meals tax return." }),
      rule({ id: "svc", name: "Service charge", printLabel: "Service Charge", kind: "service", calc: { type: "percent", rate: 0.14 }, appliesToClasses: ["fnb", "alcohol"], notes: "Retained by the house; taxable in MA because it is not fully remitted to staff." }),
      rule({ id: "house", name: "House charge", printLabel: "House Charge", kind: "fee", calc: { type: "percent", rate: 0.08 }, appliesToClasses: ["fnb", "alcohol"] }),
      rule({ id: "ma_sales_on_charges", name: "Sales tax on service + house charge", printLabel: "MA Sales Tax on SC + HC", kind: "tax", calc: { type: "percent", rate: 0.0625 }, onCharges: ["svc", "house"], notes: "Mandatory charges kept by the venue are part of the taxable sales price." }),
      rule({ id: "ma_rooms_state", name: "MA room occupancy excise (state)", printLabel: "State Room Occupancy Tax", kind: "tax", calc: { type: "percent", rate: 0.057 }, appliesToClasses: ["guest_rooms"] }),
      rule({ id: "ma_rooms_local", name: "Room occupancy excise (local option)", printLabel: "Local Room Occupancy Tax", kind: "tax", calc: { type: "percent", rate: 0.06 }, appliesToClasses: ["guest_rooms"], notes: "Sturbridge local option; set to your town's adopted rate." }),
    ],
  },
  {
    id: "ma_gratuity",
    name: "Massachusetts — with segregated gratuity",
    region: "Massachusetts, USA",
    description: "Same as the default, but the service charge is a gratuity paid out to staff in full, so it is not taxed. Use this if the house remits 100% of the charge to service staff (MA Letter Ruling 79-2).",
    classes: HOSPITALITY_CLASSES,
    rules: [
      rule({ id: "ma_meals", name: "MA meals tax", printLabel: "Meals Tax", kind: "tax", calc: { type: "percent", rate: 0.07 }, appliesToClasses: ["fnb", "alcohol"] }),
      rule({ id: "gratuity", name: "Gratuity (to staff)", printLabel: "Gratuity", kind: "gratuity", calc: { type: "percent", rate: 0.18 }, appliesToClasses: ["fnb", "alcohol"], passThrough: true, notes: "Segregated and paid to service staff in full — not taxable." }),
      rule({ id: "house", name: "Administrative fee", printLabel: "Administrative Fee", kind: "fee", calc: { type: "percent", rate: 0.05 }, appliesToClasses: ["fnb", "alcohol"] }),
      rule({ id: "ma_sales_on_charges", name: "Sales tax on administrative fee", printLabel: "MA Sales Tax on Admin Fee", kind: "tax", calc: { type: "percent", rate: 0.0625 }, onCharges: ["house"] }),
      rule({ id: "ma_rooms_state", name: "MA room occupancy excise (state)", printLabel: "State Room Occupancy Tax", kind: "tax", calc: { type: "percent", rate: 0.057 }, appliesToClasses: ["guest_rooms"] }),
      rule({ id: "ma_rooms_local", name: "Room occupancy excise (local option)", printLabel: "Local Room Occupancy Tax", kind: "tax", calc: { type: "percent", rate: 0.06 }, appliesToClasses: ["guest_rooms"] }),
    ],
  },
  {
    id: "us_generic",
    name: "US — single sales tax + service charge",
    region: "USA (generic)",
    description: "One combined state + local sales tax on taxable classes, plus a service charge on food & beverage. Set the rate to your jurisdiction.",
    classes: HOSPITALITY_CLASSES,
    rules: [
      rule({ id: "sales", name: "Sales tax", printLabel: "Sales Tax", kind: "tax", calc: { type: "percent", rate: 0.08 }, appliesToClasses: ["fnb", "alcohol", "av"] }),
      rule({ id: "svc", name: "Service charge", printLabel: "Service Charge", kind: "service", calc: { type: "percent", rate: 0.2 }, appliesToClasses: ["fnb", "alcohol"] }),
      rule({ id: "occupancy", name: "Hotel occupancy tax", printLabel: "Occupancy Tax", kind: "tax", calc: { type: "percent", rate: 0.12 }, appliesToClasses: ["guest_rooms"] }),
    ],
  },
  {
    id: "ca_hst",
    name: "Canada — HST (Ontario)",
    region: "Ontario, Canada",
    description: "13% HST on everything taxable, 18% gratuity on food & beverage (HST applies to mandatory gratuity).",
    classes: HOSPITALITY_CLASSES,
    rules: [
      rule({ id: "grat", name: "Gratuity", printLabel: "Gratuity", kind: "service", calc: { type: "percent", rate: 0.18 }, appliesToClasses: ["fnb", "alcohol"] }),
      rule({ id: "hst", name: "HST", printLabel: "HST", kind: "tax", calc: { type: "percent", rate: 0.13 }, appliesToClasses: ["fnb", "alcohol", "room_rental", "av", "guest_rooms"], onCharges: ["grat"] }),
    ],
  },
  {
    id: "uk_vat",
    name: "United Kingdom — VAT",
    region: "UK",
    description: "20% VAT on all taxable classes; 12.5% discretionary service charge shown separately and outside VAT.",
    classes: HOSPITALITY_CLASSES,
    rules: [
      rule({ id: "vat", name: "VAT", printLabel: "VAT", kind: "tax", calc: { type: "percent", rate: 0.2 }, appliesToClasses: ["fnb", "alcohol", "room_rental", "av", "guest_rooms"] }),
      rule({ id: "svc", name: "Discretionary service charge", printLabel: "Service Charge", kind: "service", calc: { type: "percent", rate: 0.125 }, appliesToClasses: ["fnb", "alcohol"], passThrough: true }),
    ],
  },
  {
    id: "none",
    name: "No taxes or charges",
    region: "—",
    description: "Start from a blank slate and add your own rules.",
    classes: HOSPITALITY_CLASSES,
    rules: [],
  },
];

export const getPreset = (id: string) => presets.find((p) => p.id === id) ?? presets[0];
