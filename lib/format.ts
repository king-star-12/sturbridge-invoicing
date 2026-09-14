let CUR = "USD", LOC = "en-US", DF: string = "MMM d, yyyy";
/** Called by the store whenever settings change so every formatter follows the business locale. */
export function configureFormat(currency: string, locale: string, dateFormat: string) { CUR = currency || "USD"; LOC = locale || "en-US"; DF = dateFormat || "MMM d, yyyy"; }

export const money = (n: number, opts: { symbol?: boolean } = { symbol: true }) => {
  const v = Math.round((n + Number.EPSILON) * 100) / 100;
  if (opts.symbol === false) return v.toLocaleString(LOC, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  try { return v.toLocaleString(LOC, { style: "currency", currency: CUR }); } catch { return `$${v.toFixed(2)}`; }
};
export const num2 = (n: number) => n.toLocaleString(LOC, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = (r: number) => `${+(r * 100).toFixed(3)}%`;

export function fmtDate(iso: string | undefined, style: "short" | "long" | "numeric" = "short"): string {
  if (!iso) return "";
  const d = parseISODate(iso.slice(0, 10));
  if (!d) return iso;
  if (style === "numeric") return d.toLocaleDateString(LOC, { month: "2-digit", day: "2-digit", year: "numeric" });
  if (style === "long") return d.toLocaleDateString(LOC, { month: "long", day: "numeric", year: "numeric" });
  const p = (n: number) => String(n).padStart(2, "0");
  switch (DF) {
    case "MM/dd/yyyy": return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()}`;
    case "dd/MM/yyyy": return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
    case "yyyy-MM-dd": return iso.slice(0, 10);
    default: return d.toLocaleDateString(LOC, { day: "numeric", month: "short", year: "numeric" });
  }
}
export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}
export function todayISO(): string { return toISO(new Date()); }
export function toISO(d: Date): string { const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
export function addDays(iso: string, days: number): string { const d = parseISODate(iso) ?? new Date(); d.setDate(d.getDate() + days); return toISO(d); }
export function daysBetween(a: string, b: string): number { const da = parseISODate(a), db = parseISODate(b); if (!da || !db) return 0; return Math.round((db.getTime() - da.getTime()) / 86400000); }
export function eventDateRange(start: string, end: string): string { if (!start) return ""; if (!end || end === start) return fmtDate(start, "numeric"); return `${fmtDate(start, "numeric")} – ${fmtDate(end, "numeric")}`; }
export function monthKey(iso: string) { return iso.slice(0, 7); }

/** Minimal CSV parser (quoted fields, commas, newlines). Returns rows of objects keyed by header. */
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!head) return [];
  const keys = head.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}
export function toCSV(rows: Record<string, unknown>[], columns?: string[]): string {
  if (!rows.length) return "";
  const cols = columns ?? Object.keys(rows[0]);
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
export function download(filename: string, content: string, type = "text/plain") {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = filename; a.click();
}
