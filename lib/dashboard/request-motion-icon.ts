import type { journeyPresentation } from "./journey-presentation";
import type { DashboardMotionIconName } from "./motion-icons";

/** Decoration follows the same authoritative presentation as the adjacent text. */
export function requestMotionIcon(journey: ReturnType<typeof journeyPresentation>): DashboardMotionIconName {
  if (journey.mood === "complete") return "complete";
  if (journey.closed || journey.mood === "failed" || journey.nextActor === "closed") return "attention";
  // Refund processing is not successful delivery, even after funds were confirmed.
  if (journey.mood === "quiet") return "review";
  if (journey.nextActor === "customer") return journey.customerActionRequired ? "attention" : "upload";
  if (journey.fundsReceived) return "received";
  return "review";
}
