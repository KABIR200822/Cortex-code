import { describe, expect, it } from "vitest";
import { estimateFuelPct, searchFlights, fromSnapshotRow } from "@/lib/flights";

describe("flights", () => {
  it("fuel estimate is unknown on ground", () => {
    expect(estimateFuelPct({ altitudeM: 0, onGround: true, verticalRateMs: 0 })).toBeNull();
  });
  it("cruise gives mid-flight estimate", () => {
    expect(estimateFuelPct({ altitudeM: 10000, onGround: false, verticalRateMs: 0 })).toBe(55);
  });
  it("descending gives late estimate", () => {
    expect(estimateFuelPct({ altitudeM: 5000, onGround: false, verticalRateMs: -5 })).toBe(25);
  });
  it("search matches callsign case-insensitively", () => {
    const f = fromSnapshotRow(["ab6fdd", "AAL2406 ", "United States", 1, -94, 41, 10668, false, 213, 15, 0]);
    expect(searchFlights([f], "aal24")).toHaveLength(1);
    expect(searchFlights([f], "zzz")).toHaveLength(0);
  });
});
