"use client"

import React, {
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
} from "react"
import { AnimatePresence, motion, useReducedMotion, type MotionProps } from "motion/react"

import { cn } from "@/lib/utils"

export function AnimatedListItem({
  children,
  mode = "sequence",
  motionEnabled = true,
  role,
}: {
  children: React.ReactNode
  mode?: "sequence" | "live"
  motionEnabled?: boolean
  role?: "listitem"
}) {
  const reducedMotion = useReducedMotion()
  const animate = motionEnabled && !reducedMotion
  const animations: MotionProps = {
    initial: mode === "live" ? { opacity: 0, filter: "blur(3px)" } : { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1, filter: "blur(0px)", originY: 0 },
    // Remove live links immediately so an outgoing item cannot retain focus.
    exit: mode === "live" ? undefined : { scale: 0, opacity: 0 },
    transition: mode === "live" ? { duration: .28, ease: [.22, 1, .36, 1] } : { type: "spring", stiffness: 350, damping: 40 },
  }

  if (!animate) {
    return <div role={role} className="mx-auto w-full">{children}</div>
  }

  return (
    <motion.div
      {...animations}
      layout={mode === "live" ? "position" : true}
      role={role}
      className="mx-auto w-full"
    >
      {children}
    </motion.div>
  )
}

export interface AnimatedListProps extends ComponentPropsWithoutRef<"div"> {
  children: React.ReactNode
  delay?: number
  mode?: "sequence" | "live"
  motionEnabled?: boolean
}

export const AnimatedList = React.memo(
  ({ children, className, delay = 1000, mode = "sequence", motionEnabled = true, role, ...props }: AnimatedListProps) => {
    const [index, setIndex] = useState(0)
    const childrenArray = useMemo(
      () => React.Children.toArray(children),
      [children]
    )

    useEffect(() => {
      let timeout: ReturnType<typeof setTimeout> | null = null

      if (mode === "sequence" && index < childrenArray.length - 1) {
        timeout = setTimeout(() => {
          setIndex((prevIndex) => prevIndex + 1)
        }, delay)
      }

      return () => {
        if (timeout !== null) {
          clearTimeout(timeout)
        }
      }
    }, [index, delay, childrenArray.length, mode])

    const itemsToShow = useMemo(() => {
      return mode === "live" ? childrenArray : childrenArray.slice(0, index + 1).reverse()
    }, [index, childrenArray, mode])

    return (
      <div
        className={cn(`flex flex-col items-center gap-4`, className)}
        role={role}
        {...props}
      >
        <AnimatePresence initial={mode !== "live" && motionEnabled}>
          {itemsToShow.map((item, itemIndex) => (
            <AnimatedListItem
              key={React.isValidElement(item) ? item.key : itemIndex}
              mode={mode}
              motionEnabled={motionEnabled}
              role={role === "list" ? "listitem" : undefined}
            >
              {item}
            </AnimatedListItem>
          ))}
        </AnimatePresence>
      </div>
    )
  }
)

AnimatedList.displayName = "AnimatedList"
