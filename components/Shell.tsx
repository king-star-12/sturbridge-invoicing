"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, FileText, FileSignature, LayoutDashboard, LogOut, Menu, Package, Plus, Settings, Users, X } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/estimates", label: "Estimates", icon: FileSignature },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/items", label: "Items & Pricing", icon: Package },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings, admin: true },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const store = useStore();
  const [open, setOpen] = useState(false);
  const logo = store.settings.business.logoDataUrl || "/logo.png";
  async function logout() { await fetch("/api/logout", { method: "POST" }); router.replace("/login"); }

  const Nav = (
    <nav className="flex flex-col gap-1">
      {nav.filter((n) => !n.admin || store.role === "admin").map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (<Link key={href} href={href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${active ? "bg-teal-700 text-white" : "text-ink-700 hover:bg-ink-100"}`}><Icon size={18} strokeWidth={2} /> {label}</Link>);
      })}
    </nav>
  );

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-ink-100 p-4 no-print">
        <Link href="/" className="flex items-center gap-3 px-2 mb-6">
          <Image src={logo} alt="" width={40} height={39} priority unoptimized />
          <div className="leading-tight"><div className="font-semibold text-ink-900 text-sm line-clamp-2">{store.settings.business.name.split("+")[0].trim() || "Invoicing"}</div><div className="text-[11px] text-ink-500">Invoicing · {store.role === "admin" ? "Admin" : "Staff"}</div></div>
        </Link>
        <Link href="/invoices/new" className="btn-primary justify-center mb-2"><Plus size={16} /> New Invoice</Link>
        <Link href="/invoices/new?kind=estimate" className="btn-secondary justify-center mb-4"><Plus size={16} /> New Estimate</Link>
        {Nav}
        <div className="mt-auto pt-4 border-t border-ink-100"><button onClick={logout} className="btn-ghost w-full justify-start"><LogOut size={16} /> Sign out</button></div>
      </aside>
      <div className="md:hidden sticky top-0 z-30 bg-white border-b border-ink-100 flex items-center justify-between px-4 py-3 no-print">
        <Link href="/" className="flex items-center gap-2"><Image src={logo} alt="" width={28} height={27} unoptimized /><span className="font-semibold text-sm">Invoicing</span></Link>
        <div className="flex items-center gap-2"><Link href="/invoices/new" className="btn-primary px-2.5 py-1.5"><Plus size={16} /></Link><button className="btn-ghost px-2" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X size={20} /> : <Menu size={20} />}</button></div>
      </div>
      {open && (<div className="md:hidden fixed inset-0 z-20 bg-black/30 no-print" onClick={() => setOpen(false)}><div className="absolute top-14 left-0 right-0 bg-white p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>{Nav}<button onClick={logout} className="btn-ghost w-full justify-start mt-2"><LogOut size={16} /> Sign out</button></div></div>)}
      <main className="flex-1 md:pl-60"><div className="mx-auto max-w-6xl p-4 md:p-8">{children}</div></main>
    </div>
  );
}
