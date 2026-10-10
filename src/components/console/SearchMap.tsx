import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ModelResult, ScenarioInput } from "@/lib/searchModel";

interface Props {
  input: ScenarioInput;
  result: ModelResult;
}

/** Dark-tiled Leaflet map: LKP, baseline path, wind-adjusted estimate, uncertainty rings, priority cells. */
export default function SearchMap({ input, result }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!host.current || mapRef.current) return;
    const map = L.map(host.current, {
      center: [input.lat, input.lon],
      zoom: 6,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ &middot; Data &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 16,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const lkp: L.LatLngExpression = [input.lat, input.lon];
    const base: L.LatLngExpression = [result.baseline.lat, result.baseline.lon];
    const wind: L.LatLngExpression = [result.windAdjusted.lat, result.windAdjusted.lon];
    const fmt = (n: number, d = 1) => n.toLocaleString(undefined, { maximumFractionDigits: d });
    const area = (r: number) => Math.PI * r * r;
    const pop = (title: string, rows: [string, string][]) =>
      `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.5;min-width:180px">
        <div style="font-weight:600;margin-bottom:4px">${title}</div>
        ${rows.map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:12px"><span style="opacity:.6">${k}</span><span>${v}</span></div>`).join("")}
      </div>`;

    const R = result.uncertaintyRadiusKm;
    const bands: { label: string; r: number; op: number }[] = [
      { label: "Outer search band", r: R, op: 0.07 },
      { label: "Middle search band", r: (R + result.innerRadiusKm) / 2, op: 0.13 },
      { label: "Core search band", r: result.innerRadiusKm, op: 0.22 },
    ];
    bands.forEach((b, i) => {
      L.circle(wind, {
        radius: b.r * 1000,
        color: "#d97706",
        weight: i === 0 ? 1.2 : 0.8,
        dashArray: i === 0 ? "4 6" : undefined,
        fillColor: "#f59e0b",
        fillOpacity: b.op,
      })
        .addTo(layer)
        .bindPopup(pop(b.label, [
          ["Radius", `${fmt(b.r)} km`],
          ["Area", `${fmt(area(b.r), 0)} km²`],
          ["Priority", ["Low", "Medium", "High"][i] + " (illustrative)"],
        ]));
    });

    // crosshair at estimate
    const cross = (b: number) => {
      const p = L.latLng(wind);
      const off = (R * 1.1) / 111;
      return b === 0
        ? [L.latLng(p.lat - off, p.lng), L.latLng(p.lat + off, p.lng)]
        : [L.latLng(p.lat, p.lng - off / Math.cos((p.lat * Math.PI) / 180)), L.latLng(p.lat, p.lng + off / Math.cos((p.lat * Math.PI) / 180))];
    };
    [0, 1].forEach((b) => L.polyline(cross(b), { color: "#b45309", weight: 0.8, opacity: 0.6, interactive: false }).addTo(layer));

    // paths
    L.polyline([lkp, base], { color: "#1e2a44", weight: 1.5, dashArray: "6 8", opacity: 0.7 })
      .addTo(layer)
      .bindPopup(pop("Projected path (no wind)", [
        ["Distance", `${fmt(result.baselineDistanceKm, 0)} km`],
        ["Heading", `${fmt(input.headingDeg, 0)}°`],
        ["Speed", `${fmt(input.speedKmh, 0)} km/h`],
        ["Elapsed", `${fmt(input.elapsedH, 2)} h`],
      ]));
    L.polyline([base, wind], { color: "#d97706", weight: 2 }).addTo(layer);

    const planeIcon = (heading: number, fill: string, size: number, ghost = false) =>
      L.divIcon({
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="transform:rotate(${heading}deg);opacity:${ghost ? 0.85 : 1};filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.35));cursor:pointer"><path fill="${fill}" stroke="#ffffff" stroke-width="0.8" d="M12 2c.8 0 1.3 1 1.3 2.2V9l7.7 4.6v2l-7.7-2.3v4.6l2.2 1.7V21L12 20l-3.5 1v-1.4l2.2-1.7v-4.6L3 15.6v-2L10.7 9V4.2C10.7 3 11.2 2 12 2z"/></svg>`,
      });

    L.marker(lkp, { icon: planeIcon(input.headingDeg, "#1e2a44", 30) })
      .addTo(layer)
      .bindPopup(pop("Last known position", [
        ["Lat / Lon", `${fmt(input.lat, 4)}, ${fmt(input.lon, 4)}`],
        ["Heading", `${fmt(input.headingDeg, 0)}°`],
        ["Speed", `${fmt(input.speedKmh, 0)} km/h`],
        ["Endurance", `${fmt(input.enduranceH, 2)} h`],
      ]));
    L.circleMarker(base, { radius: 4, color: "#1e2a44", weight: 1.5, fillColor: "#ffffff", fillOpacity: 1 })
      .addTo(layer)
      .bindPopup(pop("Baseline estimate (no wind)", [["Lat / Lon", `${fmt(result.baseline.lat, 4)}, ${fmt(result.baseline.lon, 4)}`]]));
    L.marker(wind, { icon: planeIcon(input.headingDeg, "#d97706", 26, true) })
      .addTo(layer)
      .bindPopup(pop("Wind-adjusted estimate", [
        ["Lat / Lon", `${fmt(result.windAdjusted.lat, 4)}, ${fmt(result.windAdjusted.lon, 4)}`],
        ["Uncertainty", `${fmt(R)} km`],
        ["Search area", `${fmt(area(R), 0)} km²`],
        ["Wind", `${fmt(input.windKmh, 0)} km/h → ${fmt(input.windDirDeg, 0)}°`],
        ["Endurance left", `${fmt(result.enduranceRemainingH, 2)} h`],
      ]));

    map.fitBounds(L.latLngBounds([lkp, base, wind]).extend(L.latLng(wind).toBounds(R * 2000)).pad(0.25), { animate: false });
  }, [input, result]);

  return (
    <div className="relative h-full w-full">
      <div ref={host} className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] border border-ink/15 bg-paper/95 px-3 py-2 font-mono text-[10px] leading-relaxed text-ink/70">
        <div className="flex items-center gap-2"><span className="text-[12px] text-[#1e2a44]">✈</span> Last known position (tap for details)</div>
        <div className="flex items-center gap-2"><span className="inline-block h-0 w-4 border-t-2 border-dashed border-[#1e2a44]" /> Projected path (no wind)</div>
        <div className="flex items-center gap-2"><span className="text-[12px] text-[#d97706]">✈</span> Wind-adjusted estimate</div>
        <div className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#f59e0b]/60" /> Core / middle / outer search bands</div>
        <div className="opacity-60">Tap any shape to see its size</div>
      </div>
    </div>
  );
}
