"use client";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ passcode: code }) });
    setBusy(false);
    if (r.ok) router.replace(params.get("next") || "/");
    else setError((await r.json()).error ?? "Sign-in failed.");
  }

  return (
    <form onSubmit={submit} className="card w-full max-w-sm p-8">
      <div className="flex items-center gap-3 mb-6">
        <Image src="/logo.png" alt="" width={44} height={43} priority />
        <div>
          <div className="font-semibold text-ink-900 leading-tight">Sturbridge Host Hotel</div>
          <div className="text-xs text-ink-500">Invoicing · Staff sign-in</div>
        </div>
      </div>
      <label className="label" htmlFor="pc">Passcode</label>
      <input id="pc" className="input" type="password" autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter staff passcode" />
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full justify-center mt-4" disabled={busy || !code}>{busy ? "Signing in…" : "Sign in"}</button>
      <p className="mt-4 text-xs text-ink-500 text-center">Ask your administrator for the staff passcode.</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-teal-50 via-ink-50 to-gold-400/20">
      <Suspense><LoginForm /></Suspense>
    </main>
  );
}
