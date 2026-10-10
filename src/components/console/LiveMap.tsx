import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Flight } from "@/lib/flights";

interface Props { flights: Flight[]; selected: Flight | null; onSelect: (f: Flight) => void; }
type AircraftOptions = L.CircleMarkerOptions & { heading?: number };
type CanvasInternals = { _ctx?: CanvasRenderingContext2D; _drawing?: boolean };
type MarkerInternals = { _point?: L.Point; _empty: () => boolean; options: AircraftOptions };

// Draw aircraft through Leaflet's canvas renderer instead of adding thousands of DOM nodes.
const AircraftCanvas = L.Canvas.extend({
  _updateCircle(this: CanvasInternals, marker: MarkerInternals) {
    const ctx = this._ctx;
    const point = marker._point;
    if (!ctx || !point || !this._drawing || marker._empty()) return;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate((marker.options.heading ?? 0) * Math.PI / 180);
    const scale = (marker.options.radius ?? 7) / 8;
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(2, -2); ctx.lineTo(8, 2); ctx.lineTo(8, 4);
    ctx.lineTo(2, 2); ctx.lineTo(1.5, 6); ctx.lineTo(4, 8); ctx.lineTo(4, 9);
    ctx.lineTo(0, 8); ctx.lineTo(-4, 9); ctx.lineTo(-4, 8); ctx.lineTo(-1.5, 6);
    ctx.lineTo(-2, 2); ctx.lineTo(-8, 4); ctx.lineTo(-8, 2); ctx.lineTo(-2, -2); ctx.closePath();
    ctx.globalAlpha = marker.options.fillOpacity ?? 0.8;
    ctx.fillStyle = marker.options.fillColor ?? "currentColor";
    ctx.fill();
    ctx.restore();
  },
});

export default function LiveMap({ flights, selected, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const selRef = useRef<L.LayerGroup | null>(null);
  const rendererRef = useRef<L.Canvas | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!host.current || mapRef.current) return;
    const renderer = new AircraftCanvas() as L.Canvas;
    L.setOptions(renderer, { padding: 0.5, tolerance: 5 });
    const map = L.map(host.current, { center: [22, 78], zoom: 4, worldCopyJump: true, preferCanvas: true });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", { attribution: "Tiles &copy; Esri", maxZoom: 16 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    selRef.current = L.layerGroup().addTo(map);
    rendererRef.current = renderer;
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    const renderer = rendererRef.current;
    if (!layer || !renderer || !host.current) return;
    const color = getComputedStyle(host.current).getPropertyValue("--ink").trim();
    layer.clearLayers();
    for (const flight of flights) {
      const options: AircraftOptions = { renderer, radius: 7, weight: 0, fillColor: color, fillOpacity: 0.75, heading: flight.headingDeg ?? 0 };
      L.circleMarker([flight.lat, flight.lon], options).addTo(layer)
        .bindTooltip(flight.callsign || flight.icao24)
        .on("click", () => onSelectRef.current(flight));
    }
  }, [flights]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = selRef.current;
    const renderer = rendererRef.current;
    if (!map || !layer || !renderer || !host.current) return;
    layer.clearLayers();
    if (!selected) return;
    const color = getComputedStyle(host.current).getPropertyValue("--signal").trim();
    const options: AircraftOptions = { renderer, radius: 13, weight: 0, fillColor: color, fillOpacity: 1, heading: selected.headingDeg ?? 0 };
    L.circleMarker([selected.lat, selected.lon], options).addTo(layer)
      .bindTooltip(selected.callsign || selected.icao24, { permanent: true, direction: "top" });
    map.setView([selected.lat, selected.lon], Math.max(map.getZoom(), 6));
  }, [selected]);

  return <div ref={host} className="flight-symbol-map h-full w-full" aria-label="Aircraft position map" />;
}
