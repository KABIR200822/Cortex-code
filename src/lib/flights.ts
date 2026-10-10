export interface Flight {
  icao24: string;
  callsign: string;
  country: string;
  lastContact: number | null; // unix seconds
  lat: number;
  lon: number;
  altitudeM: number | null;
  onGround: boolean;
  velocityMs: number | null;
  headingDeg: number | null;
  verticalRateMs: number | null;
}

/** Normalize a raw OpenSky state vector (full 17-field format). */
export function fromOpenSkyState(s: unknown[]): Flight | null {
  const lon = s[5] as number | null;
  const lat = s[6] as number | null;
  if (lat == null || lon == null) return null;
  return {
    icao24: String(s[0] ?? ""),
    callsign: String(s[1] ?? "").trim(),
    country: String(s[2] ?? ""),
    lastContact: (s[4] as number | null) ?? null,
    lat,
    lon,
    altitudeM: (s[7] as number | null) ?? null,
    onGround: Boolean(s[8]),
    velocityMs: (s[9] as number | null) ?? null,
    headingDeg: (s[10] as number | null) ?? null,
    verticalRateMs: (s[11] as number | null) ?? null,
  };
}

/** Compact snapshot format: [icao, callsign, country, lastContact, lon, lat, alt, onGround, vel, heading, vrate]. */
export function fromSnapshotRow(r: unknown[]): Flight {
  return {
    icao24: String(r[0]),
    callsign: String(r[1] ?? "").trim(),
    country: String(r[2] ?? ""),
    lastContact: (r[3] as number | null) ?? null,
    lon: r[4] as number,
    lat: r[5] as number,
    altitudeM: (r[6] as number | null) ?? null,
    onGround: Boolean(r[7]),
    velocityMs: (r[8] as number | null) ?? null,
    headingDeg: (r[9] as number | null) ?? null,
    verticalRateMs: (r[10] as number | null) ?? null,
  };
}

export function searchFlights(flights: Flight[], query: string, limit = 25): Flight[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return flights
    .filter((f) => f.callsign.toLowerCase().includes(q) || f.icao24.toLowerCase().includes(q))
    .slice(0, limit);
}

/**
 * ILLUSTRATIVE fuel estimate (percent of capacity remaining). Not real fuel data.
 * Assumes cruise above 7,000 m implies mid-flight (~55%), climbing/low altitude implies early (~85%),
 * descending implies late (~25%), on ground = unknown.
 */
export function estimateFuelPct(f: Pick<Flight, "altitudeM" | "onGround" | "verticalRateMs">): number | null {
  if (f.onGround || f.altitudeM == null) return null;
  const vr = f.verticalRateMs ?? 0;
  if (vr < -2) return 25;
  if (vr > 2 || f.altitudeM < 3000) return 85;
  if (f.altitudeM >= 7000) return 55;
  return 70;
}
