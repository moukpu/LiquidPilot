"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { geoEquirectangular, geoPath } from "d3-geo";
import type { Transaction } from "@/types/api";
import { useT } from "@/i18n/locale-context";
import type { MessageKey } from "@/i18n/messages/en";
import { Plane } from "lucide-react";

interface Tower {
  id: string;
  cityKey: MessageKey;
  coords: [number, number];
  label: string;
}

const TOWERS: Tower[] = [
  { id: "EUR-Main", cityKey: "radar.city.frankfurt", coords: [8.68, 50.11], label: "EUR-Main" },
  { id: "USD-Correspondent", cityKey: "radar.city.newYork", coords: [-74.0, 40.71], label: "USD-Correspondent" },
  { id: "GBP-Local", cityKey: "radar.city.london", coords: [-0.13, 51.51], label: "GBP-Local" },
  // d3 geoEquirectangular expects [lon, lat] — same coords as the 3D
  // globe, just transposed. Markers may visually overlap in Central
  // Europe (Frankfurt/Berlin/Zurich); that's intentional, see globe-3d.
  { id: "EUR-Berlin", cityKey: "radar.city.berlin", coords: [13.41, 52.52], label: "EUR-Berlin" },
  { id: "USD-LA", cityKey: "radar.city.losAngeles", coords: [-118.24, 34.05], label: "USD-LA" },
  { id: "CHF-Zurich", cityKey: "radar.city.zurich", coords: [8.54, 47.37], label: "CHF-Zurich" },
  { id: "JPY-Tokyo", cityKey: "radar.city.tokyo", coords: [139.69, 35.68], label: "JPY-Tokyo" },
  { id: "SGD-Singapore", cityKey: "radar.city.singapore", coords: [103.82, 1.35], label: "SGD-Singapore" },
  { id: "KZT-Almaty", cityKey: "radar.city.almaty", coords: [76.95, 43.25], label: "KZT-Almaty" },
];

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

function getCounterpartyTower(tx: Transaction, towers: Tower[]): Tower {
  const key = `${tx.account_id}-${tx.booking_date}-${tx.amount}-${tx.direction}-${tx.payment_type}`;
  const hash = fnv1a(key);
  const otherTowers = towers.filter((t) => t.id !== tx.account_id);
  if (otherTowers.length === 0) return towers[0];
  return otherTowers[hash % otherTowers.length];
}

function arcControlPoint(p0: [number, number], p2: [number, number]): [number, number] {
  const mx = (p0[0] + p2[0]) / 2;
  const my = (p0[1] + p2[1]) / 2;
  const dx = p2[0] - p0[0];
  const dy = p2[1] - p0[1];
  const cx = mx - dy * 0.3;
  const cy = my + dx * 0.3;
  return [cx, cy];
}

function sampleBezier(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  n: number
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
    const y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
    pts.push([x, y]);
  }
  return pts;
}

function planeColor(amount: number): string {
  if (amount < 50000) return "#22c55e"; // small: green
  if (amount < 500000) return "#eab308"; // medium: yellow
  return "#ef4444"; // large: red
}

function planeRadius(amount: number): number {
  if (amount < 50000) return 10;
  if (amount < 500000) return 14;
  return 18;
}

export interface TooltipData {
  amount: number;
  direction: string;
  payment_type: string;
  value_date: string;
  clearing_delay_days: number;
  src: string;
  dst: string;
}

export interface WorldMapProps {
  transactions: Transaction[];
  onHoverPlane: (data: TooltipData | null) => void;
}

// Map scale and width calculation for infinite wrapping
const MAP_SCALE = 130;
const MAP_WIDTH = 2 * Math.PI * MAP_SCALE;

export default function WorldMap({ transactions, onHoverPlane }: WorldMapProps) {
  const t = useT();
  const [zoom, setZoom] = useState(1);

  const projection = useMemo(() => {
    return geoEquirectangular()
      .scale(MAP_SCALE)
      .center([0, 0])
      .translate([400, 200]);
  }, []);

  const towerPoints = useMemo(() => {
    return TOWERS.map((t) => {
      const [x, y] = projection(t.coords) || [0, 0];
      return { ...t, x, y };
    });
  }, [projection]);

  const arcs = useMemo(() => {
    const result: {
      id: string;
      path: string;
    }[] = [];
    for (let i = 0; i < towerPoints.length; i++) {
      for (let j = i + 1; j < towerPoints.length; j++) {
        const a = towerPoints[i];
        const b = towerPoints[j];
        const p0: [number, number] = [a.x, a.y];
        const p2: [number, number] = [b.x, b.y];
        const p1 = arcControlPoint(p0, p2);
        result.push({
          id: `${a.id}-${b.id}`,
          path: `M ${p0[0]} ${p0[1]} Q ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}`,
        });
      }
    }
    return result;
  }, [towerPoints]);

  const txKey = useMemo(
    () =>
      transactions
        .map(
          (t) =>
            `${t.account_id}|${t.booking_date}|${t.value_date}|${t.amount}|${t.direction}|${t.payment_type}|${t.clearing_delay_days}`
        )
        .sort()
        .join(",,"),
    [transactions]
  );

  const flights = useMemo(() => {
    const sorted = [...transactions]
      .filter((tx) => TOWERS.some((t) => t.id === tx.account_id))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 28);

    return sorted.map((tx) => {
      const ownTower = TOWERS.find((t) => t.id === tx.account_id)!;
      const otherTower = getCounterpartyTower(tx, TOWERS);
      const src = tx.direction === "OUT" ? ownTower : otherTower;
      const dst = tx.direction === "OUT" ? otherTower : ownTower;
      const srcPt = towerPoints.find((t) => t.id === src.id)!;
      const dstPt = towerPoints.find((t) => t.id === dst.id)!;
      const p0: [number, number] = [srcPt.x, srcPt.y];
      const p2: [number, number] = [dstPt.x, dstPt.y];
      const p1 = arcControlPoint(p0, p2);
      
      const samples = sampleBezier(p0, p1, p2, 40);
      const angles = [];
      for (let i = 0; i < samples.length - 1; i++) {
        const ddx = samples[i+1][0] - samples[i][0];
        const ddy = samples[i+1][1] - samples[i][1];
        angles.push(Math.atan2(ddy, ddx) * (180 / Math.PI));
      }
      angles.push(angles[angles.length - 1]);

      const key = `${tx.account_id}-${tx.booking_date}-${tx.amount}-${tx.direction}-${tx.payment_type}`;
      const hash = fnv1a(key);
      const duration = 5 + (hash % 3);
      const delay = (hash % 10) / 10;
      const color = planeColor(tx.amount);
      const radius = planeRadius(tx.amount);

      return {
        tx,
        samples,
        angles,
        duration,
        delay,
        color,
        radius,
        src: src.id,
        dst: dst.id,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txKey, towerPoints]);

  const handleEnter = (flight: typeof flights[number]) => {
    onHoverPlane({
      amount: flight.tx.amount,
      direction: flight.tx.direction,
      payment_type: flight.tx.payment_type,
      value_date: flight.tx.value_date,
      clearing_delay_days: flight.tx.clearing_delay_days,
      src: flight.src,
      dst: flight.dst,
    });
  };

  // We render 3 copies of the map to simulate infinite horizontal panning
  const offsets = [-MAP_WIDTH, 0, MAP_WIDTH];

  return (
    <div className="relative w-full h-full">
      <ComposableMap
        projection={projection as unknown as any}
        viewBox="0 0 800 400"
        style={{ width: "100%", height: "100%", outline: "none" }}
      >
        <ZoomableGroup 
          zoom={zoom} 
          center={[0, 0]} 
          maxZoom={10} 
          minZoom={1}
          onMove={({ zoom }) => setZoom(zoom)}
        >
          {offsets.map((offsetX) => (
            <g key={`world-copy-${offsetX}`} transform={`translate(${offsetX}, 0)`}>
              {/* Geographies */}
              <Geographies geography="/world/world-110m.json">
                {({ geographies }) =>
                  geographies.map((geo: any) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#E2E8F0"
                      stroke="#CBD5E1"
                      strokeWidth={0.5 / zoom} // keep stroke thin
                      style={{
                        default: { outline: "none" },
                        hover: { outline: "none" },
                        pressed: { outline: "none" },
                      }}
                    />
                  ))
                }
              </Geographies>

              {/* Arcs */}
              {arcs.map((arc) => (
                <path
                  key={arc.id}
                  d={arc.path}
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth={1 / zoom} // keep stroke thin
                  strokeDasharray={`${4 / zoom} ${4 / zoom}`} // keep dash constant
                  opacity={0.6}
                />
              ))}

              {/* Towers */}
              {towerPoints.map((tower) => (
                <g key={tower.id} transform={`translate(${tower.x}, ${tower.y})`}>
                  {/* Strict, non-pulsing dot. Scales down to stay small. */}
                  <circle r={4 / zoom} fill="#0284c7" />
                  
                  {/* Text label that scales down visually to stay constant font size */}
                  <g transform={`scale(${1 / zoom})`}>
                    <g transform="translate(14, -10)">
                      <rect
                        x={-4}
                        y={-14}
                        width={tower.label.length * 7 + 8}
                        height={28}
                        rx={4}
                        fill="#ffffff"
                        stroke="#cbd5e1"
                        strokeWidth={0.5}
                      />
                      <text
                        x={(tower.label.length * 7 + 8) / 2}
                        y={-2}
                        textAnchor="middle"
                        fill="#0284c7"
                        fontSize={9}
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight={600}
                      >
                        {tower.label}
                      </text>
                      <text
                        x={(tower.label.length * 7 + 8) / 2}
                        y={8}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize={7}
                        fontFamily="Inter, sans-serif"
                      >
                        {t(tower.cityKey)}
                      </text>
                    </g>
                  </g>
                </g>
              ))}

              {/* Flights (Planes) */}
              {flights.map((flight, idx) => {
                const times = flight.samples.map((_, i) => i / (flight.samples.length - 1));
                return (
                  <motion.g
                    key={`flight-${idx}`}
                    animate={{
                      x: flight.samples.map((p) => p[0]),
                      y: flight.samples.map((p) => p[1]),
                      rotate: flight.angles,
                    }}
                    transition={{
                      duration: flight.duration,
                      repeat: Infinity,
                      ease: "linear",
                      delay: flight.delay,
                      times,
                    }}
                  >
                    {/* Reverse scale so planes don't become huge when zoomed */}
                    <g transform={`scale(${1 / zoom})`}>
                      {/* Interactive hit area */}
                      <circle 
                        r={flight.radius * 1.5} 
                        fill="transparent" 
                        style={{ cursor: "pointer" }}
                        onMouseEnter={() => handleEnter(flight)}
                        onMouseLeave={() => onHoverPlane(null)}
                      />
                      {/* Lucide plane points top-right (45deg), so we rotate 45deg to point right (0deg) */}
                      <g transform="translate(-12, -12) rotate(45, 12, 12)">
                        <Plane 
                          size={flight.radius} 
                          color={flight.color} 
                          fill={flight.color}
                          strokeWidth={1.5}
                          className="opacity-90"
                        />
                      </g>
                    </g>
                  </motion.g>
                );
              })}
            </g>
          ))}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}

