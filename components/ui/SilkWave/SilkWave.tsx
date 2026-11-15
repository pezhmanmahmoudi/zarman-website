"use client";

/*
 * Zarman silk wave: a diagonal band of fine, silk-like strands that flows,
 * ripples and catches light. Drawn by our own WebGL2 fragment shader (no
 * third-party gradient code).
 *
 * - `mirror` flips the sweep horizontally (used for RTL layouts).
 * - Renders one still frame when the user prefers reduced motion.
 * - Pauses while the tab is hidden or the canvas is off-screen.
 * - Falls back to a static CSS band when WebGL2 is unavailable.
 */

import React, { useEffect, useRef, useState } from "react";

// Palette stops, cool -> warm.
export const SILK_PALETTE = ["#7dd3fc", "#06b6d4", "#4f46e5", "#8b5cf6", "#c026d3", "#fda4af"];

const VERTEX_SHADER = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uRes;
uniform float uTime;
uniform float uMirror;
uniform vec2 uFrame;   // x offset of the sweep, vertical stretch
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
// spd: how fast this sheet moves; amp: how far it ripples sideways.
vec4 sheet(vec2 p, float l0, float l1, float l2, float w0, float w1, float c0, float c1,
           float fib, float ph, float alpha, float soft, float spd, float amp) {
  float T = uTime * spd;
  float y = p.y;

  // Travelling ripples along the band: the whole sheet undulates like cloth.
  float sway = amp * (0.050 * sin(y * 2.3 - T * 0.62 + ph)
                    + 0.028 * sin(y * 5.4 + T * 0.93 + ph * 1.7)
                    + 0.012 * sin(y * 11.0 - T * 1.40 + ph * 3.1));
  float xl = l0 + l1 * y + l2 * y * y + sway;

  // The band breathes: its width pinches and swells as waves pass.
  float w = mix(w0, w1, pow(clamp(y, 0.0, 1.0), 0.85));
  w *= 1.0 + 0.10 * amp * sin(y * 3.1 - T * 0.55 + ph * 2.0);

  float t = (p.x - xl) / w;
  float px = 1.5 / uRes.x / w;

  // Fibres flow along the band and bend with the ripples.
  float tw = t + 0.040 * sin(y * 4.2 + ph - T * 0.45)
               + 0.016 * sin(y * 11.0 + ph * 2.3 + t * 5.0 + T * 0.7)
               + 0.008 * sin(y * 23.0 - T * 1.3 + t * 9.0);
  float s = strands(tw + ph * 3.0);
  float s2 = strands(tw * 2.3 + ph * 7.0 + 4.0);

  // Satin folds that roll across the band.
  float fold = 0.5 + 0.5 * cos(t * 7.2 + ph + y * 1.7 - T * 1.05);
  float fold2 = 0.5 + 0.5 * cos(t * 17.0 - ph * 1.3 + y * 3.1 + T * 0.80);

  // Colour drifts slowly along the band so the hues travel.
  float hueShift = 0.06 * sin(y * 1.6 - T * 0.35 + ph);
  vec3 col = pal(mix(c0, c1, clamp(t, 0.0, 1.0)) + hueShift + 0.05 * (s - 0.5) + 0.04 * (fold - 0.5));
  col *= 1.0 + fib * (s - 0.5) * 0.6;
  col = mix(col, vec3(1.0), fib * 0.5 * pow(s2, 5.0) + 0.18 * pow(fold, 6.0) + 0.08 * pow(fold2, 10.0));
  col = mix(col, col * col * 1.05, 0.24 * (1.0 - fold) * fib);

  // A glint of light that slides down the band.
  float gy = fract(T * 0.07 + ph * 0.13) * 1.8 - 0.4;
  float glint = exp(-pow((y - gy) * 3.2, 2.0)) * pow(fold, 3.0);
  col = mix(col, vec3(1.0), 0.32 * glint);

  // Bright, crisp leading edge.
  float edge = exp(-max(t, 0.0) * w * uRes.x / 2.2);
  col = mix(col, vec3(1.0), 0.55 * edge);

  float a = smoothstep(0.0, px, t) * (1.0 - smoothstep(1.0 - soft, 1.0, t)) * alpha;
  return vec4(col * a, a);
}
vec4 over(vec4 d, vec4 s) { return s + d * (1.0 - s.a); }

void main() {
  vec2 p = gl_FragCoord.xy / uRes;
  p.y = 1.0 - p.y;
  if (uMirror > 0.5) p.x = 1.0 - p.x;
  vec2 q = vec2(p.x - uFrame.x, p.y / uFrame.y);
  vec4 c = vec4(0.0);
  c = over(c, sheet(q, 0.16, 0.50, 0.26, 0.62, 0.30, 0.00, 0.62, 0.55, 0.3, 0.96, 0.02, 0.85, 0.7));
  c = over(c, sheet(q, 0.30, 0.52, 0.22, 0.50, 0.26, 0.28, 0.74, 0.70, 1.7, 0.78, 0.25, 1.15, 0.9));
  c = over(c, sheet(q, 0.50, 0.62, 0.34, 0.70, 0.70, 0.62, 1.00, 1.00, 2.9, 0.97, 0.02, 1.00, 0.8));
  c = over(c, sheet(q, 0.70, 0.66, 0.42, 0.34, 0.10, 0.80, 1.00, 1.00, 4.4, 0.55, 0.50, 1.35, 1.1));
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

type SilkWaveProps = {
  /** Flip the sweep horizontally (for RTL layouts). */
  mirror?: boolean;
  /** Six colour stops, cool -> warm. */
  palette?: string[];
  /** Overall animation speed multiplier. */
  speed?: number;
  className?: string;
  style?: React.CSSProperties;
};

export default function SilkWave({ mirror = false, palette = SILK_PALETTE, speed = 1.6, className, style }: SilkWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);
  const paletteKey = palette.join(",");

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
    const uFrame = gl.getUniformLocation(program, "uFrame");
    gl.uniform1f(gl.getUniformLocation(program, "uMirror"), mirror ? 1 : 0);
    gl.uniform3fv(gl.getUniformLocation(program, "uC"), new Float32Array(paletteKey.split(",").flatMap(hexToRgb)));
    gl.clearColor(0, 0, 0, 0);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let visible = true;
    let onScreen = true;
    let running = false;
    let elapsed = 0;
    let last = 0;

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
      // Keep the sweep's angle and position sensible from wide desktops to tall phones.
      const aspect = h / w;
      gl.uniform2f(uFrame, aspect < 1 ? 0.24 : 0.08, Math.min(Math.max(aspect, 1), 2.2));
    };

    const draw = () => {
      gl.uniform1f(uTime, elapsed);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const loop = (now: number) => {
      if (!running) return;
      if (last) elapsed += Math.min(now - last, 100) / 1000 * speed;
      last = now;
      draw();
      frame = requestAnimationFrame(loop);
    };

    const update = () => {
      const shouldRun = !reduceMotion && visible && onScreen;
      if (shouldRun && !running) {
        running = true;
        last = 0;
        frame = requestAnimationFrame(loop);
      } else if (!shouldRun && running) {
        running = false;
        cancelAnimationFrame(frame);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (!running) draw();
    });
    resizeObserver.observe(canvas);

    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    });
    intersection.observe(canvas);

    const onVisibility = () => {
      visible = !document.hidden;
      update();
    };
    document.addEventListener("visibilitychange", onVisibility);

    resize();
    // A little head start so the first frame already shows the waves in motion.
    elapsed = 4;
    draw();
    update();

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [mirror, paletteKey, speed]);

  if (fallback) {
    const p = paletteKey.split(",");
    return (
      <div
        aria-hidden="true"
        className={className}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `linear-gradient(${mirror ? 245 : 115}deg, transparent 38%, ${p[0]}cc 46%, ${p[2]}cc 56%, ${p[4]}cc 68%, ${p[5]}cc 78%, transparent 86%)`,
          ...style,
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none", ...style }}
    />
  );
}
