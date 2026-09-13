"use client";
import { useEffect, useRef, useState } from "react";

/** Scales an 8.5in-wide document down to fit its container (screen only; print is unaffected). */
export default function FitDoc({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [h, setH] = useState<number | undefined>();
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const measure = () => {
      const s = Math.min(1, el.clientWidth / 816);
      setScale(s);
      setH(inner.current ? inner.current.offsetHeight * s : undefined);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el); if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="doc-fit w-full" style={{ height: h }}>
      <div ref={inner} className="doc-fit-inner" style={{ width: 816, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}
