import type { ModelResult, ScenarioInput } from "@/lib/searchModel";
import type { Flight } from "@/lib/flights";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";

interface Props {
  input: ScenarioInput;
  result: ModelResult;
  warnings: string[];
  flight: Flight | null;
  aircraftType: string | null;
  dataStatus: { source: "live" | "snapshot" | "unavailable"; at: number | null; fetchedAt: number | null };
  onClose: () => void;
}

/** Stable scenario ID from the inputs — same inputs, same ID. */
export function scenarioId(input: ScenarioInput): string {
  const raw = [input.lat, input.lon, input.headingDeg, input.speedKmh, input.elapsedH, input.enduranceH, input.windDirDeg, input.windKmh].join("|");
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0;
  return `SG-${h.toString(36).toUpperCase().padStart(6, "0")}`;
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-6 border-b border-ink/10 py-1.5 text-sm">
    <dt className="text-ink/55">{k}</dt>
    <dd className="text-right font-mono font-medium">{v}</dd>
  </div>
);

const fmtT = (ms: number | null) => (ms ? new Date(ms).toLocaleString() : "—");

export default function MissionReport({ input, result, warnings, flight, aircraftType, dataStatus, onClose }: Props) {
  const generatedAt = new Date();
  const id = scenarioId(input);
  const missing: string[] = [];
  if (!flight) missing.push("No aircraft selected — last known position is a manual scenario input, not a reported position.");
  if (flight && flight.headingDeg == null) missing.push("Selected aircraft reported no heading — scenario heading is an assumption.");
  if (flight && flight.velocityMs == null) missing.push("Selected aircraft reported no speed — scenario speed is an assumption.");
  if (dataStatus.source !== "live") missing.push("Live feed was not available; position data comes from a saved snapshot or manual input.");
  if (flight && aircraftType == null) missing.push("Aircraft type could not be determined — endurance is a generic assumption.");

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-ink/50 p-4 md:p-10" role="dialog" aria-label="Mission report">
      <div className="mission-report mx-auto max-w-3xl bg-paper p-8 shadow-2xl md:p-12">
        <div className="flex items-start justify-between gap-4 print:hidden">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-signal">SearchGrid · Mission report</p>
          <div className="flex gap-2">
            <Button onClick={() => window.print()} className="bg-ink px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-paper">
              <Printer /> Print / Save as PDF
            </Button>
            <Button variant="ghost" onClick={onClose} aria-label="Close report" className="border border-ink/25 px-3 py-2">
              <X />
            </Button>
          </div>
        </div>

        <h1 className="editorial-heading mt-4 text-4xl">Search-area mission report</h1>
        <p className="mt-1 font-mono text-xs text-ink/50">
          Scenario {id} · Generated {generatedAt.toLocaleString()}
        </p>

        <section className="mt-8">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">Scenario inputs</h2>
          <dl className="mt-2">
            <Row k="Last known position" v={`${input.lat.toFixed(4)}°, ${input.lon.toFixed(4)}°`} />
            <Row k="Heading" v={`${input.headingDeg}°`} />
            <Row k="Speed" v={`${input.speedKmh} km/h`} />
            <Row k="Elapsed since last contact" v={`${input.elapsedH} h`} />
            <Row k="Estimated endurance" v={`${input.enduranceH} h`} />
            <Row k="Wind (direction blown toward)" v={`${input.windDirDeg}° at ${input.windKmh} km/h`} />
          </dl>
        </section>

        <section className="mt-6">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">Aircraft & data status</h2>
          <dl className="mt-2">
            <Row k="Aircraft" v={flight ? `${flight.callsign || flight.icao24} (${flight.icao24})` : "None selected"} />
            <Row k="Aircraft type" v={flight ? aircraftType ?? "Unknown" : "—"} />
            <Row k="Last known position source" v={flight ? "Reported feed position" : "Manual scenario input"} />
            <Row k="Feed status" v={dataStatus.source === "live" ? "Live" : dataStatus.source === "snapshot" ? "Snapshot (saved, not current)" : "Unavailable"} />
            <Row k="Data timestamp" v={fmtT(dataStatus.at)} />
            <Row k="Last successful live fetch" v={fmtT(dataStatus.fetchedAt)} />
          </dl>
        </section>

        <section className="mt-6">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">Estimates</h2>
          <dl className="mt-2">
            <Row k="Baseline estimate (no wind)" v={`${result.baseline.lat.toFixed(4)}°, ${result.baseline.lon.toFixed(4)}°`} />
            <Row k="Wind-adjusted estimate" v={`${result.windAdjusted.lat.toFixed(4)}°, ${result.windAdjusted.lon.toFixed(4)}°`} />
            <Row k="Baseline distance travelled" v={`${result.baselineDistanceKm.toFixed(1)} km`} />
            <Row k="Uncertainty radius" v={`${result.uncertaintyRadiusKm.toFixed(1)} km (inner ring ${result.innerRadiusKm.toFixed(1)} km)`} />
            <Row k="Illustrative priority cells" v={`${result.cells.length}`} />
            <Row k="Endurance remaining" v={`${result.enduranceRemainingH.toFixed(2)} h (endurance − elapsed, floored at 0)`} />
          </dl>
        </section>

        <section className="mt-6">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">Model assumptions</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/70">
            <li>Great-circle dead reckoning at constant heading and speed.</li>
            <li>Wind direction is the direction the wind blows toward; drift is an arbitrary 25% of wind speed × elapsed time.</li>
            <li>Uncertainty radius (40 km + 23 km per elapsed hour) and priority cell scores are illustrative — they are not probabilities.</li>
            <li>Endurance remaining assumes the stated total endurance and no reserve.</li>
          </ul>
        </section>

        {(warnings.length > 0 || missing.length > 0) && (
          <section className="mt-6">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">Warnings & missing information</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/70">
              {warnings.map((w) => <li key={w}>{w}</li>)}
              {missing.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </section>
        )}

        <p className="mt-8 border-t border-ink/15 pt-4 text-xs leading-relaxed text-ink/60">
          <strong>Experimental use only.</strong> This report is generated by an illustrative demonstration model.
          It is not validated, must not be used for operational search-and-rescue decisions, and may not reflect
          the actual position of any aircraft.
        </p>
      </div>
    </div>
  );
}
