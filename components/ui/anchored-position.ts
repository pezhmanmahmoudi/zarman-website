export interface AnchorRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
}

/** Keep a floating surface inside the visible viewport, including at 200% zoom. */
export function getAnchoredPosition({
  anchor, width, height, viewportWidth, viewportHeight, viewportLeft = 0, viewportTop = 0,
  gap = 8, margin = 8, preferredSide = "bottom", align = "start",
}: {
  anchor: AnchorRect;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  viewportLeft?: number;
  viewportTop?: number;
  gap?: number;
  margin?: number;
  preferredSide?: "top" | "bottom";
  align?: "start" | "center" | "end";
}) {
  const availableWidth = Math.max(0, viewportWidth - margin * 2);
  const actualWidth = Math.min(width, availableWidth);
  const below = Math.max(0, viewportTop + viewportHeight - margin - anchor.bottom - gap);
  const above = Math.max(0, anchor.top - viewportTop - margin - gap);
  const preferAbove = preferredSide === "top";
  const side = preferAbove ? (above >= height || above >= below ? "top" : "bottom")
    : (below >= height || below >= above ? "bottom" : "top");
  const maxHeight = Math.min(side === "top" ? above : below, Math.max(0, viewportHeight - margin * 2));
  const desiredLeft = align === "end" ? anchor.right - actualWidth
    : align === "center" ? anchor.left + (anchor.width - actualWidth) / 2 : anchor.left;
  const left = Math.max(viewportLeft + margin, Math.min(desiredLeft, viewportLeft + viewportWidth - actualWidth - margin));
  const desiredTop = side === "top" ? anchor.top - gap - Math.min(height, maxHeight) : anchor.bottom + gap;
  const top = Math.max(viewportTop + margin, Math.min(desiredTop, viewportTop + viewportHeight - Math.min(height, maxHeight) - margin));
  return { left, top, width: actualWidth, maxHeight, side };
}
