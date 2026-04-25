"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient hero background — warm-paper light theme:
 *   - very faint grid
 *   - cursor-follow cyan wash (low alpha so it reads as atmosphere)
 *   - two drifting soft color orbs (cyan + warm pink) for depth
 *   - disabled under prefers-reduced-motion
 */
export function HeroBg() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let raf = 0;
    let tx = 50;
    let ty = 30;
    let x = tx;
    let y = ty;

    function onMove(e: PointerEvent) {
      const rect = el!.getBoundingClientRect();
      tx = ((e.clientX - rect.left) / rect.width) * 100;
      ty = ((e.clientY - rect.top) / rect.height) * 100;
    }

    function tick() {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      el!.style.setProperty("--mx", `${x}%`);
      el!.style.setProperty("--my", `${y}%`);
      raf = requestAnimationFrame(tick);
    }

    el.style.setProperty("--mx", `${tx}%`);
    el.style.setProperty("--my", `${ty}%`);
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* faint grid */}
      <div className="absolute inset-0 grid-bg grid-bg-fade opacity-60" />

      {/* cursor follow — deep cyan at very low opacity */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(600px circle at var(--mx,50%) var(--my,30%), rgba(8,145,178,0.08), transparent 55%)",
        }}
      />

      {/* subtle warm top wash */}
      <div className="absolute inset-x-0 top-0 h-[500px] bg-gradient-to-b from-[rgba(8,145,178,0.04)] via-transparent to-transparent" />

      {/* drifting color orbs */}
      <div
        className="absolute left-[10%] top-[20%] h-72 w-72 rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(8,145,178,0.12), transparent 60%)",
          animation: "drift-a 18s ease-in-out infinite",
        }}
      />
      <div
        className="absolute right-[8%] top-[55%] h-80 w-80 rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(219,39,119,0.08), transparent 60%)",
          animation: "drift-b 22s ease-in-out infinite",
        }}
      />
    </div>
  );
}
