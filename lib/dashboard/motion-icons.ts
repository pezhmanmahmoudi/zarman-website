/** Original, local Zarman artwork. JSON and SVG share the same vector source. */
export const dashboardMotionIcons = {
  review: {
    src: "/animations/dashboard/review.json",
    poster: "/animations/dashboard/review.svg",
    endFrame: 47,
  },
  verify: {
    src: "/animations/dashboard/verify.json",
    poster: "/animations/dashboard/verify.svg",
    endFrame: 47,
  },
  upload: {
    src: "/animations/dashboard/upload.json",
    poster: "/animations/dashboard/upload.svg",
    endFrame: 47,
  },
  received: {
    src: "/animations/dashboard/received.json",
    poster: "/animations/dashboard/received.svg",
    endFrame: 47,
  },
  complete: {
    src: "/animations/dashboard/complete.json",
    poster: "/animations/dashboard/complete.svg",
    endFrame: 47,
  },
  recipients: {
    src: "/animations/dashboard/recipients.json",
    poster: "/animations/dashboard/recipients.svg",
    endFrame: 47,
  },
  attention: {
    src: "/animations/dashboard/attention.json",
    poster: "/animations/dashboard/attention.svg",
    endFrame: 47,
  },
} as const;

export type DashboardMotionIconName = keyof typeof dashboardMotionIcons;
