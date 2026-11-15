"use client";

/*
 * Zarman silk wave: a diagonal band of fine, silk-like strands that drifts slowly
 * behind the auth cards. Drawn by our own WebGL2 fragment shader (no third-party
 * gradient code). Falls back to a static CSS band when WebGL2 is unavailable, and
 * renders a single still frame for users who prefer reduced motion.
 */

import React, { useEffect, useRef, useState } from "react";

// Palette stops, cool -> warm (cyan, indigo, violet, fuchsia, rose).
const PALETTE = ["#7dd3fc", "#06b6d4", "#4f46e5", "#8b5cf6", "#c026d3", "#fda4af"];

const VERTEX_SHADER = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uC[6];

float h1(float n) { return fract(sin(n * 127.1 + 31.7) * 43758.5453); }
float vn(float x) {
  float i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(h1(i), h1(i + 1.0), f);
}
// Multi-scale 1D noise: reads as combed fibres across the band.
float strands(float x) {
  return 0.42 * vn(x * 38.0) + 0.30 * vn(x * 96.0 + 3.0) + 0.18 * vn(x * 240.0 + 7.0) + 0.10 * vn(x * 620.0 + 11.0);
}
vec3 pal(float t) {
  t = clamp(t, 0.0, 1.0) * 5.0;
  float f = fract(t);
  f = f * f * (3.0 - 2.0 * f);
  int i = int(floor(t));
  vec3 a = uC[0], b = uC[1];
  if (i == 1) { a = uC[1]; b = uC[2]; }
  else if (i == 2) { a = uC[2]; b = uC[3]; }
  else if (i == 3) { a = uC[3]; b = uC[4]; }
  else if (i >= 4) { a = uC[4]; b = uC[5]; }
  return mix(a, b, f);
}
// One translucent sheet of strands; returns premultiplied colour.
vec4 sheet(vec2 p, float l0, float l1, float l2, float w0, float w1, float c0, float c1,
           float fib, float ph, float alpha, float soft) {
  float y = p.y;
  float sway = 0.018 * sin(uTime * 0.21 + ph) + 0.012 * sin(uTime * 0.13 + ph * 2.0 + y * 2.0);
  float xl = l0 + l1 * y + l2 * y * y + sway;
  float w = mix(w0, w1, pow(clamp(y, 0.0, 1.0), 0.85));
  float t = (p.x - xl) / w;
  float px = 1.5 / uRes.x / w;
  float tw = t + 0.035 * sin(y * 4.2 + ph + uTime * 0.09) + 0.012 * sin(y * 11.0 + ph * 2.3 + t * 5.0);
  float s = strands(tw + ph * 3.0);
  float s2 = strands(tw * 2.3 + ph * 7.0 + 4.0);
  float fold = 0.5 + 0.5 * cos(t * 7.2 + ph + y * 1.7 + uTime * 0.17);
  float fold2 = 0.5 + 0.5 * cos(t * 17.0 - ph * 1.3 + y * 3.1 - uTime * 0.11);
  vec3 col = pal(mix(c0, c1, clamp(t, 0.0, 1.0)) + 0.05 * (s - 0.5) + 0.04 * (fold - 0.5));
  col *= 1.0 + fib * (s - 0.5) * 0.55;
  col = mix(col, vec3(1.0), fib * 0.5 * pow(s2, 5.0) + 0.16 * pow(fold, 6.0) + 0.07 * pow(fold2, 10.0));
  col = mix(col, col * col * 1.05, 0.22 * (1.0 - fold) * fib);
  float edge = exp(-max(t, 0.0) * w * uRes.x / 2.2);
  col = mix(col, vec3(1.0), 0.55 * edge);
  float a = smoothstep(0.0, px, t) * (1.0 - smoothstep(1.0 - soft, 1.0, t)) * alpha;
  return vec4(col * a, a);
}
vec4 over(vec4 d, vec4 s) { return s + d * (1.0 - s.a); }

void main() {
  vec2 p = gl_FragCoord.xy / uRes;
  p.y = 1.0 - p.y;
  float aspect = uRes.y / uRes.x;
  // Keep the sweep's angle sensible from wide desktops to tall phones.
  float k = clamp(aspect, 1.0, 2.2);
  vec2 q = vec2(p.x - (aspect < 1.0 ? 0.24 : 0.08), p.y / k);
  vec4 c = vec4(0.0);
  c = over(c, sheet(q, 0.16, 0.50, 0.26, 0.62, 0.30, 0.00, 0.62, 0.55, 0.3, 0.96, 0.02));
  c = over(c, sheet(q, 0.30, 0.52, 0.22, 0.50, 0.26, 0.28, 0.74, 0.70, 1.7, 0.78, 0.25));
  c = over(c, sheet(q, 0.50, 0.62, 0.34, 0.70, 0.70, 0.62, 1.00, 1.00, 2.9, 0.97, 0.02));
  c = over(c, sheet(q, 0.70, 0.66, 0.42, 0.34, 0.10, 0.80, 1.00, 1.00, 4.4, 0.55, 0.50));
  o = c;
}`;

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export default function AuthGradient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false, alpha: true });
    if (!gl) {
      setFallback(true);
      return;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!vs || !fs || !program) {
      setFallback(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setFallback(true);
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "uRes");
    const uTime = gl.getUniformLocation(program, "uTime");
    gl.uniform3fv(gl.getUniformLocation(program, "uC"), new Float32Array(PALETTE.flatMap(hexToRgb)));
    gl.clearColor(0, 0, 0, 0);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let running = true;
    const start = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    };

    const draw = (now: number) => {
      gl.uniform1f(uTime, reduceMotion ? 0 : (now - start) / 1000);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const loop = (now: number) => {
      if (!running) return;
      draw(now);
      frame = requestAnimationFrame(loop);
    };

    const observer = new ResizeObserver(() => {
      resize();
      if (reduceMotion) draw(start);
    });
    observer.observe(canvas);
    resize();

    const onVisibility = () => {
      if (reduceMotion) return;
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!running) {
        running = true;
        frame = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (reduceMotion) draw(start);
    else frame = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  if (fallback) {
    return (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `linear-gradient(115deg, transparent 38%, ${PALETTE[0]}cc 46%, ${PALETTE[2]}cc 56%, ${PALETTE[4]}cc 68%, ${PALETTE[5]}cc 78%, transparent 86%)`,
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
    />
  );
}
