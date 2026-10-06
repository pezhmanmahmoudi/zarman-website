export type DashboardLottieSceneAsset = {
  src: string;
  loop?: boolean;
  holdOnComplete?: boolean;
  segment?: readonly [number, number];
  /** Zoom for artwork drawn small inside a large canvas, centred on `origin`. */
  zoom?: { scale: number; origin: string };
};

/**
 * Customer-supplied dashboard illustrations, named by business meaning rather
 * than by their downloaded filenames. They are fetched only when visible.
 */
export const dashboardLottieScenes = {
  "document-upload-idle": { src: "/animations/dashboard/preview/uploading-2868b2da3e5e.json", holdOnComplete: true },
  // The check and blue circle end at frame 47; frames 47–60 are blank.
  // Stop on frame 46 at the original speed, then keep the completed check visible.
  "document-upload-success": { src: "/animations/dashboard/preview/success-blue-6b0b7dd2efdc.json", holdOnComplete: true, segment: [0, 47] },
  "document-upload": { src: "/animations/dashboard/preview/uploading-to-cloud-bb09e4b9bba7.json", loop: true, holdOnComplete: true },
  "receipt-upload": { src: "/animations/dashboard/preview/bill-paid-successful.json", holdOnComplete: true },
  chat: { src: "/animations/dashboard/preview/chat-53dcf8299cbb.json", holdOnComplete: true },
  "telegram-chatbot": { src: "/animations/dashboard/preview/live-chatbot-930197740966.json", holdOnComplete: true },
  "feedback-heart": { src: "/animations/dashboard/preview/add-to-favorites.json", holdOnComplete: true },
  alert: { src: "/animations/dashboard/preview/alert.json", holdOnComplete: true },
  announcement: { src: "/animations/dashboard/preview/announcement.json", holdOnComplete: true },
  "activity-history": { src: "/animations/dashboard/preview/isometric-data-analysis.json", holdOnComplete: true },
  "bank-card": { src: "/animations/dashboard/preview/card-lottie-animation.json", holdOnComplete: true },
  "dashboard-loading": { src: "/animations/dashboard/preview/hand-loding.json", loop: true, holdOnComplete: true },
  "loyalty-milestone": { src: "/animations/dashboard/preview/gift-reward-animation.json", holdOnComplete: true },
  "compliance-review": { src: "/animations/dashboard/preview/compliance.json", loop: true, holdOnComplete: true },
  "mobile-payment": { src: "/animations/dashboard/preview/mobile-payment.json", holdOnComplete: true },
  "transfer-setup": { src: "/animations/dashboard/preview/3d-mobile-payment.json", holdOnComplete: true },
  "recipient-selection": { src: "/animations/dashboard/preview/recruitment-d8f3ec5d7be5.json", holdOnComplete: true },
  "payment-failed": { src: "/animations/dashboard/preview/payment-failed.json", holdOnComplete: true },
  "payment-confirmed": { src: "/animations/dashboard/preview/payment-success.json", holdOnComplete: true },
  "transfer-complete": { src: "/animations/dashboard/preview/payment-sucessful.json", holdOnComplete: true },
  // Loops because the envelope flies away and the last frames are empty.
  "request-submitted": { src: "/animations/dashboard/preview/submitted-5c929bc9f3af.json", loop: true, holdOnComplete: true },
  // Keep only the first 84 frames: 3.5 seconds at the original 24 fps.
  "recipient-avatar": { src: "/animations/dashboard/preview/profile-avatar-for-child-bd507410b67b.json", holdOnComplete: true, segment: [0, 84] },
  "feedback-review": { src: "/animations/dashboard/preview/review.json", holdOnComplete: true },
  "identity-fingerprint": { src: "/animations/dashboard/preview/fingerprint-01ac4fd147c2.json", holdOnComplete: true },
  "identity-approved": { src: "/animations/dashboard/preview/send.json", holdOnComplete: true },
  "identity-rejected": { src: "/animations/dashboard/preview/wrong-fingerprint.json", holdOnComplete: true },
  warning: { src: "/animations/dashboard/preview/warning.json", holdOnComplete: true },
  "loyalty-savings": { src: "/animations/dashboard/preview/wallet-money-added.json", holdOnComplete: true, zoom: { scale: 1.9, origin: "50% 78%" } },
  waiting: { src: "/animations/dashboard/preview/waiting-p.json", loop: true, holdOnComplete: true },
  loading: { src: "/animations/dashboard/preview/loading-animation.json", loop: true, holdOnComplete: true },
  "text-loading": { src: "/animations/dashboard/preview/animation-1714895807937.json", loop: true, holdOnComplete: true },
} as const satisfies Record<string, DashboardLottieSceneAsset>;

export type DashboardLottieSceneName = keyof typeof dashboardLottieScenes;
