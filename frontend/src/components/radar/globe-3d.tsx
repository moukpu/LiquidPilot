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
function planeColorHex(amount: number): string {
  if (amount < 50000) return "#22c55e";
  if (amount < 500000) return "#eab308";
  return "#ef4444";
}

function planeSize(amount: number): number {
  if (amount < 50000) return 0.008;
  if (amount < 500000) return 0.012;
  return 0.018;
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
// Plane — canvas-texture sprite of the Lucide Plane icon, scaled by amount,
// rotated in screen-space to match the flight direction along the arc.
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
  const ref = useRef<THREE.Sprite>(null);

  // canvas-rendered Lucide Plane icon, tinted to `color`
  const planeTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.translate(64, 64);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Stylised Lucide Plane silhouette, centred on origin (~96×96 box)
    const path = new Path2D(
      "M-22 -8 L22 6 L22 -2 L34 4 L34 -6 L22 -14 L22 -22 L14 -22 L8 -10 L-12 -22 L-22 -22 L-12 -8 Z"
    );
    ctx.fill(path);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [color]);

  useFrame((state) => {
    if (!ref.current) return;
    const elapsed = state.clock.elapsedTime + phase * duration;
    const t = (elapsed / duration) % 1;
    const idx = t * (samples.length - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(samples.length - 1, i0 + 1);
    const frac = idx - i0;
    const p = samples[i0].clone().lerp(samples[i1], frac);
    ref.current.position.copy(p);

    // screen-space rotation: project current + next sample to NDC, take atan2
    const next = samples[i1].clone();
    const cam = state.camera;
    const pNDC = p.clone().project(cam);
    const nNDC = next.project(cam);
    const dx = nNDC.x - pNDC.x;
    const dy = nNDC.y - pNDC.y;
    const angle = Math.atan2(dy, dx);
    // Plane icon's "forward" is up-and-right; -PI/4 corrects to horizontal-right
    (ref.current.material as THREE.SpriteMaterial).rotation = angle - Math.PI / 4;
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

  const s = size * 4 * (hovered ? 1.4 : 1);

  return (
    <sprite
      ref={ref}
      scale={[s, s, 1]}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <spriteMaterial map={planeTexture} transparent depthWrite={false} />
    </sprite>
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
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 2, 5]} intensity={0.6} color="#dbeafe" />
        <pointLight position={[-4, -2, -3]} intensity={0.25} color="#06b6d4" />

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
