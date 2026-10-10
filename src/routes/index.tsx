import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LASTFIX — Aircraft search decision support" },
      { name: "description", content: "Turn the last known flight position and incomplete aircraft data into a map of possible locations." },
      { property: "og:title", content: "Lastfix — Narrow the search" },
      { property: "og:description", content: "Turn the last known flight position and incomplete aircraft data into a map of possible locations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

/* ——— Edit navigation here ——— */
const navItems = [
  { label: "Overview", href: "#overview" },
  { label: "How It Works", href: "#how" },
  { label: "Signals", href: "#signals" },
  { label: "Team", href: "#cta" },
];
const navCta = { label: "Launch Console", href: "/console" };

const steps = [
  { k: "01", t: "Establish the last known position", d: "Use available coordinates, heading, speed and time of last contact." },
  { k: "02", t: "Estimate possible flight paths", d: "Model plausible movement using available flight data and wind assumptions." },
  { k: "03", t: "Incorporate new evidence", d: "Use reported sightings, signals and debris observations to update the search picture when supported by the system." },
  { k: "04", t: "Prioritize areas for investigation", d: "Display candidate search zones with their estimated likelihood and uncertainty." },
];

// Trajectory from right to left across a 1000x600 viewBox
const PATH = "M 1060 110 C 860 90, 760 250, 600 290 S 330 300, 250 420 S 120 520, 60 500";

function useScrollProgress(ref: React.RefObject<HTMLElement | null>) {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      setP(Math.min(1, Math.max(0, -r.top / total)));
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref]);
  return p;
}

function Index() {
  const stage = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const p = useScrollProgress(stage);
  const [len, setLen] = useState(1);
  const [plane, setPlane] = useState({ x: 1060, y: 110, a: 180 });

  useEffect(() => {
    if (pathRef.current) setLen(pathRef.current.getTotalLength());
  }, []);

  // aircraft travels from 0.08 to 0.85 of the scroll; intro nudges it in
  const t = Math.min(1, 0.06 + p * 1.15);
  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const L = el.getTotalLength();
    const a = el.getPointAtLength(t * L);
    const b = el.getPointAtLength(Math.min(L, t * L + 2));
    const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    setPlane({ x: a.x, y: a.y, a: t >= 1 ? 160 : ang });
  }, [t]);

  const search = Math.max(0, (p - 0.55) / 0.45);
  const markers = [0.25, 0.45, 0.62, 0.8];
  const headFade = 1 - Math.min(1, p * 2.2);

  return (
    <main className="bg-paper text-ink">
      {/* NAV */}
      <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-5 md:px-10 mix-blend-difference text-paper">
        <a href="#" className="font-black tracking-tight text-lg">LASTFIX<span className="text-signal">.</span></a>
        <nav className="hidden gap-8 font-mono text-xs uppercase tracking-[0.2em] md:flex">
          {navItems.map((n) => (
            <a key={n.label} href={n.href} className="opacity-70 transition-opacity hover:opacity-100">{n.label}</a>
          ))}
        </nav>
        <a href={navCta.href} target="_blank" rel="noopener noreferrer" className="border border-current px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] transition-opacity hover:opacity-70">{navCta.label}</a>
      </header>

      {/* SCROLL STAGE */}
      <section ref={stage} id="overview" className="relative h-[320vh]">
        <div className="sticky top-0 h-screen overflow-hidden">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden>
            <path
              d={`M ${560 - search * 60} 0 C ${470 - search * 40} 200, ${640 - search * 60} 380, ${520 - search * 60} 600 L 1000 600 L 1000 0 Z`}
              className="fill-navy"
            />
          </svg>
          {/* grid on navy */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(var(--navy-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--navy-foreground) 1px, transparent 1px)",
              backgroundSize: "80px 80px",
              maskImage: "linear-gradient(90deg, transparent 45%, black 70%)",
            }}
          />

          {/* trajectory */}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden>
            <defs>
              <radialGradient id="zone">
                <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--signal)" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* uncertainty cone */}
            <path d={PATH} fill="none" stroke="var(--signal)" strokeOpacity="0.12" strokeWidth={10 + t * 60} strokeLinecap="round"
              strokeDasharray={len} strokeDashoffset={len * (1 - t)} />
            <path d={PATH} fill="none" stroke="var(--ink)" strokeOpacity="0.15" strokeWidth="1" strokeDasharray="3 7" />
            <path ref={pathRef} d={PATH} fill="none" stroke="var(--signal)" strokeWidth="1.5"
              strokeDasharray={len} strokeDashoffset={len * (1 - t)} />
            {markers.map((m, i) => {
              if (!pathRef.current || t < m) return null;
              const pt = pathRef.current.getPointAtLength(m * len);
              return (
                <g key={i} transform={`translate(${pt.x} ${pt.y})`}>
                  <circle r="3" fill="var(--signal)" />
                  <circle r="9" fill="none" stroke="var(--signal)" strokeOpacity="0.5" />
                  <text x="14" y="-10" className="font-mono" fontSize="9" fill="var(--signal)">
                    POSSIBLE PATH · {i + 1}
                  </text>
                </g>
              );
            })}
            {/* search area */}
            <g transform="translate(70 495)" opacity={search}>
              <circle r={140 * search} fill="url(#zone)" />
              {[50, 95, 140].map((r) => (
                <circle key={r} r={r * search} fill="none" stroke="var(--ink)" strokeOpacity="0.35" strokeDasharray="2 5" />
              ))}
              <text x="-60" y="-150" className="font-mono" fontSize="10" fill="var(--ink)">CANDIDATE ZONE · ILLUSTRATION</text>
            </g>
            {/* aircraft */}
            <g transform={`translate(${plane.x} ${plane.y}) rotate(${plane.a})`}>
              <path d="M14 0 L-6 -3 L-10 -14 L-14 -14 L-11 -2 L-18 -1 L-21 -6 L-23 -6 L-22 0 L-23 6 L-21 6 L-18 1 L-11 2 L-14 14 L-10 14 L-6 3 Z"
                transform="rotate(180)" fill="var(--signal)" />
            </g>
          </svg>

          {/* headline */}
          <div className="relative z-10 flex h-full flex-col justify-end px-6 pb-16 md:px-10" style={{ opacity: headFade, transform: `translateY(${-p * 120}px)` }}>
            <p className="animate-rise mb-6 font-mono text-xs uppercase tracking-[0.3em] text-ink/60">LASTFIX — Aircraft search decision support</p>
            <h1 className="animate-rise text-[16vw] font-black leading-[0.82] tracking-[-0.05em] md:text-[11vw]" style={{ animationDelay: "120ms" }}>
              <span className="block text-[6vw] leading-none tracking-[-0.03em] md:text-[3.5vw]">When a signal disappears,</span>NARROW<br /><span className="text-navy-foreground mix-blend-difference">THE SEARCH.</span>
            </h1>
            <p className="animate-rise mt-8 max-w-sm text-lg text-ink/70" style={{ animationDelay: "280ms" }}>
              Turn the last known flight position and incomplete aircraft data into a map of possible locations, helping search teams prioritize where to investigate first.
            </p>
            <div className="animate-rise mt-8 flex flex-wrap gap-3 font-mono text-xs uppercase tracking-[0.2em]" style={{ animationDelay: "380ms" }}>
              <a href="/console" target="_blank" rel="noopener noreferrer" className="bg-ink px-6 py-4 text-paper transition-opacity hover:opacity-80">Launch Console <span className="text-signal">→</span></a>
              <a href="#how" className="border border-ink px-6 py-4 transition-colors hover:bg-ink hover:text-paper">How it works</a>
            </div>
          </div>

          {/* stage readout */}
          <div className="absolute right-6 top-24 z-10 text-right font-mono text-[11px] uppercase tracking-[0.25em] text-navy-foreground/70 md:right-10">
            <div title="Size of the area teams would need to search, calculated by the console from a real scenario.">Search area</div>
            <div className="mt-1 text-lg font-medium normal-case tracking-normal text-navy-foreground">Awaiting scenario data</div>
            <div className="mt-3 max-w-[16rem] normal-case tracking-normal text-navy-foreground/60">Open the console and enter a last known position to calculate a search area.</div>
          </div>
          <div className="absolute bottom-6 right-6 z-10 font-mono text-[10px] uppercase tracking-[0.3em] text-navy-foreground/50 md:right-10">
            Scroll ↓ {String(Math.round(p * 100)).padStart(3, "0")}
          </div>
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="bg-navy px-6 py-32 text-navy-foreground md:px-10">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-signal">How it works</p>
        <h2 className="mt-6 max-w-4xl text-5xl font-black leading-[0.9] tracking-[-0.04em] md:text-7xl">
          From last known position to prioritized search zones.
        </h2>
        <div id="signals" className="mt-20 grid gap-px bg-navy-foreground/10 md:grid-cols-4">
          {steps.map((s) => (
            <div key={s.k} className="bg-navy p-8 transition-colors hover:bg-navy-foreground/5">
              <div className="font-mono text-xs text-signal">{s.k}</div>
              <div className="mt-10 text-2xl font-extrabold tracking-tight">{s.t}</div>
              <p className="mt-3 text-sm text-navy-foreground/60">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="px-6 py-40 md:px-10">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-ink/50">When every minute matters</p>
        <h2 className="mt-6 max-w-5xl text-[10vw] font-black leading-[0.9] tracking-[-0.05em] md:text-[6vw]">
          Make the next search decision more informed.
        </h2>
        <p className="mt-8 max-w-md text-lg text-ink/70">Explore how incomplete flight data can be translated into a structured search plan.</p>
        <a href="/console" target="_blank" rel="noopener noreferrer" className="mt-12 inline-flex items-center gap-4 bg-ink px-8 py-5 font-mono text-sm uppercase tracking-[0.2em] text-paper transition-transform hover:-translate-y-0.5">
          Open console <span className="text-signal">→</span>
        </a>
        <footer className="mt-32 flex justify-between border-t border-ink/10 pt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/50">
          <span>LASTFIX · Aircraft Search Decision Support</span>
          <span className="text-right">Decision support for search-and-rescue teams. Not a replacement for official search-and-rescue authorities.</span>
        </footer>
      </section>
    </main>
  );
}
