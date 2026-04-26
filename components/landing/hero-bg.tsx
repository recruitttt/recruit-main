"use client";

import { useEffect, useRef } from "react";
import { mistColors } from "@/components/design-system";

/**
 * Ambient hero background for the Glass/Mist home screen:
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
    <div ref={ref} className="pointer-events-none fixed inset-0 overflow-hidden" style={{ backgroundColor: mistColors.bg }}>
      {/* faint grid */}
      <div className="absolute inset-0 grid-bg grid-bg-fade opacity-35" />

      {/* cursor follow — sage at very low opacity */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(600px circle at var(--mx,50%) var(--my,30%), rgba(63,122,86,0.08), transparent 55%)",
        }}
      />

      {/* subtle warm top wash */}
      <div className="absolute inset-x-0 top-0 h-[500px] bg-gradient-to-b from-white/35 via-white/10 to-transparent" />

      {/* drifting color orbs */}
      <div
        className="absolute left-[10%] top-[20%] h-72 w-72 rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(255,255,255,0.34), transparent 62%)",
          animation: "drift-a 18s ease-in-out infinite",
          mixBlendMode: "soft-light",
        }}
      />
      <div
        className="absolute right-[8%] top-[55%] h-80 w-80 rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(63,122,86,0.14), transparent 62%)",
          animation: "drift-b 22s ease-in-out infinite",
          mixBlendMode: "soft-light",
        }}
      />
    </div>
  );
}
