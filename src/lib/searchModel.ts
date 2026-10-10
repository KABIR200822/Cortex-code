// Pure search-area model for the SearchGrid console.
// All math is illustrative dead-reckoning + wind drift — not operational guidance.

export interface ScenarioInput {
  lat: number; // last known position, degrees
  lon: number;
  headingDeg: number; // direction of travel
  speedKmh: number;
  elapsedH: number; // hours since last contact
  enduranceH: number; // total estimated endurance
  windDirDeg: number; // direction wind blows TOWARD
  windKmh: number;
}

export interface Estimate {
  lat: number;
  lon: number;
}

export interface Cell {
  lat: number;
  lon: number;
  score: number; // 0..1 illustrative priority
}

export interface ModelResult {
  baseline: Estimate;
  windAdjusted: Estimate;
  baselineDistanceKm: number;
  uncertaintyRadiusKm: number;
  innerRadiusKm: number;
  enduranceRemainingH: number;
  cells: Cell[];
}

const R_EARTH_KM = 6371;
const WIND_DRIFT_FRACTION = 0.25; // arbitrary illustrative fraction
const UNCERTAINTY_BASE_KM = 40;
const UNCERTAINTY_PER_HOUR_KM = 23;

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle destination from a start point, bearing (deg) and distance (km). */
export function destination(lat: number, lon: number, bearingDeg: number, distKm: number): Estimate {
  const d = distKm / R_EARTH_KM;
  const brg = toRad(bearingDeg);
  const la1 = toRad(lat);
  const lo1 = toRad(lon);
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(brg));
  const lo2 =
    lo1 + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return { lat: toDeg(la2), lon: ((toDeg(lo2) + 540) % 360) - 180 };
}

export function runModel(input: ScenarioInput): ModelResult {
  const baselineDistanceKm = input.speedKmh * input.elapsedH;
  const baseline = destination(input.lat, input.lon, input.headingDeg, baselineDistanceKm);

  // Wind drift: wind pushes the aircraft toward windDirDeg for the elapsed time.
  const driftKm = input.windKmh * input.elapsedH * WIND_DRIFT_FRACTION;
  const drift = destination(baseline.lat, baseline.lon, input.windDirDeg, driftKm);
  const windAdjusted = { lat: drift.lat, lon: drift.lon };

  const uncertaintyRadiusKm = UNCERTAINTY_BASE_KM + UNCERTAINTY_PER_HOUR_KM * input.elapsedH;
  const innerRadiusKm = uncertaintyRadiusKm * 0.48;
  const enduranceRemainingH = Math.max(0, input.enduranceH - input.elapsedH);

  // Illustrative priority cells: rings around the wind-adjusted estimate,
  // score decaying with distance from the estimate.
  const cells: Cell[] = [];
  const stepKm = uncertaintyRadiusKm / 2.2;
  for (let ring = 1; ring <= 3; ring++) {
    const n = ring * 6;
    for (let i = 0; i < n; i++) {
      const bearing = (360 / n) * i;
      const c = destination(windAdjusted.lat, windAdjusted.lon, bearing, stepKm * ring);
      const score = Math.max(0.05, 1 - ring * 0.28 - (i % 3) * 0.04);
      cells.push({ lat: c.lat, lon: c.lon, score });
    }
  }

  return {
    baseline,
    windAdjusted,
    baselineDistanceKm,
    uncertaintyRadiusKm,
    innerRadiusKm,
    enduranceRemainingH,
    cells,
  };
}

/**
 * Clamp scenario inputs into sane ranges. Returns the sanitized input plus a
 * list of human-readable warnings for every value that had to be corrected.
 * Assumptions that cannot be validated (documented, not hidden):
 * - Wind direction is the direction the wind blows TOWARD (not the aviation FROM convention).
 * - Wind drift is an arbitrary 25% of wind speed × elapsed time — illustrative only.
 * - Uncertainty radius (40 + 23 km/h elapsed) and priority scores are illustrative, not probabilities.
 */
export function validateScenario(input: ScenarioInput): { input: ScenarioInput; warnings: string[] } {
  const warnings: string[] = [];
  const clamp = (v: number, min: number, max: number, name: string, unit: string) => {
    if (!Number.isFinite(v)) {
      warnings.push(`${name} was not a number — reset to ${min}${unit}.`);
      return min;
    }
    if (v < min || v > max) {
      warnings.push(`${name} ${v}${unit} is out of range — clamped to ${Math.min(Math.max(v, min), max)}${unit}.`);
      return Math.min(Math.max(v, min), max);
    }
    return v;
  };
  const wrap = (v: number, name: string) => {
    if (!Number.isFinite(v)) {
      warnings.push(`${name} was not a number — reset to 0°.`);
      return 0;
    }
    const w = ((v % 360) + 360) % 360;
    if (w !== v) warnings.push(`${name} ${v}° wrapped to ${w}°.`);
    return w;
  };
  return {
    input: {
      lat: clamp(input.lat, -90, 90, "Latitude", "°"),
      lon: clamp(input.lon, -180, 180, "Longitude", "°"),
      headingDeg: wrap(input.headingDeg, "Heading"),
      speedKmh: clamp(input.speedKmh, 0, 2000, "Speed", " km/h"),
      elapsedH: clamp(input.elapsedH, 0, 72, "Elapsed time", " h"),
      enduranceH: clamp(input.enduranceH, 0, 72, "Endurance", " h"),
      windDirDeg: wrap(input.windDirDeg, "Wind direction"),
      windKmh: clamp(input.windKmh, 0, 500, "Wind speed", " km/h"),
    },
    warnings,
  };
}

export const SAMPLE_SCENARIO: ScenarioInput = {
  lat: 12.9716,
  lon: 80.221,
  headingDeg: 135,
  speedKmh: 240,
  elapsedH: 2.25,
  enduranceH: 5.5,
  windDirDeg: 90,
  windKmh: 20,
};
