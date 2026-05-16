"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon,
} from "geojson";
import countries110m from "world-atlas/countries-110m.json";
import type { Transaction } from "@/types/api";
import { useT } from "@/i18n/locale-context";
import type { MessageKey } from "@/i18n/messages/en";

// --- Tower definitions: same 3 cities as the flat map ----------------------
interface Tower {
  id: string;
  cityKey: MessageKey;
  lat: number;
  lon: number;
  label: string;
}

const TOWERS: Tower[] = [
  { id: "EUR-Main", cityKey: "radar.city.frankfurt", lat: 50.11, lon: 8.68, label: "EUR-Main" },
  { id: "USD-Correspondent", cityKey: "radar.city.newYork", lat: 40.71, lon: -74.0, label: "USD-Correspondent" },
  { id: "GBP-Local", cityKey: "radar.city.london", lat: 51.51, lon: -0.13, label: "GBP-Local" },
  // Berlin / Frankfurt / Zurich are within ~5° of each other so the
  // markers visually cluster on the rotating globe — that's a realistic
  // illustration of intra-EU banking concentration, not a coordinate bug.
  { id: "EUR-Berlin", cityKey: "radar.city.berlin", lat: 52.52, lon: 13.41, label: "EUR-Berlin" },
  { id: "USD-LA", cityKey: "radar.city.losAngeles", lat: 34.05, lon: -118.24, label: "USD-LA" },
  { id: "CHF-Zurich", cityKey: "radar.city.zurich", lat: 47.37, lon: 8.54, label: "CHF-Zurich" },
  { id: "JPY-Tokyo", cityKey: "radar.city.tokyo", lat: 35.68, lon: 139.69, label: "JPY-Tokyo" },
  { id: "SGD-Singapore", cityKey: "radar.city.singapore", lat: 1.35, lon: 103.82, label: "SGD-Singapore" },
  { id: "KZT-Almaty", cityKey: "radar.city.almaty", lat: 43.25, lon: 76.95, label: "KZT-Almaty" },
];

const GLOBE_RADIUS = 1;
const ARC_LIFT = 0.06; // peak altitude above surface (~6% of radius — visible but not absurd)
const PLANE_COUNT = 28;
const BORDER_LIFT = 1.001; // sit borders just above surface to avoid z-fight
const GRID_LIFT = 1.0005;

// --- Deterministic hash for stable plane assignment ------------------------
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

// --- Geo -> 3D on unit sphere ----------------------------------------------
function latLonToVec3(latDeg: number, lonDeg: number, r: number): THREE.Vector3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return new THREE.Vector3(
    r * Math.cos(lat) * Math.cos(lon),
    r * Math.sin(lat),
    -r * Math.cos(lat) * Math.sin(lon)
  );
}

// --- Great-circle slerp with altitude lift ---------------------------------
function arcPoint(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  // slerp on unit sphere
  const omega = Math.acos(Math.min(1, Math.max(-1, a.clone().normalize().dot(b.clone().normalize()))));
  if (omega < 1e-6) return a.clone();
  const sinO = Math.sin(omega);
  const c1 = Math.sin((1 - t) * omega) / sinO;
  const c2 = Math.sin(t * omega) / sinO;
  const surface = a.clone().multiplyScalar(c1).add(b.clone().multiplyScalar(c2));
  // lift along the surface normal: peak at t=0.5
  const lift = ARC_LIFT * Math.sin(t * Math.PI);
  const radial = surface.clone().normalize().multiplyScalar(lift);
  return surface.add(radial);
}

function sampleArc(a: THREE.Vector3, b: THREE.Vector3, n: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) pts.push(arcPoint(a, b, i / n));
  return pts;
}

// --- Plane color/size by amount --------------------------------------------
// USD-normalised thresholds. With 7 currencies in play (CHF/JPY/SGD/KZT
// added on top of EUR/USD/GBP) the old per-currency cutoffs lit up every
// KZT plane red because 10M KZT ≈ 22k USD. Convert via the same FX
// table the backend uses, then bucket: <$100k green, <$1M yellow,
// ≥$1M red. Eyeballs in line with what a treasurer would call
// micro-payment / daily clearing / large.
const FX_TO_USD: Record<string, number> = {
  EUR: 1.08,
  USD: 1.0,
  GBP: 1.27,
  CHF: 1.1,
  JPY: 0.0067,
  SGD: 0.74,
  KZT: 0.0022,
};

function amountInUsd(tx: Transaction): number {
  const fx = FX_TO_USD[tx.currency] ?? 1.0;
  return Math.abs(tx.amount) * fx;
}

function planeColorHex(tx: Transaction): string {
  const usd = amountInUsd(tx);
  if (usd < 100_000) return "#22c55e";
  if (usd < 1_000_000) return "#eab308";
  return "#ef4444";
}

function planeSize(tx: Transaction): number {
  // PlaneModel itself is ~4 model units long; final world size =
  // planeSize * 4 ≈ 0.016 / 0.024 / 0.036. Keeps colour/size in lockstep.
  const usd = amountInUsd(tx);
  if (usd < 100_000) return 0.004;
  if (usd < 1_000_000) return 0.006;
  return 0.009;
}

// --- Choose deterministic counterparty tower for OUT/IN tx -----------------
function counterparty(tx: Transaction): Tower {
  const key = `${tx.account_id}-${tx.booking_date}-${tx.amount}-${tx.direction}-${tx.payment_type}`;
  const others = TOWERS.filter((t) => t.id !== tx.account_id);
  if (others.length === 0) return TOWERS[0];
  return others[fnv1a(key) % others.length];
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

export interface Globe3DProps {
  transactions: Transaction[];
  onSelectPlane: (data: TooltipData, remainingMs: number) => void;
}

// ---------------------------------------------------------------------------
// Earth — stylised dark navy sphere + cyan latitude/longitude grid
// ---------------------------------------------------------------------------
// build a LineSegments geometry for real country borders (world-atlas 110m)
function buildBorderGeometry(): THREE.BufferGeometry {
  const topo = countries110m as unknown as Topology;
  const fc = feature(
    topo,
    topo.objects.countries
  ) as unknown as FeatureCollection<Geometry>;

  const positions: number[] = [];
  const stepDeg = 3; // subdivide segments so borders follow curvature

  const addArc = (lon0: number, lat0: number, lon1: number, lat1: number) => {
    const a = latLonToVec3(lat0, lon0, BORDER_LIFT);
    const b = latLonToVec3(lat1, lon1, BORDER_LIFT);
    const an = a.clone().normalize();
    const bn = b.clone().normalize();
    const dot = Math.min(1, Math.max(-1, an.dot(bn)));
    const angleDeg = (Math.acos(dot) * 180) / Math.PI;
    const subs = Math.max(1, Math.ceil(angleDeg / stepDeg));
    let prev = a;
    for (let i = 1; i <= subs; i++) {
      const t = i / subs;
      const p = arcPoint(a, b, t);
      // flatten back to BORDER_LIFT shell (arcPoint adds peak lift)
      p.setLength(BORDER_LIFT);
      positions.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
      prev = p;
    }
  };

  const addRing = (ring: number[][]) => {
    for (let i = 0; i < ring.length - 1; i++) {
      const [lon0, lat0] = ring[i];
      const [lon1, lat1] = ring[i + 1];
      addArc(lon0, lat0, lon1, lat1);
    }
  };

  for (const f of fc.features as Feature<Polygon | MultiPolygon>[]) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "Polygon") {
      for (const ring of g.coordinates) addRing(ring);
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates) {
        for (const ring of poly) addRing(ring);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

function Earth() {
  const gridGeometry = useMemo(() => {
    const positions: number[] = [];
    // parallels (lines of latitude)
    for (let lat = -75; lat <= 75; lat += 15) {
      const yOff = Math.sin((lat * Math.PI) / 180) * GRID_LIFT;
      const r = Math.cos((lat * Math.PI) / 180) * GRID_LIFT;
      const segs = 96;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2;
        const a1 = ((i + 1) / segs) * Math.PI * 2;
        positions.push(
          r * Math.cos(a0), yOff, -r * Math.sin(a0),
          r * Math.cos(a1), yOff, -r * Math.sin(a1)
        );
      }
    }
    // meridians (lines of longitude)
    for (let lon = 0; lon < 360; lon += 15) {
      const segs = 64;
      for (let i = 0; i < segs; i++) {
        const t0 = (i / segs) * Math.PI - Math.PI / 2;
        const t1 = ((i + 1) / segs) * Math.PI - Math.PI / 2;
        const r0 = Math.cos(t0) * GRID_LIFT;
        const r1 = Math.cos(t1) * GRID_LIFT;
        const y0 = Math.sin(t0) * GRID_LIFT;
        const y1 = Math.sin(t1) * GRID_LIFT;
        const ang = (lon * Math.PI) / 180;
        positions.push(
          r0 * Math.cos(ang), y0, -r0 * Math.sin(ang),
          r1 * Math.cos(ang), y1, -r1 * Math.sin(ang)
        );
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, []);

  const borderGeometry = useMemo(() => buildBorderGeometry(), []);

  return (
    <group>
      {/* ocean sphere — medium-tone blue to fit light UI */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 0.995, 96, 96]} />
        <meshStandardMaterial
          color="#1e3a5f"
          roughness={0.85}
          metalness={0}
          emissive="#0f2440"
          emissiveIntensity={0.35}
        />
      </mesh>

      {/* lat/lon wireframe grid */}
      <lineSegments geometry={gridGeometry}>
        <lineBasicMaterial color="#3b6896" transparent opacity={0.5} />
      </lineSegments>

      {/* country borders (real natural-earth 110m) */}
      <lineSegments geometry={borderGeometry}>
        <lineBasicMaterial color="#3b6896" transparent opacity={0.85} />
      </lineSegments>

      {/* outer atmosphere glow */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 1.08, 48, 48]} />
        <meshBasicMaterial
          color="#06b6d4"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Static stuff inside the rotating world: towers, arcs, planes
// All children must rotate together so geography stays aligned.
// ---------------------------------------------------------------------------
function World({
  transactions,
  onSelectPlane,
  t,
}: {
  transactions: Transaction[];
  onSelectPlane: (d: TooltipData, remainingMs: number) => void;
  t: (k: MessageKey) => string;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.03;
  });

  // pre-compute tower 3D positions
  const towerPoints = useMemo(
    () =>
      TOWERS.map((t) => ({
        ...t,
        pos: latLonToVec3(t.lat, t.lon, GLOBE_RADIUS),
      })),
    []
  );

  // static great-circle arcs between every tower pair
  const towerArcs = useMemo(() => {
    const arcs: { id: string; geometry: THREE.BufferGeometry }[] = [];
    for (let i = 0; i < towerPoints.length; i++) {
      for (let j = i + 1; j < towerPoints.length; j++) {
        const pts = sampleArc(towerPoints[i].pos, towerPoints[j].pos, 64);
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        arcs.push({ id: `${towerPoints[i].id}-${towerPoints[j].id}`, geometry: geo });
      }
    }
    return arcs;
  }, [towerPoints]);

  // flight data: per tx, derive src, dst, arc samples
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
      .filter((tx) => TOWERS.some((tt) => tt.id === tx.account_id))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, PLANE_COUNT);

    return sorted.map((tx) => {
      const own = towerPoints.find((p) => p.id === tx.account_id)!;
      const other = (() => {
        const cp = counterparty(tx);
        return towerPoints.find((p) => p.id === cp.id)!;
      })();
      const src = tx.direction === "OUT" ? own : other;
      const dst = tx.direction === "OUT" ? other : own;
      const samples = sampleArc(src.pos, dst.pos, 80);
      const key = `${tx.account_id}-${tx.booking_date}-${tx.amount}-${tx.direction}-${tx.payment_type}`;
      const hash = fnv1a(key);
      // Map clearing rail to visual duration. INTERNAL T+0 zips across in ~3s,
      // SWIFT T+3 takes ~10.5s, CARD T+5 takes ~15.5s. Treasurers visually
      // feel "this SWIFT is slow" without reading the tooltip. Tiny jitter
      // (0..0.5s) so identical-rail flights don't march in lockstep.
      const delay = tx.clearing_delay_days ?? 0;
      const duration = 3 + delay * 2.5 + (hash % 100) / 200;
      const phase = (hash % 1000) / 1000; // 0..1
      return {
        tx,
        src: src.id,
        dst: dst.id,
        samples,
        duration,
        phase,
        color: planeColorHex(tx),
        size: planeSize(tx),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txKey, towerPoints]);

  return (
    <group ref={groupRef}>
      <Earth />

      {/* tower-tower static arcs */}
      {towerArcs.map((a) => (
        <line key={a.id}>
          <bufferGeometry attach="geometry" {...a.geometry} />
          <lineBasicMaterial color="#1e3a5f" transparent opacity={0.45} />
        </line>
      ))}

      {/* towers */}
      {towerPoints.map((tw) => (
        <TowerMarker key={tw.id} position={tw.pos} label={tw.label} city={t(tw.cityKey)} />
      ))}

      {/* flights */}
      {flights.map((f, idx) => (
        <Plane
          key={`${f.src}-${f.dst}-${idx}`}
          samples={f.samples}
          duration={f.duration}
          phase={f.phase}
          color={f.color}
          size={f.size}
          onSelect={(remainingMs) =>
            onSelectPlane(
              {
                amount: f.tx.amount,
                direction: f.tx.direction,
                payment_type: f.tx.payment_type,
                value_date: f.tx.value_date,
                clearing_delay_days: f.tx.clearing_delay_days,
                src: f.src,
                dst: f.dst,
              },
              remainingMs
            )
          }
        />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Tower marker — glowing core + pulsing ring + billboarded label
// ---------------------------------------------------------------------------
function TowerMarker({
  position,
  label,
  city,
}: {
  position: THREE.Vector3;
  label: string;
  city: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  // Per-frame: scale whole marker by camera distance so it stays constant in
  // pixel size on screen regardless of zoom. Same paradigm as Globe.gl / Cesium.
  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    const dist = camera.position.distanceTo(position);
    const scale = dist / 3.2; // 3.2 = initial camera distance from origin
    groupRef.current.scale.setScalar(scale);

    // Ring pulse in local frame
    if (ringRef.current) {
      const k = (Math.sin((performance.now() / 1000) * 1.8) + 1) / 2;
      const ringScale = 1 + k * 1.6;
      ringRef.current.scale.set(ringScale, ringScale, ringScale);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.6 * (1 - k);
    }
  });

  // orient the marker so its local +Y points outward (along surface normal)
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), position.clone().normalize());
    return q;
  }, [position]);

  return (
    <group ref={groupRef} position={position} quaternion={quaternion}>
      {/* glowing core */}
      <mesh>
        <sphereGeometry args={[0.018, 16, 16]} />
        <meshBasicMaterial color="#06b6d4" />
      </mesh>
      {/* halo */}
      <mesh>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.25} />
      </mesh>
      {/* pulsing ring on the tangent plane (perpendicular to outward normal) */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.022, 0.028, 48]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* label sprite via canvas texture */}
      <SpriteLabel label={label} city={city} />
    </group>
  );
}

function SpriteLabel({ label, city }: { label: string; city: string }) {
  const matRef = useRef<THREE.SpriteMaterial>(null);
  const spriteRef = useRef<THREE.Sprite>(null);

  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(11, 20, 38, 0.92)";
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 2;
    const r = 16;
    const w = canvas.width;
    const h = canvas.height;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#06b6d4";
    ctx.font = "700 56px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, w / 2, h / 2 - 18);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "400 32px Inter, sans-serif";
    ctx.fillText(city, w / 2, h / 2 + 36);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [label, city]);

  // Fade out when the tower is on the far side of the globe
  const spriteWorld = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    if (!matRef.current || !spriteRef.current) return;
    spriteRef.current.getWorldPosition(spriteWorld);
    const camDir = camera.position.clone().normalize();
    const dot = spriteWorld.clone().normalize().dot(camDir);
    // dot ≈ 1 facing camera, ≈ -1 on far side
    const opacity = THREE.MathUtils.clamp((dot + 0.1) * 2.5, 0, 1);
    matRef.current.opacity = opacity;
  });

  return (
    <sprite ref={spriteRef} position={[0, 0.08, 0]} scale={[0.24, 0.075, 1]}>
      <spriteMaterial ref={matRef} map={texture} transparent depthTest={false} />
    </sprite>
  );
}

// ---------------------------------------------------------------------------
// PlaneModel — low-poly plane built from primitives. Local frame:
//   nose at +X, wings span Z, up = +Y. Externally scaled by `size`.
// ---------------------------------------------------------------------------
function PlaneModel({ color, size }: { color: string; size: number }) {
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 }),
    [color]
  );
  return (
    <group scale={[size, size, size]}>
      {/* fuselage — cylinder lying along X */}
      <mesh material={mat} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.5, 0.5, 4, 12]} />
      </mesh>
      {/* nose cone */}
      <mesh material={mat} position={[2.4, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.5, 0.8, 12]} />
      </mesh>
      {/* main wings — thin box along Z */}
      <mesh material={mat} position={[0.2, 0, 0]}>
        <boxGeometry args={[1.4, 0.15, 5.5]} />
      </mesh>
      {/* horizontal stabilizer (rear small wings) */}
      <mesh material={mat} position={[-1.6, 0, 0]}>
        <boxGeometry args={[0.6, 0.1, 2.0]} />
      </mesh>
      {/* vertical stabilizer (tail fin) */}
      <mesh material={mat} position={[-1.6, 0.7, 0]}>
        <boxGeometry args={[0.6, 1.0, 0.1]} />
      </mesh>
      {/* cockpit hint — squashed sphere */}
      <mesh material={mat} position={[1.2, 0.35, 0]} scale={[0.8, 0.4, 0.4]}>
        <sphereGeometry args={[0.5, 12, 12]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Plane — animated wrapper that walks the arc and orients PlaneModel so its
// nose points along the direction of motion with wings parallel to the
// surface beneath it.
// ---------------------------------------------------------------------------
function Plane({
  samples,
  duration,
  phase,
  color,
  size,
  onSelect,
}: {
  samples: THREE.Vector3[];
  duration: number;
  phase: number;
  color: string;
  size: number;
  onSelect: (remainingMs: number) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const lastT = useRef(0);

  // reusable temp vectors so we don't allocate every frame
  const tmp = useMemo(
    () => ({
      forward: new THREE.Vector3(),
      up: new THREE.Vector3(),
      right: new THREE.Vector3(),
      orthoForward: new THREE.Vector3(),
      m: new THREE.Matrix4(),
    }),
    []
  );

  useFrame((state) => {
    if (!ref.current) return;
    if (hovered) return; // freeze while hovered so the plane is a stationary click target
    const elapsed = state.clock.elapsedTime + phase * duration;
    const t = (elapsed / duration) % 1;
    lastT.current = t;
    const idx = t * (samples.length - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(samples.length - 1, i0 + 1);
    const frac = idx - i0;

    // current position by lerping consecutive samples
    ref.current.position.copy(samples[i0]).lerp(samples[i1], frac);

    // orientation: forward = direction of motion, up = outward radial
    tmp.forward.copy(samples[i1]).sub(samples[i0]).normalize();
    tmp.up.copy(ref.current.position).normalize();
    tmp.right.crossVectors(tmp.forward, tmp.up).normalize();
    tmp.orthoForward.crossVectors(tmp.up, tmp.right).normalize();
    // Build a rotation that maps model-space (+X forward, +Y up, +Z right)
    // to (orthoForward, up, right) in world.
    tmp.m.makeBasis(tmp.orthoForward, tmp.up, tmp.right);
    ref.current.setRotationFromMatrix(tmp.m);
  });

  const worldScale = size * (hovered ? 1.4 : 1.0);

  return (
    <group
      ref={ref}
      onPointerEnter={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerLeave={() => {
        setHovered(false);
        document.body.style.cursor = "default";
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        const remainingMs = duration * (1 - lastT.current) * 1000;
        onSelect(remainingMs);
      }}
    >
      <PlaneModel color={color} size={worldScale} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------
export default function Globe3D({ transactions, onSelectPlane }: Globe3DProps) {
  const t = useT();
  return (
    <div className="relative w-full h-full">
      {/* radial glow background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(6,182,212,0.10) 0%, transparent 70%)",
        }}
      />
      <Canvas
        camera={{ position: [0, 0.4, 3.2], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 2, 5]} intensity={0.6} color="#dbeafe" />
        <pointLight position={[-4, -2, -3]} intensity={0.25} color="#06b6d4" />

        <Suspense fallback={null}>
          <World transactions={transactions} onSelectPlane={onSelectPlane} t={t} />
        </Suspense>

        <OrbitControls
          enableZoom
          enablePan={false}
          minDistance={1.6}
          maxDistance={5}
          zoomSpeed={0.6}
          rotateSpeed={0.6}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
}
