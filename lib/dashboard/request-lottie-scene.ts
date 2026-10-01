import type { journeyPresentation } from "./journey-presentation";
import type { DashboardLottieSceneName } from "./lottie-scenes";

/** Visual decoration follows recorded workflow facts and never advances state. */
export function requestLottieScene(journey: ReturnType<typeof journeyPresentation>): DashboardLottieSceneName {
  if (journey.mood === "complete") return "transfer-complete";
  if (journey.mood === "failed") return "payment-failed";
  if (journey.customerActionRequired) return "alert";
  if (journey.canPay && !journey.receiptSubmitted) return "mobile-payment";
  if (journey.fundsReceived) return "payment-confirmed";
  if (journey.closed || journey.mood === "quiet") return "warning";
  return "compliance-review";
}
