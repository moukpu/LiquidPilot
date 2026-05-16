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
];

const GLOBE_RADIUS = 1;
const ARC_LIFT = 0.32; // peak altitude above surface
const PLANE_COUNT = 28;
const BORDER_LIFT = 1.003; // sit borders just above surface to avoid z-fight
const GRID_LIFT = 1.001;

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
function planeColorHex(amount: number): string {
  if (amount < 50000) return "#22c55e";
  if (amount < 500000) return "#eab308";
  return "#ef4444";
}

function planeSize(amount: number): number {
  if (amount < 50000) return 0.024;
  if (amount < 500000) return 0.034;
  return 0.046;
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
  onHoverPlane: (data: TooltipData | null) => void;
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
      {/* ocean sphere — lighter blue */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 0.995, 96, 96]} />
        <meshStandardMaterial
          color="#1f3a64"
          roughness={0.85}
          metalness={0}
          emissive="#142a4a"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* lat/lon wireframe grid (subtle) */}
      <lineSegments geometry={gridGeometry}>
        <lineBasicMaterial color="#3b5e8f" transparent opacity={0.35} />
      </lineSegments>

      {/* country borders (real natural-earth 110m via world-atlas) */}
      <lineSegments geometry={borderGeometry}>
        <lineBasicMaterial color="#8ab4e8" transparent opacity={0.9} />
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
  onHoverPlane,
  t,
}: {
  transactions: Transaction[];
  onHoverPlane: (d: TooltipData | null) => void;
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
      const duration = 5 + (hash % 3); // seconds for a full traversal
      const phase = (hash % 1000) / 1000; // 0..1
      return {
        tx,
        src: src.id,
        dst: dst.id,
        samples,
        duration,
        phase,
        color: planeColorHex(tx.amount),
        size: planeSize(tx.amount),
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
          onEnter={() =>
            onHoverPlane({
              amount: f.tx.amount,
              direction: f.tx.direction,
              payment_type: f.tx.payment_type,
              value_date: f.tx.value_date,
              clearing_delay_days: f.tx.clearing_delay_days,
              src: f.src,
              dst: f.dst,
            })
          }
          onLeave={() => onHoverPlane(null)}
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
  // ring pulses by scale
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ringRef.current) return;
    const k = (Math.sin(state.clock.elapsedTime * 1.8) + 1) / 2; // 0..1
    const scale = 1 + k * 1.6;
    ringRef.current.scale.set(scale, scale, scale);
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.6 * (1 - k);
  });

  // orient the marker so its local +Y points outward (along surface normal)
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), position.clone().normalize());
    return q;
  }, [position]);

  return (
    <group position={position} quaternion={quaternion}>
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

  return (
    <sprite position={[0, 0.08, 0]} scale={[0.24, 0.075, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

// ---------------------------------------------------------------------------
// Plane — actual dart-shape mesh (cone body + wings + tail), oriented along
// the velocity vector with +Y aligned to the surface normal.
// ---------------------------------------------------------------------------
function Plane({
  samples,
  duration,
  phase,
  color,
  size,
  onEnter,
  onLeave,
}: {
  samples: THREE.Vector3[];
  duration: number;
  phase: number;
  color: string;
  size: number;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const planeRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  // scratch vectors / matrix
  const tmpForward = useMemo(() => new THREE.Vector3(), []);
  const tmpRight = useMemo(() => new THREE.Vector3(), []);
  const tmpUp = useMemo(() => new THREE.Vector3(), []);
  const tmpMat = useMemo(() => new THREE.Matrix4(), []);

  useFrame((state) => {
    if (!planeRef.current) return;
    const elapsed = state.clock.elapsedTime + phase * duration;
    const t = (elapsed / duration) % 1;
    const idx = t * (samples.length - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(samples.length - 1, i0 + 1);
    const i2 = Math.min(samples.length - 1, i0 + 2);
    const frac = idx - i0;
    const p = samples[i0].clone().lerp(samples[i1], frac);

    // basis: forward = velocity, up = outward radial, right = up × forward
    tmpForward.copy(samples[i2]).sub(samples[i1]);
    if (tmpForward.lengthSq() < 1e-8) tmpForward.set(0, 0, 1);
    tmpForward.normalize();
    tmpUp.copy(p).normalize();
    tmpRight.crossVectors(tmpUp, tmpForward).normalize();
    tmpForward.crossVectors(tmpRight, tmpUp).normalize();

    tmpMat.makeBasis(tmpRight, tmpUp, tmpForward);
    planeRef.current.position.copy(p);
    planeRef.current.quaternion.setFromRotationMatrix(tmpMat);

    if (haloRef.current) haloRef.current.position.copy(p);
  });

  const [hovered, setHovered] = useState(false);

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    onEnter();
    document.body.style.cursor = "pointer";
  };
  const handlePointerOut = () => {
    setHovered(false);
    onLeave();
    document.body.style.cursor = "default";
  };

  const scale = hovered ? 1.5 : 1;

  return (
    <group>
      {/* soft halo */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[size * 1.8, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} />
      </mesh>

      {/* plane: body + wings + tail */}
      <group
        ref={planeRef}
        scale={scale}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        {/* body: cone with apex pointing forward (+Z) */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[size * 0.85, size * 3, 12]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.9}
            roughness={0.4}
            metalness={0.1}
          />
        </mesh>
        {/* wings: thin flat box along X */}
        <mesh position={[0, 0, -size * 0.3]}>
          <boxGeometry args={[size * 3.4, size * 0.12, size * 0.7]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.9}
            roughness={0.4}
            metalness={0.1}
          />
        </mesh>
        {/* tail fin: vertical at the back */}
        <mesh position={[0, size * 0.35, -size * 1.1]}>
          <boxGeometry args={[size * 0.12, size * 0.7, size * 0.5]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.9}
            roughness={0.4}
            metalness={0.1}
          />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------
export default function Globe3D({ transactions, onHoverPlane }: Globe3DProps) {
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
        <ambientLight intensity={0.95} />
        <directionalLight position={[3, 2, 5]} intensity={1.1} color="#e6f1ff" />
        <directionalLight position={[-3, -1, -4]} intensity={0.5} color="#bfe7ff" />
        <pointLight position={[-4, -2, -3]} intensity={0.4} color="#06b6d4" />

        <Suspense fallback={null}>
          <World transactions={transactions} onHoverPlane={onHoverPlane} t={t} />
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
