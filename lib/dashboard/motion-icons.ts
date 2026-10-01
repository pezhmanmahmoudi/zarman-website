export type DashboardMotionAsset = {
  src: string;
  poster: string;
  endFrame: number;
  loop?: boolean;
  holdOnComplete?: boolean;
};

/** Local artwork, including selected customer-supplied LottieFiles downloads. */
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
  waiting: {
    src: "/animations/dashboard/imported/waiting.json",
    poster: "/animations/dashboard/imported/waiting.svg",
    endFrame: 47,
    holdOnComplete: true,
  },
  reward: {
    src: "/animations/dashboard/imported/reward.json",
    poster: "/animations/dashboard/imported/reward.svg",
    endFrame: 73,
    holdOnComplete: true,
  },
  loading: {
    src: "/animations/dashboard/imported/loading.json",
    poster: "/animations/dashboard/imported/loading.svg",
    endFrame: 56,
    // Mounted only during an actual read; never represents financial progress.
    loop: true,
  },
} as const satisfies Record<string, DashboardMotionAsset>;

export type DashboardMotionIconName = keyof typeof dashboardMotionIcons;
