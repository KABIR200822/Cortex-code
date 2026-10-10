import { describe, expect, it } from "vitest";
import { destination, runModel, validateScenario, SAMPLE_SCENARIO, type ScenarioInput } from "@/lib/searchModel";

// Regression scenario from the hackathon brief (values verified against the model).
const REGRESSION: ScenarioInput = {
  lat: 41.9708,
  lon: -94.3185,
  headingDeg: 16,
  speedKmh: 769,
  elapsedH: 2.25,
  enduranceH: 5.5,
  windDirDeg: 90,
  windKmh: 20,
};

describe("search model", () => {
  it("baseline distance is speed × elapsed time", () => {
    const r = runModel({ ...SAMPLE_SCENARIO, speedKmh: 240, elapsedH: 2.25 });
    expect(r.baselineDistanceKm).toBeCloseTo(540, 6);
  });

  it("endurance remaining is endurance minus elapsed, floored at 0", () => {
    expect(runModel({ ...SAMPLE_SCENARIO, enduranceH: 5.5, elapsedH: 2.25 }).enduranceRemainingH).toBeCloseTo(3.25, 6);
    expect(runModel({ ...SAMPLE_SCENARIO, enduranceH: 2, elapsedH: 5 }).enduranceRemainingH).toBe(0);
  });

  it("zero wind leaves the wind-adjusted estimate on the baseline estimate", () => {
    const r = runModel({ ...SAMPLE_SCENARIO, windKmh: 0 });
    expect(r.windAdjusted.lat).toBeCloseTo(r.baseline.lat, 6);
    expect(r.windAdjusted.lon).toBeCloseTo(r.baseline.lon, 6);
  });

  it("uncertainty radius grows with elapsed time", () => {
    const early = runModel({ ...SAMPLE_SCENARIO, elapsedH: 1 });
    const late = runModel({ ...SAMPLE_SCENARIO, elapsedH: 4 });
    expect(late.uncertaintyRadiusKm).toBeGreaterThan(early.uncertaintyRadiusKm);
  });

  it("destination due north increases latitude without changing longitude", () => {
    const d = destination(10, 50, 0, 111.2);
    expect(d.lat).toBeGreaterThan(10.9);
    expect(d.lon).toBeCloseTo(50, 3);
  });

  it("priority cells carry scores between 0 and 1", () => {
    const r = runModel(SAMPLE_SCENARIO);
    expect(r.cells.length).toBeGreaterThan(0);
    for (const c of r.cells) {
      expect(c.score).toBeGreaterThan(0);
      expect(c.score).toBeLessThanOrEqual(1);
    }
  });
});

describe("regression scenario (41.9708, -94.3185, hdg 16, 769 km/h, 2.25 h, end 5.5 h, wind 90/20)", () => {
  const r = runModel(REGRESSION);

  it("baseline distance is 769 × 2.25 = 1730.25 km", () => {
    expect(r.baselineDistanceKm).toBeCloseTo(1730.25, 6);
  });

  it("baseline estimate matches the verified great-circle destination", () => {
    expect(r.baseline.lat).toBeCloseTo(56.715809, 4);
    expect(r.baseline.lon).toBeCloseTo(-86.57522, 4);
  });

  it("wind drift pushes the estimate east (toward 90°)", () => {
    expect(r.windAdjusted.lat).toBeCloseTo(56.715673, 4);
    expect(r.windAdjusted.lon).toBeCloseTo(-86.390863, 4);
    expect(r.windAdjusted.lon).toBeGreaterThan(r.baseline.lon);
  });

  it("uncertainty radius is 40 + 23 × 2.25 = 91.75 km, inner ring 48%", () => {
    expect(r.uncertaintyRadiusKm).toBeCloseTo(91.75, 6);
    expect(r.innerRadiusKm).toBeCloseTo(44.04, 6);
  });

  it("endurance remaining is 5.5 − 2.25 = 3.25 h", () => {
    expect(r.enduranceRemainingH).toBeCloseTo(3.25, 6);
  });

  it("produces 36 illustrative priority cells", () => {
    expect(r.cells).toHaveLength(36);
  });
});

describe("validateScenario", () => {
  it("passes a valid scenario through unchanged with no warnings", () => {
    const { input, warnings } = validateScenario(REGRESSION);
    expect(input).toEqual(REGRESSION);
    expect(warnings).toHaveLength(0);
  });

  it("clamps out-of-range latitude and negative speed with warnings", () => {
    const { input, warnings } = validateScenario({ ...REGRESSION, lat: 120, speedKmh: -50 });
    expect(input.lat).toBe(90);
    expect(input.speedKmh).toBe(0);
    expect(warnings).toHaveLength(2);
  });

  it("wraps headings outside 0–360", () => {
    const { input, warnings } = validateScenario({ ...REGRESSION, headingDeg: 380 });
    expect(input.headingDeg).toBe(20);
    expect(warnings).toHaveLength(1);
  });

  it("resets non-numeric input instead of producing NaN coordinates", () => {
    const { input } = validateScenario({ ...REGRESSION, lat: Number.NaN, elapsedH: Number.NaN });
    expect(Number.isFinite(input.lat)).toBe(true);
    expect(Number.isFinite(input.elapsedH)).toBe(true);
    const r = runModel(input);
    expect(Number.isFinite(r.windAdjusted.lat)).toBe(true);
    expect(Number.isFinite(r.windAdjusted.lon)).toBe(true);
  });
});
