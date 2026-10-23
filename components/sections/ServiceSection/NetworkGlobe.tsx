"use client";

import { useEffect, useRef } from "react";
import styles from "./NetworkGlobe.module.css";

/*
 * Rotating wireframe globe, drawn without WebGL.
 *
 * The same geometry three.js used (icosahedron, detail 2) is projected with the
 * same camera (z = 6, 45° fov). The server renders it as a static SVG so the orb
 * is in the very first paint; on the client a 2D canvas takes over on its first
 * frame, at the identical starting pose, and keeps it turning while on screen.
 */

const RADIUS = 2.25;
const CAMERA_Z = 6;
const TAN_HALF_FOV = Math.SQRT2 - 1; // tan(22.5°), exact and identical on server and client
const SPIN_Y = 0.18; // rad/s
const SPIN_X = 0.07; // rad/s
const LINE_COLOR = "rgba(168, 85, 247, 0.5)";
const POINT_COLOR = "rgba(255, 255, 255, 0.55)";
const POINT_RADIUS = 0.8;

type Vec3 = [number, number, number];

const T = (1 + Math.sqrt(5)) / 2;
const ICO_VERTICES: Vec3[] = [
  [-1, T, 0], [1, T, 0], [-1, -T, 0], [1, -T, 0],
  [0, -1, T], [0, 1, T], [0, -1, -T], [0, 1, -T],
  [T, 0, -1], [T, 0, 1], [-T, 0, -1], [-T, 0, 1],
];
const ICO_FACES = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Subdivides like three's PolyhedronGeometry, then dedupes shared vertices and edges. */
function buildSphere(detail: number) {
  const vertices: Vec3[] = [];
  const index = new Map<string, number>();
  const edges = new Set<string>();

  const add = (v: Vec3) => {
    const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    const p: Vec3 = [(v[0] / length) * RADIUS, (v[1] / length) * RADIUS, (v[2] / length) * RADIUS];
    const key = p.map((n) => n.toFixed(5)).join();
    let i = index.get(key);
    if (i === undefined) {
      i = vertices.push(p) - 1;
      index.set(key, i);
    }
    return i;
  };
  const link = (a: number, b: number) => edges.add(a < b ? `${a}-${b}` : `${b}-${a}`);

  const cols = detail + 1;
  for (const [ia, ib, ic] of ICO_FACES) {
    const [a, b, c] = [ICO_VERTICES[ia], ICO_VERTICES[ib], ICO_VERTICES[ic]];
    const grid: number[][] = [];
    for (let i = 0; i <= cols; i++) {
      const aj = lerp(a, c, i / cols);
      const bj = lerp(b, c, i / cols);
      const rows = cols - i;
      grid[i] = [];
      for (let j = 0; j <= rows; j++) grid[i][j] = add(rows === 0 ? aj : lerp(aj, bj, j / rows));
    }
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < 2 * (cols - i) - 1; j++) {
        const k = Math.floor(j / 2);
        const tri = j % 2 === 0
          ? [grid[i][k + 1], grid[i + 1][k], grid[i][k]]
          : [grid[i][k + 1], grid[i + 1][k + 1], grid[i + 1][k]];
        link(tri[0], tri[1]);
        link(tri[1], tri[2]);
        link(tri[2], tri[0]);
      }
    }
  }

  return {
    vertices,
    edges: Array.from(edges, (e) => e.split("-").map(Number) as [number, number]),
  };
}

const MESH = buildSphere(2);
const POINTS = buildSphere(1).vertices;

/** Euler XYZ rotation (three's default) then perspective; returns coordinates in [-1, 1], y down. */
function project(v: Vec3, cosX: number, sinX: number, cosY: number, sinY: number): [number, number] {
  const x1 = v[0] * cosY + v[2] * sinY;
  const z1 = -v[0] * sinY + v[2] * cosY;
  const y2 = v[1] * cosX - z1 * sinX;
  const z2 = v[1] * sinX + z1 * cosX;
  const scale = 1 / ((CAMERA_Z - z2) * TAN_HALF_FOV);
  return [x1 * scale, -y2 * scale];
}

// Starting pose (no rotation), as SVG path data in a 200×200 box. Only exact
// arithmetic is used, so server and client produce the same string.
const POSTER = (() => {
  const at = (v: Vec3) => project(v, 1, 0, 1, 0).map((n) => (100 + n * 100).toFixed(1)).join(" ");
  const shown = MESH.vertices.map(at);
  return {
    lines: MESH.edges.map(([a, b]) => `M${shown[a]}L${shown[b]}`).join(""),
    points: POINTS.map((v) => `M${at(v)}h0`).join(""),
  };
})();

export default function NetworkGlobe() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    // Reduced motion keeps the static poster.
    if (!root || !canvas || !ctx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let width = 0;
    let height = 0;
    let rotX = 0;
    let rotY = 0;
    let last = 0;
    let frame = 0;
    let onScreen = false;

    const draw = () => {
      if (!width || !height) return;
      const half = Math.min(width, height) / 2;
      const cx = width / 2;
      const cy = height / 2;
      const [cosX, sinX, cosY, sinY] = [Math.cos(rotX), Math.sin(rotX), Math.cos(rotY), Math.sin(rotY)];
      const shown = MESH.vertices.map((v) => project(v, cosX, sinX, cosY, sinY));

      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      for (const [a, b] of MESH.edges) {
        ctx.moveTo(cx + shown[a][0] * half, cy + shown[a][1] * half);
        ctx.lineTo(cx + shown[b][0] * half, cy + shown[b][1] * half);
      }
      ctx.strokeStyle = LINE_COLOR;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      for (const v of POINTS) {
        const [x, y] = project(v, cosX, sinX, cosY, sinY);
        ctx.moveTo(cx + x * half + POINT_RADIUS, cy + y * half);
        ctx.arc(cx + x * half, cy + y * half, POINT_RADIUS, 0, Math.PI * 2);
      }
      ctx.fillStyle = POINT_COLOR;
      ctx.fill();

      // Canvas now matches the poster pixel-for-pixel; swap without a flash.
      root.dataset.live = "true";
    };

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      rotY += dt * SPIN_Y;
      rotX += dt * SPIN_X;
      draw();
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (frame || !onScreen) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(canvas);
    // Only spin while visible; hidden instances (e.g. the desktop orb on phones) never start.
    const viewObserver = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) start();
      else stop();
    });
    viewObserver.observe(canvas);

    return () => {
      stop();
      sizeObserver.disconnect();
      viewObserver.disconnect();
      delete root.dataset.live;
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.globe} aria-hidden="true">
      <svg className={styles.poster} viewBox="0 0 200 200" focusable="false">
        <path d={POSTER.lines} fill="none" stroke={LINE_COLOR} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <path
          d={POSTER.points}
          fill="none"
          stroke={POINT_COLOR}
          strokeWidth={POINT_RADIUS * 2}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
