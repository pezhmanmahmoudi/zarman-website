"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { getAnchoredPosition } from "./anchored-position";

const openPopovers: HTMLElement[] = [];

/**
 * Native popovers escape overflow/transform clipping without losing inherited
 * theme, DOM containment, or the active dialog's focus boundary.
 */
export function useAnchoredPopover({
  open, anchorRef, popoverRef, onClose, matchWidth = false,
  preferredSide = "bottom", align = "start", maxHeight = 360,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  popoverRef: RefObject<HTMLElement | null>;
  onClose: (reason: "escape" | "outside" | "anchor-hidden") => void;
  matchWidth?: boolean;
  preferredSide?: "top" | "bottom";
  align?: "start" | "center" | "end";
  maxHeight?: number;
}) {
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; });

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!open || !anchor || !popover) return;
    let frame = 0;
    const viewport = window.visualViewport;
    popover.style.position = "fixed";
    popover.style.inset = "auto";
    popover.style.margin = "0";
    popover.style.boxSizing = "border-box";
    if (typeof popover.showPopover === "function") popover.showPopover();
    else popover.removeAttribute("popover");
    let preferredHeight = Math.min(popover.scrollHeight, maxHeight);
    openPopovers.push(popover);

    const update = () => {
      frame = 0;
      const anchorRect = anchor.getBoundingClientRect();
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      if (!anchor.getClientRects().length || anchorRect.bottom < viewportTop || anchorRect.top > viewportTop + viewportHeight) {
        closeRef.current("anchor-hidden");
        return;
      }
      // A row can leave its table's scrollport while remaining in the viewport.
      // Close the floating control when its anchor is no longer visible there.
      for (let parent = anchor.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (!/(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`)) continue;
        const rect = parent.getBoundingClientRect();
        if ((/(auto|scroll|hidden|clip)/.test(style.overflowY) && (anchorRect.bottom <= rect.top || anchorRect.top >= rect.bottom))
          || (/(auto|scroll|hidden|clip)/.test(style.overflowX) && (anchorRect.right <= rect.left || anchorRect.left >= rect.right))) {
          closeRef.current("anchor-hidden");
          return;
        }
        // Top-layer ancestors themselves escape any outer clipping containers.
        if (parent.matches("dialog[open]") || (typeof parent.showPopover === "function" && parent.matches(":popover-open"))) break;
      }
      popover.style.maxWidth = `${Math.max(0, viewportWidth - 16)}px`;
      if (matchWidth) popover.style.width = `${Math.min(anchorRect.width, viewportWidth - 16)}px`;
      // Keep the desired height when available space shrinks; otherwise a menu
      // near an edge can alternate between opening above and below each frame.
      preferredHeight = Math.min(Math.max(preferredHeight, popover.scrollHeight), maxHeight);
      const result = getAnchoredPosition({
        anchor: anchorRect,
        width: popover.offsetWidth,
        height: preferredHeight,
        viewportWidth, viewportHeight, viewportTop, viewportLeft, preferredSide, align,
      });
      popover.style.left = `${result.left}px`;
      popover.style.top = `${result.top}px`;
      popover.style.maxHeight = `${Math.min(result.maxHeight, maxHeight)}px`;
      popover.style.setProperty("--popover-available-height", `${Math.min(result.maxHeight, maxHeight)}px`);
      popover.dataset.side = result.side;
    };
    const scheduleUpdate = () => { if (!frame) frame = requestAnimationFrame(update); };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !anchor.contains(event.target) && !popover.contains(event.target)) closeRef.current("outside");
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && openPopovers[openPopovers.length - 1] === popover) {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current("escape");
      }
    };
    update();
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(anchor);
    observer.observe(popover);
    window.addEventListener("resize", scheduleUpdate);
    document.addEventListener("scroll", scheduleUpdate, true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    viewport?.addEventListener("resize", scheduleUpdate);
    viewport?.addEventListener("scroll", scheduleUpdate);
    return () => {
      openPopovers.splice(openPopovers.indexOf(popover), 1);
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      document.removeEventListener("scroll", scheduleUpdate, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      viewport?.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("scroll", scheduleUpdate);
      if (popover.isConnected && typeof popover.hidePopover === "function" && popover.matches(":popover-open")) popover.hidePopover();
    };
  }, [open, anchorRef, popoverRef, matchWidth, preferredSide, align, maxHeight]);
}
