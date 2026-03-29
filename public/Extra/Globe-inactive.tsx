"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";

/* =========================================================
   Utilities
   ========================================================= */

function canUseWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    const gl =
      c.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ||
      c.getContext("webgl", { failIfMajorPerformanceCaveat: true }) ||
      c.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

function isProbablyMobile(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const coarse =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  return coarse || /Android|iPhone|iPad|iPod/i.test(ua);
}

function deviceScore() {
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
  const mem = (navigator as any).deviceMemory || 4;
  const mobile = isProbablyMobile();
  return (mobile ? 0.85 : 1.0) * (cores / 4) * (mem / 4);
}

function latLonToVec3(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

function makeArcCurve(a: THREE.Vector3, b: THREE.Vector3, altitude = 0.22) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const midLen = mid.length();
  const control = mid.normalize().multiplyScalar(midLen * (1 + altitude));
  return new THREE.QuadraticBezierCurve3(a, control, b);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/* =========================================================
   Land mask sampling (robust + downscale)
   White = land, Black = ocean (default)
   ========================================================= */

type MaskSampleConfig = {
  url: string;
  // mask interpret
  threshold: number; // 0..255
  invert: boolean;
  // downscale resolution for sampling
  sampleW: number;
  sampleH: number;
};

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function buildLandIndexFromImage(img: HTMLImageElement, cfg: MaskSampleConfig) {
  const { threshold, invert, sampleW, sampleH } = cfg;

  // Downscale to a stable sampling grid (important)
  const c = document.createElement("canvas");
  c.width = sampleW;
  c.height = sampleH;

  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { w: sampleW, h: sampleH, land: new Uint32Array(0) };

  // draw downscaled
  ctx.drawImage(img, 0, 0, sampleW, sampleH);
  const data = ctx.getImageData(0, 0, sampleW, sampleH).data;

  const landPixels: number[] = [];
  landPixels.length = 0;

  for (let y = 0; y < sampleH; y++) {
    for (let x = 0; x < sampleW; x++) {
      const i = (y * sampleW + x) * 4;
      const r = data[i + 0];
      const g = data[i + 1];
      const b = data[i + 2];

      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const isLand = invert ? lum <= threshold : lum >= threshold;

      if (isLand) landPixels.push(y * sampleW + x);
    }
  }

  return { w: sampleW, h: sampleH, land: new Uint32Array(landPixels) };
}

function sampleDotsFromLandIndex(args: {
  w: number;
  h: number;
  land: Uint32Array;
  count: number;
  radius: number;
  surfaceOffset: number;
}) {
  const { w, h, land, count, radius, surfaceOffset } = args;
  if (!land || land.length === 0 || count <= 0) return new Float32Array(0);

  // Stratified distribution improves "global" coverage
  const grid = Math.max(24, Math.round(Math.sqrt(count)));
  const cells = grid * grid;

  const buckets: number[][] = Array.from({ length: cells }, () => []);

  for (let i = 0; i < land.length; i++) {
    const p = land[i];
    const y = Math.floor(p / w);
    const x = p - y * w;
    const cx = Math.min(grid - 1, Math.floor((x / w) * grid));
    const cy = Math.min(grid - 1, Math.floor((y / h) * grid));
    buckets[cy * grid + cx].push(p);
  }

  const out = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const cell = i % cells;
    const bucket = buckets[cell];

    const packed =
      bucket && bucket.length > 0
        ? bucket[(Math.random() * bucket.length) | 0]
        : land[(Math.random() * land.length) | 0];

    const py = Math.floor(packed / w);
    const px = packed - py * w;

    // add sub-pixel jitter to avoid a pixel-grid look
    const jx = (Math.random() - 0.5) * 0.9;
    const jy = (Math.random() - 0.5) * 0.9;

    const u = (px + 0.5 + jx) / w; // 0..1
    const v = (py + 0.5 + jy) / h; // 0..1

    const lon = u * 360 - 180;
    const lat = 90 - v * 180;

    const p3 = latLonToVec3(lat, lon, radius + surfaceOffset);

    out[i * 3 + 0] = p3.x;
    out[i * 3 + 1] = p3.y;
    out[i * 3 + 2] = p3.z;
  }

  return out;
}

/* =========================================================
   Moving pulse on arcs
   ========================================================= */

function TravelingDot({
  curve,
  speed = 0.16,
  offset = 0,
  size = 0.014,
  color = "#e7ecff",
  opacity = 0.95,
}: {
  curve: THREE.Curve<THREE.Vector3>;
  speed?: number;
  offset?: number;
  size?: number;
  color?: string;
  opacity?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * speed + offset) % 1;
    const p = curve.getPoint(t);
    if (ref.current) ref.current.position.copy(p);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[size, 14, 14]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        depthTest={true}
      />
    </mesh>
  );
}

/* =========================================================
   Scene
   ========================================================= */

type GlobeSceneProps = {
  quality: "low" | "high";
  onContextLost: () => void;
  landMaskUrl: string;
  invertMask?: boolean;
  landThreshold?: number;
};

function GlobeScene({
  quality,
  onContextLost,
  landMaskUrl,
  invertMask = false,
  landThreshold = 140,
}: GlobeSceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { gl } = useThree();

  // WebGL context lost handler
  useEffect(() => {
    const canvas = gl.domElement;
    if (!canvas) return;

    const handleLost = (e: Event) => {
      e.preventDefault?.();
      onContextLost();
    };

    canvas.addEventListener("webglcontextlost", handleLost as any, false);
    return () => canvas.removeEventListener("webglcontextlost", handleLost as any, false);
  }, [gl, onContextLost]);

  const radius = 1.05;

  // Load + index land mask ONCE (async), then sample dots from it
  const [landIndex, setLandIndex] = useState<{
    w: number;
    h: number;
    land: Uint32Array;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const img = await loadImage(landMaskUrl);

        // sampling grid: stable equirectangular
        const cfg: MaskSampleConfig = {
          url: landMaskUrl,
          threshold: landThreshold,
          invert: invertMask,
          sampleW: 1024,
          sampleH: 512,
        };

        const idx = buildLandIndexFromImage(img, cfg);

        if (!cancelled) setLandIndex(idx);
      } catch {
        if (!cancelled) setLandIndex(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [landMaskUrl, invertMask, landThreshold]);

  const { dotPositions, dotSize, arcs } = useMemo(() => {
    const high = quality === "high";

    const dotsTarget = high ? 14000 : 5200;
    const size = high ? 0.0095 : 0.0115;

    // hubs
    const TEHRAN = { lat: 35.6892, lon: 51.3890 };
    const SYDNEY = { lat: -33.8688, lon: 151.2093 };
    const DUBAI = { lat: 25.2048, lon: 55.2708 };
    const ISTANBUL = { lat: 41.0082, lon: 28.9784 };
    const SINGAPORE = { lat: 1.3521, lon: 103.8198 };

    const hubs = [TEHRAN, SYDNEY, DUBAI, ISTANBUL, SINGAPORE].map((h) =>
      latLonToVec3(h.lat, h.lon, radius + 0.01)
    );

    const arcPairs: Array<[number, number]> = [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 4],
      [2, 4],
    ];

    const arcCurves = arcPairs.map(([ia, ib]) =>
      makeArcCurve(hubs[ia], hubs[ib], high ? 0.26 : 0.21)
    );

    // dots
    if (!landIndex || !landIndex.land || landIndex.land.length === 0) {
      return {
        dotPositions: new Float32Array(0),
        dotSize: size,
        arcs: { hubs, arcCurves },
      };
    }

    const dots = sampleDotsFromLandIndex({
      w: landIndex.w,
      h: landIndex.h,
      land: landIndex.land,
      count: dotsTarget,
      radius,
      surfaceOffset: 0.003,
    });

    return {
      dotPositions: dots,
      dotSize: size,
      arcs: { hubs, arcCurves },
    };
  }, [quality, landIndex]);

  // autoRotate
  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;

    const speed = 0.12;
    g.rotation.y += delta * speed;
    g.rotation.z = Math.sin(state.clock.elapsedTime * 0.25) * 0.015;
  });

  return (
    <group ref={groupRef}>
      {/* Earth core */}
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial
          color="#0b1220"
          metalness={0.22}
          roughness={0.72}
          emissive="#0b1b3a"
          emissiveIntensity={0.22}
        />
      </mesh>

      {/* Atmosphere / glow */}
      <mesh>
        <sphereGeometry args={[radius * 1.03, 64, 64]} />
        <meshBasicMaterial
          color="#8aa1ff"
          transparent
          opacity={0.075}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[radius * 1.055, 64, 64]} />
        <meshBasicMaterial
          color="#7c5cff"
          transparent
          opacity={0.10}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Land dots */}
      <points frustumCulled>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dotPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#c7d0ff"
          size={dotSize}
          sizeAttenuation
          transparent
          opacity={0.72}
          depthWrite={false}
          depthTest={true}   // مهم: این باعث می‌شود قاره‌ها به هم نریزند
        />
      </points>

      {/* Hubs */}
      {arcs.hubs.map((p, idx) => (
        <mesh key={idx} position={p}>
          <sphereGeometry args={[0.018, 16, 16]} />
          <meshBasicMaterial
            color="#e7ecff"
            transparent
            opacity={0.95}
            depthWrite={false}
            depthTest={true}
          />
        </mesh>
      ))}

      {/* Arcs: double-pass + pulses */}
      {arcs.arcCurves.map((curve, idx) => {
        const pts = curve.getPoints(96);
        const positions = new Float32Array(pts.length * 3);
        for (let i = 0; i < pts.length; i++) {
          positions[i * 3 + 0] = pts[i].x;
          positions[i * 3 + 1] = pts[i].y;
          positions[i * 3 + 2] = pts[i].z;
        }

        return (
          <group key={idx}>
            <line>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
              </bufferGeometry>
              <lineBasicMaterial color="#7c5cff" transparent opacity={0.22} />
            </line>

            <line>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
              </bufferGeometry>
              <lineBasicMaterial color="#b9c2ff" transparent opacity={0.60} />
            </line>

            <TravelingDot curve={curve} speed={0.16} offset={idx * 0.19} size={0.014} opacity={0.95} />
            <TravelingDot curve={curve} speed={0.16} offset={idx * 0.19 + 0.48} size={0.010} opacity={0.55} />
          </group>
        );
      })}

      {/* lights */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 2, 4]} intensity={1.25} />
      <pointLight position={[-4, -2, -3]} intensity={0.65} />

      <Environment preset="city" />
    </group>
  );
}

/* =========================================================
   Public Component
   ========================================================= */

type GlobeLiteProps = {
  className?: string;
  height?: number;
};

export default function GlobeLite({ className, height = 360 }: GlobeLiteProps) {
  const [supported, setSupported] = useState(false);
  const [lost, setLost] = useState(false);
  const [quality, setQuality] = useState<"low" | "high">("low");
  const [dpr, setDpr] = useState<number>(1);

  useEffect(() => {
    const ok = canUseWebGL();
    setSupported(ok);

    const score = deviceScore();
    const high = ok && score >= 1.15; // کمی راحت‌تر
    setQuality(high ? "high" : "low");

    const raw = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const clamped = high ? clamp(raw, 1, 2) : 1;
    setDpr(clamped);
  }, []);

  if (!supported || lost) {
    return (
      <div
        className={className}
        style={{
          height,
          width: "100%",
          borderRadius: 28,
          background:
            "radial-gradient(120% 120% at 30% 20%, rgba(124,92,255,0.18) 0%, rgba(15,23,42,0.06) 45%, rgba(255,255,255,1) 100%)",
          border: "1px solid rgba(124,92,255,0.12)",
          boxShadow: "0 24px 60px -30px rgba(124,92,255,0.25)",
          display: "grid",
          placeItems: "center",
          color: "#0f172a",
          overflow: "hidden",
        }}
        aria-label="Globe fallback"
      >
        <div style={{ textAlign: "center", padding: 18, maxWidth: 380 }}>
          <div style={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
            نمایش سه‌بعدی در این دستگاه در دسترس نیست
          </div>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75, lineHeight: 1.6 }}>
            برای پایداری تجربه کاربری، نسخه سبک نمایش داده شد.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ height, width: "100%", position: "relative" }}>
      <Canvas
        dpr={dpr}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: false,
        }}
        camera={{ position: [0, 0, 2.65], fov: 45, near: 0.1, far: 100 }}
        onCreated={({ gl }) => {
          if (!gl?.getContext?.()) setLost(true);
        }}
      >
        <React.Suspense fallback={null}>
          <GlobeScene
            quality={quality}
            onContextLost={() => setLost(true)}
            landMaskUrl="/images/earth-landmask.png"
            invertMask={false}     // اگر برعکس شد true
            landThreshold={140}    // اگر خشکی کم/زیاد شد: 120..170
          />
        </React.Suspense>
      </Canvas>
    </div>
  );
}
