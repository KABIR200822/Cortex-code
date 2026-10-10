import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runModel, validateScenario, SAMPLE_SCENARIO, type ScenarioInput } from "@/lib/searchModel";
import { estimateFuelPct, searchFlights, type Flight } from "@/lib/flights";
import { getAircraftType, getFlights } from "@/lib/flights.functions";

import { Button } from "@/components/ui/button";
import { ArrowRight, Check, FileText, LoaderCircle, Plane, RefreshCw, Search } from "lucide-react";
import MissionReport from "@/components/console/MissionReport";

const SearchMap = lazy(() => import("@/components/console/SearchMap"));
const LiveMap = lazy(() => import("@/components/console/LiveMap"));

export const Route = createFileRoute("/console")({
  head: () => ({
    meta: [
      { title: "SearchGrid Console — Live Flights & Search Planner" },
      { name: "description", content: "Live flight map, flight lookup and an interactive search-area planner." },
      { property: "og:title", content: "SearchGrid Console — Live Flights & Search Planner" },
      { property: "og:description", content: "Live flight map, flight lookup and an interactive search-area planner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Console,
});

type FlightsData = Awaited<ReturnType<typeof getFlights>>;
type LiveState = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; data: FlightsData };

const label = "font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50";
const card = "min-w-0 border-l border-ink/15 py-2 pl-4";

function Field({ label: l, value, unit, onChange }: { label: string; value: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className={label}>{l}</span>
      <span className="mt-1 flex items-center gap-2 border border-ink/15 bg-paper px-3 py-2 focus-within:border-ink">
        <input type="number" step="any" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full bg-transparent font-mono text-sm outline-none" />
        {unit && <span className="font-mono text-[10px] text-ink/40">{unit}</span>}
      </span>
    </label>
  );
}

function Stat({ k, v, sub, accent }: { k: string; v: string; sub?: string; accent?: boolean }) {
  return (
    <div className={card}>
      <div className={label}>{k}</div>
      <div className={`mt-2 break-words text-xl font-medium ${accent ? "text-signal" : ""}`}>{v}</div>
      {sub && <div className="font-mono text-[10px] text-ink/40">{sub}</div>}
    </div>
  );
}

const fmt = (n: number | null, d = 0, u = "") => (n == null ? "—" : `${n.toFixed(d)}${u}`);

function Console() {
  const [user, setUser] = useState<string | null>(null);
  const [input, setInput] = useState<ScenarioInput>(SAMPLE_SCENARIO);
  const [live, setLive] = useState<LiveState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Flight | null>(null);
  const [planning, setPlanning] = useState<"idle" | "generating" | "ready">("idle");
  const [plannedFlight, setPlannedFlight] = useState<string | null>(null);
  const planningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionId = useRef(0);
  useEffect(() => () => { if (planningTimer.current) clearTimeout(planningTimer.current); }, []);
  const [acType, setAcType] = useState<string | null | "loading">(null);
  const [reportOpen, setReportOpen] = useState(false);
  const validated = useMemo(() => validateScenario(input), [input]);
  const result = useMemo(() => runModel(validated.input), [validated]);
  const fetchFlights = useServerFn(getFlights);
  const fetchType = useServerFn(getAircraftType);

  useEffect(() => {
    setUser("Guest");
  }, []);

  const load = useCallback(async () => {
    setLive({ status: "loading" });
    try {
      setLive({ status: "ok", data: await fetchFlights() });
    } catch (e) {
      setLive({ status: "error", message: e instanceof Error ? e.message : "Request failed" });
    }
  }, [fetchFlights]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const select = useCallback(
    async (f: Flight) => {
      setSelected(f);
      setAcType("loading");
      const requestId = ++selectionId.current;
      const r = await fetchType({ data: { icao24: f.icao24 } }).catch(() => ({ type: null }));
      if (requestId === selectionId.current) setAcType(r.type);
    },
    [fetchType],
  );

  const flights = live.status === "ok" ? live.data.flights : [];
  const results = useMemo(() => searchFlights(flights, query), [flights, query]);
  const set = (p: Partial<ScenarioInput>) => setInput((s) => ({ ...s, ...p }));

  const useInPlanner = (f: Flight) => {
    if (planningTimer.current) clearTimeout(planningTimer.current);
    setPlanning("generating");
    setPlannedFlight(f.callsign || f.icao24);
    set({
      lat: Number(f.lat.toFixed(4)),
      lon: Number(f.lon.toFixed(4)),
      headingDeg: Math.round(f.headingDeg ?? input.headingDeg),
      speedKmh: f.velocityMs ? Math.round(f.velocityMs * 3.6) : input.speedKmh,
    });
    document.getElementById("planner")?.scrollIntoView({ behavior: "smooth", block: "start" });
    planningTimer.current = setTimeout(() => setPlanning("ready"), 900);
  };

  if (!user) return <main className="min-h-screen bg-paper" />;

  const fuel = selected ? estimateFuelPct(selected) : null;

  return (
    <main className="min-h-screen console-page bg-paper font-display text-ink">
      <header className="flex items-center justify-between border-b border-ink/10 px-5 py-4 md:px-8">
        <a href="/" className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center bg-navy font-mono text-xs font-bold text-navy-foreground">SG</span>
          <span>
            <span className="block text-sm font-extrabold tracking-tight">SearchGrid Console</span>
            <span className={label}>Aircraft search planner</span>
          </span>
        </a>
        <div className="flex items-center gap-4">
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60 md:inline">Welcome, {user}</span>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 py-10 md:px-10 md:py-14">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-signal">Mission control</p>
        <h1 className="mt-3 break-words text-5xl md:text-7xl">Welcome, <span className="italic text-signal">{user}.</span></h1>
        <p className="mt-2 text-ink/60">Flight intelligence / Search-area planning</p>

        {/* LIVE FLIGHTS */}
        <section className="mt-12 border-t border-ink/20 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
            <div>
              <p className={label}>01 / Flight intelligence · OpenSky</p>
              <h2 className="editorial-heading mt-2 text-4xl">Live flight feed</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink/60">Reported aircraft positions, headings and last contact times from the OpenSky network. Coverage is partial.</p>
            </div>
            <Button onClick={load} disabled={live.status === "loading"} className="bg-ink px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-paper disabled:opacity-40">
              <RefreshCw className={live.status === "loading" ? "animate-spin" : ""} /> {live.status === "loading" ? "Loading…" : "Refresh"}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 pb-5 lg:grid-cols-4">
            <Stat k="Plotted positions" v={live.status === "ok" ? String(flights.length) : "—"} />
            <Stat k="Reported aircraft" v={live.status === "ok" ? String(live.data.received) : "—"} />
            <Stat k="Data source" v={live.status === "ok" ? (live.data.source === "live" ? (live.data.stale ? "Live (stale)" : "Live") : "Snapshot") : live.status === "error" ? "Unavailable" : "…"} accent />
            <Stat k="Last updated" v={live.status === "ok" ? new Date(live.data.at).toLocaleTimeString() : "—"} sub={live.status === "ok" ? new Date(live.data.at).toLocaleDateString() : ""} />
          </div>
          {live.status === "ok" && (
            <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
              {live.data.cached ? "Served from short-lived cache · " : ""}
              {live.data.flights.length === 0 ? "Feed returned no usable aircraft · " : `${live.data.flights.length} of ${live.data.received} reported aircraft plotted · `}
              {live.data.fetchedAt ? `Last successful live fetch ${new Date(live.data.fetchedAt).toLocaleTimeString()}` : "No successful live fetch this session"}
            </p>
          )}
          {live.status === "ok" && live.data.note && <p className="mb-5 border border-signal/40 bg-signal/10 px-4 py-2.5 font-mono text-xs">{live.data.note}</p>}
          {live.status === "error" && <p className="mb-5 border border-destructive/40 px-4 py-2.5 font-mono text-xs text-destructive">Couldn't load flights ({live.message}). Try Refresh.</p>}
          <div className="h-[420px] overflow-hidden rounded border border-ink/15 md:h-[520px]">
            <ClientOnly fallback={<div className="grid h-full place-items-center font-mono text-xs text-ink/40">Loading map…</div>}>
              <LiveMap flights={flights} selected={selected} onSelect={select} />
            </ClientOnly>
          </div>
        </section>

        <p className="mt-3 text-xs leading-relaxed text-ink/50">{live.status === "ok" && live.data.source === "snapshot" ? `Snapshot data recorded ${new Date(live.data.at).toUTCString()} — not a current live feed.` : "Positions reflect the latest available report, not continuous tracking."} Aircraft may be missing where receivers have no coverage.</p>
        {/* SEARCH */}
        <section className="mt-12 border-t border-ink/20 pt-6">
          <p className={label}>02 / Aircraft lookup</p>
          <h2 className="editorial-heading mt-2 text-4xl">Find a flight</h2>
          <p className="mt-2 text-sm text-ink/60">Search the loaded feed by callsign or aircraft ID to review its latest reported state.</p>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="min-w-0">
            <label className="sr-only" htmlFor="flight-search">Callsign or aircraft ID</label>
            <div className="relative"><Search className="absolute left-4 top-6 size-4 text-ink/40" />
            <input
              id="flight-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Callsign or aircraft ID — e.g. AAL2406"
              className="mt-3 w-full border border-ink/20 bg-paper pl-11 pr-4 py-3 font-mono text-sm outline-none focus:border-ink"
            /></div>
            <ul className="mt-3 max-h-72 divide-y divide-ink/10 overflow-auto">
              {query && results.length === 0 && <li className="py-3 text-sm text-ink/50">No matching flights.</li>}
              {results.map((f) => (
                <li key={f.icao24}>
                  <Button variant="ghost" onClick={() => select(f)} className={`flex h-auto min-h-12 w-full flex-wrap justify-between gap-2 rounded-none px-2 py-2.5 text-left hover:bg-paper ${selected?.icao24 === f.icao24 ? "bg-paper" : ""}`}>
                    <span className="flex items-center gap-2 font-mono text-sm font-bold"><Plane className="text-ink/50" />{f.callsign || "—"}</span>
                    <span className="font-mono text-xs text-ink/50">{f.icao24} · {f.country}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0 border-l-2 border-signal bg-background p-6">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">Flight details</h2>
            {!selected ? (
              <p className="mt-4 text-sm text-ink/60">No aircraft selected.</p>
            ) : (
              <>
                <p className="mt-2 text-3xl font-black tracking-tight">{selected.callsign || selected.icao24}</p>
                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {[
                    ["Aircraft type", acType === "loading" ? "Looking up…" : acType ?? "Unknown"],
                    ["Country", selected.country],
                    ["Last location", `${selected.lat.toFixed(3)}, ${selected.lon.toFixed(3)}`],
                    ["Heading", fmt(selected.headingDeg, 0, "°")],
                    ["Speed", selected.velocityMs == null ? "—" : `${Math.round(selected.velocityMs * 3.6)} km/h`],
                    ["Altitude", selected.onGround ? "On ground" : fmt(selected.altitudeM, 0, " m")],
                    ["Last contact", selected.lastContact ? new Date(selected.lastContact * 1000).toLocaleTimeString() : "—"],
                    ["Fuel estimate*", fuel == null ? "—" : `~${fuel}%`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">{k}</dt>
                      <dd className="break-words font-mono font-bold">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 font-mono text-[10px] text-ink/40">*Rough guess from altitude & climb rate — not real fuel data.</p>
                <Button disabled={planning === "generating"} onClick={() => useInPlanner(selected)} className="mt-5 h-auto min-h-10 w-full whitespace-normal bg-signal px-4 py-3 font-mono text-xs text-ink hover:bg-signal/80">
                  {planning === "generating" ? <><LoaderCircle className="animate-spin" /> Generating search area…</> : <>Plan search area for this flight <ArrowRight /></>}
                </Button>
              </>
            )}
          </div>
          </div>
        </section>

        {/* PLANNER */}
        <section id="planner" className="mt-12 scroll-mt-6 border-t border-ink/20 pt-6">
          <p className={label}>03 / Search-area planner</p>
          <h2 className="editorial-heading mt-2 text-4xl">The search estimate</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/60">An illustrative projected position and uncertainty area from the last known position, speed, heading and wind assumptions. Not operational guidance.</p>
          {planning !== "idle" && <div role="status" aria-live="polite" className="mt-6 border-l-2 border-signal bg-background p-5">
            {planning === "generating" ? <div className="flex items-center gap-3"><LoaderCircle className="size-5 animate-spin text-signal" /><span>Generating estimate for {plannedFlight}…</span></div> : <>
              <div className="flex items-center gap-2 font-medium"><Check className="size-5 text-signal" />Search estimate ready · {plannedFlight}</div>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">Estimated center: {result.windAdjusted.lat.toFixed(3)}°, {result.windAdjusted.lon.toFixed(3)}°. Uncertainty radius: {result.uncertaintyRadiusKm.toFixed(1)} km. {result.cells.length} illustrative priority cells.</p>
              <p className="mt-2 text-xs leading-relaxed text-ink/50">Flight position, heading and speed have been copied. Elapsed time ({input.elapsedH} h), endurance ({input.enduranceH} h) and wind remain editable scenario assumptions, not measured flight data.</p>
            </>}
          </div>}
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat k="Last known position" v={`${input.lat.toFixed(3)}°`} sub={`${input.lon.toFixed(3)}°`} />
            <Stat k="Elapsed time" v={`${input.elapsedH} h`} />
            <Stat k="Baseline distance" v={`${result.baselineDistanceKm.toFixed(0)} km`} />
            <Stat k="Model status" v="Demo estimate" sub="Not operational guidance" accent />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="space-y-4 border-r border-ink/15 pr-5">
              <p className="text-sm font-medium">Scenario inputs</p>
              <p className="text-xs leading-relaxed text-ink/50">
                {selected ? "Position, heading and speed are reported data copied from the selected aircraft." : "All values are manual assumptions — no aircraft selected."}{" "}
                Elapsed time, endurance and wind are always assumptions.
              </p>
              {validated.warnings.length > 0 && (
                <ul className="space-y-1 border border-signal/40 bg-signal/10 px-3 py-2 font-mono text-[10px] leading-relaxed">
                  {validated.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitude" value={input.lat} onChange={(v) => set({ lat: v })} />
                <Field label="Longitude" value={input.lon} onChange={(v) => set({ lon: v })} />
              </div>
              <Field label="Heading" unit="deg" value={input.headingDeg} onChange={(v) => set({ headingDeg: v })} />
              <Field label="Speed" unit="km/h" value={input.speedKmh} onChange={(v) => set({ speedKmh: v })} />
              <Field label="Elapsed since contact" unit="h" value={input.elapsedH} onChange={(v) => set({ elapsedH: v })} />
              <Field label="Endurance" unit="h" value={input.enduranceH} onChange={(v) => set({ enduranceH: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Wind dir" unit="deg" value={input.windDirDeg} onChange={(v) => set({ windDirDeg: v })} />
                <Field label="Wind speed" unit="km/h" value={input.windKmh} onChange={(v) => set({ windKmh: v })} />
              </div>
              <Button onClick={() => setInput(SAMPLE_SCENARIO)} className="w-full border border-ink/20 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] hover:border-ink">
                Restore sample
              </Button>
              <Button onClick={() => setReportOpen(true)} className="w-full bg-navy py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-navy-foreground hover:bg-navy/90">
                <FileText /> Generate mission report
              </Button>
            </div>
            <div className="space-y-4">
              <div className="h-[420px] border border-ink/10 md:h-[480px]">
                <ClientOnly fallback={<div className="grid h-full place-items-center font-mono text-xs text-ink/40">Loading map…</div>}>
                  <SearchMap input={input} result={result} />
                </ClientOnly>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Stat k="Wind-adjusted estimate" v={`${result.windAdjusted.lat.toFixed(2)}, ${result.windAdjusted.lon.toFixed(2)}`} accent />
                <Stat k="Uncertainty radius" v={`${result.uncertaintyRadiusKm.toFixed(1)} km`} />
                <Stat k="Endurance remaining" v={`${result.enduranceRemainingH.toFixed(2)} h`} />
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-10 border-t border-ink/10 pt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
          SearchGrid · Demo only. OpenSky coverage is incomplete — missing aircraft do not mean an area is clear.
        </footer>
      </div>
      {reportOpen && (
        <MissionReport
          input={validated.input}
          result={result}
          warnings={validated.warnings}
          flight={selected}
          aircraftType={acType === "loading" ? null : acType}
          dataStatus={{
            source: live.status === "ok" ? live.data.source : "unavailable",
            at: live.status === "ok" ? live.data.at : null,
            fetchedAt: live.status === "ok" && live.data.fetchedAt ? live.data.fetchedAt : null,
          }}
          onClose={() => setReportOpen(false)}
        />
      )}
    </main>
  );
}
