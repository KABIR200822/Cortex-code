import { createServerFn } from "@tanstack/react-start";
import { fromOpenSkyState, fromSnapshotRow, type Flight } from "./flights";
import snapshot from "./flightSnapshot.json";

type FlightsResponse = {
  source: "live" | "snapshot";
  at: number; // timestamp of the underlying data (ms)
  fetchedAt: number; // when the server last got a successful live response (ms; 0 = never)
  stale: boolean; // live data older than 60 s
  cached: boolean; // served from the 15 s server cache rather than a fresh upstream call
  received: number;
  invalid: number;
  flights: Flight[];
  note?: string;
};

let cache: { at: number; data: FlightsResponse } | null = null;

const STALE_AFTER_MS = 60_000;

export const getFlights = createServerFn({ method: "GET" }).handler(async (): Promise<FlightsResponse> => {
  const now = Date.now();
  if (cache && now - cache.at < 15_000) return { ...cache.data, cached: true };
  try {
    const res = await fetch("https://opensky-network.org/api/states/all", { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`OpenSky ${res.status}`);
    const data = (await res.json()) as { time?: number; states?: unknown[][] };
    if (!Array.isArray(data.states)) throw new Error("Malformed OpenSky response");
    const states = data.states;
    const flights: Flight[] = [];
    let invalid = 0;
    for (const s of states) {
      const f = fromOpenSkyState(s);
      if (f) flights.push(f);
      else invalid++;
    }
    const out: FlightsResponse = {
      source: "live",
      at: (data.time ?? Math.floor(now / 1000)) * 1000,
      fetchedAt: now,
      stale: false,
      cached: false,
      received: states.length,
      invalid,
      flights,
      ...(flights.length === 0 ? { note: "The live feed returned no usable aircraft positions." } : {}),
    };
    cache = { at: now, data: out };
    return out;
  } catch (e) {
    const reason = e instanceof Error && e.name === "TimeoutError" ? "no response from OpenSky within 12 s" : e instanceof Error ? e.message : "unknown error";
    console.error("OpenSky fetch failed:", reason);
    const snap = snapshot as { time: number; states: unknown[][] };
    return {
      source: "snapshot",
      at: snap.time * 1000,
      fetchedAt: cache?.data.fetchedAt ?? 0,
      stale: true,
      cached: false,
      received: snap.states.length,
      invalid: 0,
      flights: snap.states.map(fromSnapshotRow),
      note: `Live feed unavailable (${reason}) — showing a saved snapshot from ${new Date(snap.time * 1000).toISOString().replace("T", " ").slice(0, 16)} UTC (not current positions).`,
    };
  }
});

export const getAircraftType = createServerFn({ method: "GET" })
  .inputValidator((d: { icao24: string }) => {
    if (!/^[0-9a-f]{6}$/i.test(d.icao24)) throw new Error("Invalid aircraft id");
    return d;
  })
  .handler(async ({ data }) => {
    try {
      const res = await fetch(`https://opensky-network.org/api/metadata/aircraft/icao/${data.icao24.toLowerCase()}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { type: null as string | null };
      const m = (await res.json()) as { model?: string; manufacturerName?: string; typecode?: string };
      const type = [m.manufacturerName, m.model].filter(Boolean).join(" ") || m.typecode || null;
      return { type };
    } catch {
      return { type: null as string | null };
    }
  });
