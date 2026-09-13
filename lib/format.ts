export const money = (n: number, opts: { symbol?: boolean } = { symbol: true }) => {
  const v = (Math.round((n + Number.EPSILON) * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return opts.symbol === false ? v : `$${v}`;
};
export const num2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = (r: number) => `${+(r * 100).toFixed(3)}%`;

export function fmtDate(iso: string | undefined, style: "short" | "long" | "numeric" = "short"): string {
  if (!iso) return "";
  const d = parseISODate(iso);
  if (!d) return iso;
  if (style === "numeric") return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  if (style === "long") return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}
export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}
export function todayISO(): string {
  const d = new Date();
  return toISO(d);
}
export function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso) ?? new Date();
  d.setDate(d.getDate() + days);
  return toISO(d);
}
export function daysBetween(a: string, b: string): number {
  const da = parseISODate(a), db = parseISODate(b);
  if (!da || !db) return 0;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}
export function eventDateRange(start: string, end: string): string {
  if (!start) return "";
  if (!end || end === start) return fmtDate(start, "numeric");
  return `${fmtDate(start, "numeric")} – ${fmtDate(end, "numeric")}`;
}
