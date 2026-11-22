"use client";

import { useEffect } from "react";

/**
 * The home page alternates light (Hero, About) and dark (Rates, FAQ, CTA…)
 * sections. This samples the page colour directly behind the floating header
 * and exposes it as <html data-header-tone="light|dark">, so the header can use
 * light glass over light sections and dark glass over dark ones.
 *
 * Elements marked [data-site-header] (the header itself) are skipped.
 */
const ATTR = "data-header-tone";

function parseRgb(value: string): [number, number, number, number] | null {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}

function luminance([r, g, b]: [number, number, number, number]) {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function toneBehind(y: number): "light" | "dark" {
  const x = window.innerWidth / 2;
  const stack = document.elementsFromPoint(x, y);
  const target = stack.find((el) => !el.closest("[data-site-header]"));
  // Walk up to the first element with a mostly opaque background colour.
  for (let node: Element | null = target ?? null; node; node = node.parentElement) {
    const rgb = parseRgb(getComputedStyle(node).backgroundColor);
    if (rgb && rgb[3] >= 0.5) return luminance(rgb) > 0.4 ? "light" : "dark";
  }
  const body = parseRgb(getComputedStyle(document.body).backgroundColor);
  return body && luminance(body) > 0.4 ? "light" : "dark";
}

export function useHeaderTone() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;

    const update = () => {
      frame = 0;
      // Desktop and mobile headers are both rendered; CSS hides one of them.
      const visible = Array.from(document.querySelectorAll<HTMLElement>("[data-site-header]"))
        .find((el) => el.getBoundingClientRect().height > 0);
      const rect = visible?.getBoundingClientRect();
      const y = rect && rect.height > 0 ? rect.top + rect.height / 2 : 50;
      const tone = toneBehind(y);
      if (root.getAttribute(ATTR) !== tone) root.setAttribute(ATTR, tone);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Late-loading sections (rates, testimonials) can shift what sits under the header.
    const timer = window.setTimeout(schedule, 800);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
      root.removeAttribute(ATTR);
    };
  }, []);
}
