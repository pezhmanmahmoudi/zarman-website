"use client";

/*
 * Zarman silk wave: a diagonal band of fine, silk-like strands that flows,
 * ripples and catches light. Drawn by our own WebGL2 fragment shader (no
 * third-party gradient code).
 *
 * Motion is calibrated to the calm pace of Stripe's homepage gradient: the
 * band drifts about 3–4% of its width per second and its large ripples take
 * 10–20 s per cycle.
 *
 * Performance:
 * - WebGL starts only once the browser is idle after first paint, then fades in,
 *   so it never competes with page load.
 * - Pixels outside the band skip all noise work (most of the canvas is white).
 * - Fibre detail finer than ~3 screen pixels is filtered out (it would only
 *   shimmer), which also saves work.
 * - Pixel density is capped (1 on touch devices, 1.25 elsewhere) and the
 *   render scale drops automatically if frames get slow.
 * - On 120 Hz+ screens it draws every other refresh (still 60+ fps).
 * - Pauses while the tab is hidden or the canvas is off-screen; one still
 *   frame for users who prefer reduced motion.
 * - Falls back to a static CSS band when WebGL2 is unavailable.
 */

import React, { useEffect, useRef, useState } from "react";

// The site's original gradient colours: cyan, indigo, fuchsia, rose.
export const SILK_PALETTE = ["#06b6d4", "#4f46e5", "#c026d3", "#fda4af"];

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
uniform vec3 uC[4];

float h1(float n) { return fract(sin(n * 127.1 + 31.7) * 43758.5453); }
float vn(float x) {
  float i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(h1(i), h1(i + 1.0), f);
}
// One octave of fibre noise, faded to its average once its strands get thinner
// than ~3 screen pixels. Sub-pixel strands only shimmer, so skipping them keeps
// the motion smooth and saves work where the band is narrow.
float oct(float x, float f, float o, float cpp) {
  float k = 1.0 - smoothstep(0.18, 0.40, f * cpp);
  return k > 0.0 ? mix(0.5, vn(x * f + o), k) : 0.5;
}
// Multi-scale 1D noise: reads as combed fibres across the band.
// cpp: screen cycles per pixel for frequency 1.
// (A finer 4th octave would always be sub-pixel at our capped density, so its
// average, 0.05, stands in for it.)
float strands(float x, float cpp) {
  return 0.42 * vn(x * 38.0) + 0.30 * oct(x, 96.0, 3.0, cpp) + 0.18 * oct(x, 240.0, 7.0, cpp) + 0.05;
}
vec3 pal(float t) {
  t = pow(clamp(t, 0.0, 1.0), 0.8) * 3.0; // more room for the warm rose end
  float f = fract(t);
  f = f * f * (3.0 - 2.0 * f);
  int i = int(floor(t));
  vec3 a = uC[0], b = uC[1];
  if (i == 1) { a = uC[1]; b = uC[2]; }
  else if (i >= 2) { a = uC[2]; b = uC[3]; }
  return mix(a, b, f);
}

// One translucent sheet of strands; returns premultiplied colour.
// spd: how fast this sheet moves; amp: how far it ripples sideways.
vec4 sheet(vec2 p, float l0, float l1, float l2, float w0, float w1, float c0, float c1,
           float fib, float ph, float alpha, float soft, float spd, float amp) {
  float T = uTime * spd;
  float y = p.y;

  // Slow travelling ripples along the band: the sheet undulates like cloth.
  float sway = amp * (0.050 * sin(y * 2.3 - T * 0.32 + ph)
                    + 0.028 * sin(y * 5.4 + T * 0.45 + ph * 1.7)
                    + 0.012 * sin(y * 11.0 - T * 0.60 + ph * 3.1));
  float xl = l0 + l1 * y + l2 * y * y + sway;

  // The band gently breathes: its width pinches and swells as waves pass.
  float w = mix(w0, w1, pow(clamp(y, 0.0, 1.0), 0.85));
  w *= 1.0 + 0.10 * amp * sin(y * 3.1 - T * 0.28 + ph * 2.0);

  float t = (p.x - xl) / w;
  // Outside this sheet: nothing to draw, skip all the noise work.
  if (t < 0.0 || t > 1.0) return vec4(0.0);
  float px = 1.5 / uRes.x / w;

  // Fibres flow along the band and bend with the ripples.
  float tw = t + 0.040 * sin(y * 4.2 + ph - T * 0.22)
               + 0.016 * sin(y * 11.0 + ph * 2.3 + t * 5.0 + T * 0.35)
               + 0.008 * sin(y * 23.0 - T * 0.60 + t * 9.0);
  float cpp = 1.0 / (uRes.x * w);
  float s = strands(tw + ph * 3.0, cpp);
  float s2 = strands(tw * 2.3 + ph * 7.0 + 4.0, cpp * 2.3);

  // Satin folds that roll slowly across the band.
  float fold = 0.5 + 0.5 * cos(t * 7.2 + ph + y * 1.7 - T * 0.50);
  float fold2 = 0.5 + 0.5 * cos(t * 17.0 - ph * 1.3 + y * 3.1 + T * 0.38);

  // Colour drifts slowly along the band so the hues travel.
  float hueShift = 0.06 * sin(y * 1.6 - T * 0.18 + ph);
  vec3 col = pal(mix(c0, c1, t) + hueShift + 0.05 * (s - 0.5) + 0.04 * (fold - 0.5));
  col *= 1.0 + fib * (s - 0.5) * 0.6;
  col = mix(col, vec3(1.0), fib * 0.5 * pow(s2, 5.0) + 0.18 * pow(fold, 6.0) + 0.08 * pow(fold2, 10.0));
  col = mix(col, col * col * 1.05, 0.24 * (1.0 - fold) * fib);

  // A soft glint of light that slides down the band about every 30 s.
  float gy = fract(T * 0.035 + ph * 0.13) * 1.8 - 0.4;
  float glint = exp(-pow((y - gy) * 3.2, 2.0)) * pow(fold, 3.0);
  col = mix(col, vec3(1.0), 0.32 * glint);

  // Bright, crisp leading edge.
  float edge = exp(-t * w * uRes.x / 2.2);
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
  c = over(c, sheet(q, 0.50, 0.62, 0.34, 0.70, 0.70, 0.55, 1.00, 1.00, 2.9, 0.97, 0.02, 1.00, 0.8));
  c = over(c, sheet(q, 0.66, 0.66, 0.42, 0.56, 0.36, 0.88, 1.00, 1.00, 4.4, 0.55, 0.50, 1.35, 1.1));
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

// Run once the browser is idle so WebGL setup never delays first paint.
function whenIdle(cb: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(cb, { timeout: 1200 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(cb, 200);
  return () => window.clearTimeout(id);
}

type SilkWaveProps = {
  /** Flip the sweep horizontally (for RTL layouts). */
  mirror?: boolean;
  /** Four colour stops, cool -> warm. */
  palette?: string[];
  /** Extra sideways shift on narrow (<700px) canvases; negative pulls the wave into view. */
  narrowShift?: number;
  /** Animation speed multiplier (1 = calibrated default). */
  speed?: number;
  className?: string;
  style?: React.CSSProperties;
};

export default function SilkWave({ mirror = false, palette = SILK_PALETTE, narrowShift = 0, speed = 1, className, style }: SilkWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);
  const [ready, setReady] = useState(false);
  const paletteKey = palette.join(",");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let teardown: (() => void) | null = null;

    const start = () => {
      if (disposed) return;
      const gl = canvas.getContext("webgl2", {
        premultipliedAlpha: true,
        antialias: false,
        alpha: true,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
      });
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
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const maxDpr = coarse ? 1 : 1.25;
      let renderScale = 1; // lowered automatically if frames are slow
      let frame = 0;
      let visible = !document.hidden;
      let onScreen = true;
      let running = false;
      let elapsed = 6; // small head start so the first frame is mid-motion
      let last = 0;
      let lastTick = 0;
      let refresh = 16.7; // measured screen refresh interval (ms)
      let skip = false;
      let slowFrames = 0;
      let sampled = 0;

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, maxDpr) * renderScale;
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
        const shift = canvas.clientWidth < 700 ? narrowShift : 0;
        gl.uniform2f(uFrame, (aspect < 1 ? 0.12 : -0.02) + shift, Math.min(Math.max(aspect, 1), 2.2));
      };

      const draw = () => {
        gl.uniform1f(uTime, elapsed);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };

      const loop = (now: number) => {
        if (!running) return;
        frame = requestAnimationFrame(loop);
        if (lastTick) refresh = refresh * 0.9 + Math.min(now - lastTick, 50) * 0.1;
        lastTick = now;
        // On 120 Hz+ screens draw every other refresh: a slow wave stays perfectly
        // smooth at 60+ fps, and the GPU does half the work.
        if (refresh < 11) {
          skip = !skip;
          if (skip) return;
        }
        if (last) {
          const dt = now - last;
          elapsed += (Math.min(dt, 100) / 1000) * speed;
          // Adaptive quality: if most recent frames miss ~40 fps, render fewer pixels.
          if (sampled < 600) {
            sampled++;
            slowFrames = dt > 25 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
            if (slowFrames > 20 && renderScale > 0.55) {
              renderScale = Math.max(0.55, renderScale - 0.15);
              slowFrames = 0;
              resize();
            }
          }
        }
        last = now;
        draw();
      };

      const update = () => {
        const shouldRun = !reduceMotion && visible && onScreen;
        if (shouldRun && !running) {
          running = true;
          last = 0;
          lastTick = 0;
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
      draw();
      setReady(true);
      update();

      teardown = () => {
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
    };

    const cancelIdle = whenIdle(start);
    return () => {
      disposed = true;
      cancelIdle();
      teardown?.();
    };
  }, [mirror, paletteKey, speed, narrowShift]);

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
          background: `linear-gradient(${mirror ? 245 : 115}deg, transparent 38%, ${p[0]}cc 48%, ${p[1]}cc 60%, ${p[2]}cc 72%, ${p[3]}cc 80%, transparent 88%)`,
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
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        pointerEvents: "none",
        opacity: ready ? 1 : 0,
        transition: "opacity 0.8s ease",
        ...style,
      }}
    />
  );
}
