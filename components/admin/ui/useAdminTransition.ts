"use client";

import { useCallback, useContext, useTransition } from "react";
import { AdminFeedbackContext } from "./AdminFeedbackProvider";
import { AdminRefreshContext } from "./AdminRefreshScope";

/** Catch rejected admin tasks before React can promote them to the route boundary. */
export function useAdminTransition({ refreshAfter = false }: { refreshAfter?: boolean } = {}) {
  const [pending, startTransition] = useTransition();
  const feedback = useContext(AdminFeedbackContext);
  const refreshWorkspace = useContext(AdminRefreshContext);
  const start = useCallback((action: () => void | Promise<void>) => {
    startTransition(async () => {
      try { await action(); }
      catch (error) {
        console.error("[admin action]", error);
        feedback?.showToast({ type: "error", duration: 10000,
          message: "We couldn’t confirm the result. Refresh the information before trying the action again." });
      }
      // Read only: reconcile the displayed state even if a mutation response was
      // interrupted. Never automatically repeat the mutation itself.
      if (refreshAfter && refreshWorkspace) {
        try { await refreshWorkspace(); }
        catch (error) {
          console.error("[admin action refresh]", error);
          feedback?.showToast({ type: "error", duration: 10000,
            message: "The latest information is unavailable. Refresh the information without repeating your action." });
        }
      }
    });
  }, [feedback, refreshAfter, refreshWorkspace]);
  return [pending, start] as const;
}
