"use client"

import React, { memo } from "react"
import { useReducedMotion } from "framer-motion"

interface AuroraTextProps {
  children: React.ReactNode
  className?: string
  colors?: string[]
  speed?: number
  motionEnabled?: boolean
}

export const AuroraText = memo(
  ({
    children,
    className = "",
    colors = ["#7043bf", "#a43870", "#226da0", "#237466"],
    speed = 1,
    motionEnabled = true,
  }: AuroraTextProps) => {
    const reduced = useReducedMotion()
    const gradientStyle = {
      backgroundImage: `linear-gradient(135deg, ${colors.join(", ")}, ${
        colors[0]
      })`,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      animationDuration: `${7 / Math.max(.1, speed)}s`,
      animationName: motionEnabled && reduced === false ? undefined : "none",
    }

    return (
      <span className={`relative inline-block ${className}`}>
        <span className="sr-only">{children}</span>
        <span
          className="animate-aurora relative bg-size-[200%_auto] bg-clip-text text-transparent motion-reduce:animate-none"
          style={gradientStyle}
          aria-hidden="true"
        >
          {children}
        </span>
      </span>
    )
  }
)

AuroraText.displayName = "AuroraText"
