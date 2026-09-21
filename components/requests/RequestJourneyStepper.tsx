"use client";

import { motion, useReducedMotion } from "framer-motion";
import Stepper, { Step } from "@/components/Stepper";
import { useDashboardMotion } from "@/components/dashboard/DashboardMotion";
import type { RequestMilestone } from "@/lib/requests/journey";
import type { RequestLocale } from "@/lib/requests/types";
import { requestDate } from "./request-labels";
import "./RequestJourneyStepper.css";

type RequestJourneyStepperProps = {
  milestones: RequestMilestone[];
  stage: number;
  locale: RequestLocale;
  actorLabel: string;
  motionEnabled?: boolean;
};

/** The server supplies every milestone; animation never advances a transfer. */
export function RequestJourneyStepper({ milestones, stage, locale, actorLabel, motionEnabled }: RequestJourneyStepperProps) {
  const dashboardMotion = useDashboardMotion();
  const systemReducedMotion = useReducedMotion();
  const reducedMotion = !(motionEnabled ?? dashboardMotion) || Boolean(systemReducedMotion);
  const fa = locale === "fa";

  return (
    <Stepper
      className="request-journey-stepper"
      dir={fa ? "rtl" : "ltr"}
      currentStep={stage + 1}
      readOnly
      motionEnabled={!reducedMotion}
      disableStepIndicators
      showNavigation={false}
      showContent={false}
      stepListLabel={fa ? "مراحل حواله" : "Transfer progress"}
      renderStepIndicator={({ step }: { step: number }) => {
        const milestone = milestones[step - 1];
        const checked = milestone.done && (!milestone.current || milestone.key === "completed");
        const state = milestone.current ? "current" : milestone.done ? "complete" : "upcoming";

        return (
          <li
            key={milestone.key}
            className="request-journey-step"
            data-done={milestone.done}
            data-current={milestone.current}
            aria-current={milestone.current ? "step" : undefined}
          >
            <div className="request-journey-node-wrap" aria-hidden="true">
              <motion.span
                className="request-journey-node"
                initial={false}
                animate={state}
                variants={{
                  upcoming: { backgroundColor: "#ffffff", borderColor: "#dfe3e8", color: "#7a828d" },
                  complete: { backgroundColor: "#eeedff", borderColor: "#d9d6ff", color: "#554dc4" },
                  current: { backgroundColor: "#635bff", borderColor: "#635bff", color: "#ffffff" },
                }}
                transition={{ duration: reducedMotion ? 0 : 0.35, ease: "easeOut" }}
              >
                {checked ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="request-journey-check">
                    <motion.path
                      d="m5 12 4 4L19 6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={reducedMotion ? false : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: reducedMotion ? 0 : 0.4, ease: "easeOut" }}
                    />
                  </svg>
                ) : <span>{step}</span>}
              </motion.span>
              {milestone.current && (
                <motion.span
                  className="request-journey-focus-ring"
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.82 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: reducedMotion ? 0 : 0.5, ease: "easeOut" }}
                />
              )}
            </div>
            <div className="request-journey-caption">
              <strong>{milestone.label[fa ? 1 : 0]}</strong>
              {milestone.at ? (
                <time dir="ltr" dateTime={milestone.at}>{requestDate(milestone.at, locale)}</time>
              ) : (
                <small>{milestone.current ? actorLabel : fa ? "در انتظار" : "Up next"}</small>
              )}
            </div>
          </li>
        );
      }}
    >
      {milestones.map(milestone => <Step key={milestone.key}>{null}</Step>)}
    </Stepper>
  );
}
