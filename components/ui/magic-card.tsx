"use client"

import { useCallback, useEffect, type HTMLAttributes, type PointerEvent } from "react"
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "motion/react"
import { cn } from "@/lib/utils"

interface MagicCardBaseProps extends HTMLAttributes<HTMLDivElement> {
  contentClassName?: string
  motionEnabled?: boolean
  gradientSize?: number
  gradientFrom?: string
  gradientTo?: string
  edgeOpacity?: number
}
interface MagicCardGradientProps extends MagicCardBaseProps {
  mode?: "gradient"
  gradientColor?: string
  gradientOpacity?: number
  glowFrom?: never; glowTo?: never; glowAngle?: never; glowSize?: never; glowBlur?: never; glowOpacity?: never
}
interface MagicCardOrbProps extends MagicCardBaseProps {
  mode: "orb"
  glowFrom?: string; glowTo?: string; glowAngle?: number; glowSize?: number; glowBlur?: number; glowOpacity?: number
  gradientColor?: never; gradientOpacity?: never
}
export type MagicCardProps = MagicCardGradientProps | MagicCardOrbProps

/** Magic UI pointer lighting adapted to the dashboard's light-only surfaces.
 * All controls remain still. Touch, pause and reduced motion keep the same
 * coloured card without pointer tracking or a dark-theme provider.
 */
export function MagicCard({
  children, className, contentClassName, motionEnabled = true,
  gradientSize = 260, gradientColor = "#d7c4ff", gradientOpacity = .24,
  gradientFrom = "#a58ae3", gradientTo = "#c7e9e2", mode = "gradient", edgeOpacity = .12,
  glowFrom = "#d5b9fa", glowTo = "#a8e6dc", glowAngle = 90,
  glowSize = 240, glowBlur = 32, glowOpacity = .25,
  onPointerMove, onPointerEnter, onPointerLeave, ...props
}: MagicCardProps) {
  const reduced = useReducedMotion()
  const enabled = motionEnabled && reduced === false
  const mouseX = useMotionValue(-gradientSize * 2)
  const mouseY = useMotionValue(-gradientSize * 2)
  const visible = useMotionValue(0)
  // Springs ease the light after the pointer and fade it in and out instead of switching it.
  const glowX = useSpring(mouseX, { stiffness: 320, damping: 38, mass: .5 })
  const glowY = useSpring(mouseY, { stiffness: 320, damping: 38, mass: .5 })
  const glowFade = useSpring(visible, { stiffness: 140, damping: 24 })
  const orbX = useSpring(mouseX, { stiffness: 250, damping: 30, mass: .6 })
  const orbY = useSpring(mouseY, { stiffness: 250, damping: 30, mass: .6 })
  const reset = useCallback(() => {
    visible.set(0)
    glowFade.jump(0)
    mouseX.set(-gradientSize * 2)
    mouseY.set(-gradientSize * 2)
    glowX.jump(-gradientSize * 2)
    glowY.jump(-gradientSize * 2)
    orbX.jump(-gradientSize * 2)
    orbY.jump(-gradientSize * 2)
  }, [gradientSize, mouseX, mouseY, glowX, glowY, glowFade, orbX, orbY, visible])
  useEffect(() => {
    if (!enabled) { reset(); return }
    const hide = () => { if (document.visibilityState !== "visible") reset() }
    window.addEventListener("blur", reset)
    document.addEventListener("visibilitychange", hide)
    return () => { window.removeEventListener("blur", reset); document.removeEventListener("visibilitychange", hide) }
  }, [enabled, reset])
  const track = (event: PointerEvent<HTMLDivElement>, entering = false) => {
    if (!enabled || event.pointerType !== "mouse") return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left, y = event.clientY - bounds.top
    mouseX.set(x)
    mouseY.set(y)
    // Start where the pointer enters rather than sweeping in from the last exit point.
    if (entering || glowFade.get() < .02) { glowX.jump(x); glowY.jump(y) }
    visible.set(1)
  }
  const gradient = useMotionTemplate`radial-gradient(${gradientSize}px circle at ${glowX}px ${glowY}px, ${gradientColor}, transparent 100%)`
  const edge = useMotionTemplate`radial-gradient(${gradientSize}px circle at ${glowX}px ${glowY}px, ${gradientFrom}, ${gradientTo} 45%, transparent 100%)`
  return <div {...props} data-magic-card data-magic-motion={enabled ? "on" : "off"}
    className={cn("group relative isolate overflow-hidden rounded-3xl border border-[#ded4ef] bg-white", className)}
    onPointerMove={event => { track(event); onPointerMove?.(event) }}
    onPointerEnter={event => { track(event, true); onPointerEnter?.(event) }}
    onPointerLeave={event => { visible.set(0); onPointerLeave?.(event) }}>
    {enabled && <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 rounded-[inherit]" style={{ opacity: glowFade }}>
      <motion.div className="absolute inset-0 rounded-[inherit] border border-transparent" style={{ backgroundImage: edge, opacity: edgeOpacity }} />
      {mode === "gradient" ? <motion.div className="absolute inset-0" style={{ backgroundImage: gradient, opacity: gradientOpacity }} />
        : <motion.div className="absolute rounded-full" style={{ width: glowSize, height: glowSize, x: orbX, y: orbY, translateX: "-50%", translateY: "-50%", filter: `blur(${glowBlur}px)`, opacity: glowOpacity, background: `linear-gradient(${glowAngle}deg, ${glowFrom}, ${glowTo})` }} />}
    </motion.div>}
    <div className={cn("relative z-10 min-w-0", contentClassName)}>{children}</div>
  </div>
}
