"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { geoEqualEarth, geoPath } from "d3-geo";
import type { Transaction } from "@/types/api";
import { useT } from "@/i18n/locale-context";
import type { MessageKey } from "@/i18n/messages/en";

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
  if (amount < 50000) return "#22c55e";
  if (amount < 500000) return "#eab308";
  return "#ef4444";
}

function planeRadius(amount: number): number {
  if (amount < 50000) return 2.5;
  if (amount < 500000) return 4;
  return 6;
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

export default function WorldMap({ transactions, onHoverPlane }: WorldMapProps) {
  const t = useT();
  const projection = useMemo(() => {
    return geoEqualEarth()
      .scale(190)
      .center([-15, 30])
      .translate([400, 200]);
  }, []);

  const spherePath = useMemo(() => {
    const pathGen = geoPath().projection(projection);
    return pathGen({ type: "Sphere" } as any) || "";
  }, [projection]);

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
      p0: [number, number];
      p1: [number, number];
      p2: [number, number];
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
          p0,
          p1,
          p2,
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
      const key = `${tx.account_id}-${tx.booking_date}-${tx.amount}-${tx.direction}-${tx.payment_type}`;
      const hash = fnv1a(key);
      const duration = 5 + (hash % 3);
      const delay = (hash % 10) / 10;
      const color = planeColor(tx.amount);
      const radius = planeRadius(tx.amount);

      return {
        tx,
        samples,
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

  return (
    <div className="relative w-full h-full">
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(6,182,212,0.08) 0%, transparent 70%)",
        }}
      />
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <ComposableMap
        projection={projection as unknown as any}
        viewBox="0 0 800 400"
        style={{ width: "100%", height: "100%" }}
      >
        <defs>
          <filter id="tower-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <Geographies geography="/world/world-110m.json">
          {({ geographies }) =>
            geographies.map((geo: any) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#0b1426"
                stroke="#1e3a5f"
                strokeWidth={0.5}
                style={{
                  default: { outline: "none" },
                  hover: { outline: "none" },
                  pressed: { outline: "none" },
                }}
              />
            ))
          }
        </Geographies>

        {spherePath && (
          <path
            d={spherePath}
            fill="none"
            stroke="#1e3a5f"
            strokeWidth={1}
          />
        )}

        {/* Arcs */}
        {arcs.map((arc) => (
          <path
            key={arc.id}
            d={arc.path}
            fill="none"
            stroke="#1e3a5f"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.6}
          />
        ))}

        {/* Towers */}
        {towerPoints.map((tower) => (
          <g key={tower.id} transform={`translate(${tower.x}, ${tower.y})`}>
            <motion.circle
              r={8}
              fill="none"
              stroke="#06b6d4"
              strokeWidth={1.5}
              initial={{ opacity: 0.8, scale: 1 }}
              animate={{ opacity: 0, scale: 3 }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
            <motion.circle
              r={8}
              fill="none"
              stroke="#06b6d4"
              strokeWidth={1}
              initial={{ opacity: 0.6, scale: 1 }}
              animate={{ opacity: 0, scale: 2.5 }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: "easeOut",
                delay: 0.3,
              }}
            />
            <circle r={5} fill="#06b6d4" filter="url(#tower-glow)" />
            <line x1={-12} y1={0} x2={-8} y2={0} stroke="#06b6d4" strokeWidth={0.8} />
            <line x1={8} y1={0} x2={12} y2={0} stroke="#06b6d4" strokeWidth={0.8} />
            <line x1={0} y1={-12} x2={0} y2={-8} stroke="#06b6d4" strokeWidth={0.8} />
            <line x1={0} y1={8} x2={0} y2={12} stroke="#06b6d4" strokeWidth={0.8} />
            <g transform="translate(14, -10)">
              <rect
                x={-4}
                y={-14}
                width={tower.label.length * 7 + 8}
                height={28}
                rx={4}
                fill="#0b1426"
                stroke="#1e3a5f"
                strokeWidth={0.5}
              />
              <text
                x={(tower.label.length * 7 + 8) / 2}
                y={-2}
                textAnchor="middle"
                fill="#06b6d4"
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
                fill="#94a3b8"
                fontSize={7}
                fontFamily="Inter, sans-serif"
              >
                {t(tower.cityKey)}
              </text>
            </g>
          </g>
        ))}

        {/* Flights */}
        {flights.map((flight, idx) => {
          const times = flight.samples.map((_, i) => i / (flight.samples.length - 1));
          return (
            <g key={idx}>
              <motion.circle
                cx={flight.samples[0][0]}
                cy={flight.samples[0][1]}
                r={flight.radius * 2}
                fill={flight.color}
                opacity={0.12}
                animate={{
                  cx: flight.samples.map((p) => p[0]),
                  cy: flight.samples.map((p) => p[1]),
                }}
                transition={{
                  duration: flight.duration,
                  repeat: Infinity,
                  ease: "linear",
                  delay: flight.delay,
                  times,
                }}
              />
              <motion.circle
                cx={flight.samples[0][0]}
                cy={flight.samples[0][1]}
                r={flight.radius}
                fill={flight.color}
                style={{ cursor: "pointer" }}
                animate={{
                  cx: flight.samples.map((p) => p[0]),
                  cy: flight.samples.map((p) => p[1]),
                }}
                transition={{
                  duration: flight.duration,
                  repeat: Infinity,
                  ease: "linear",
                  delay: flight.delay,
                  times,
                }}
                onMouseEnter={() => handleEnter(flight)}
                onMouseLeave={() => onHoverPlane(null)}
              />
            </g>
          );
        })}
      </ComposableMap>
    </div>
  );
}
