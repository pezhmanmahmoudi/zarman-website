"use client";

import React from "react";
import { MessageSquare, Star } from "lucide-react";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { FeedbackModerateButtons } from "@/components/admin/FeedbackModerateButtons";
import type { getUserFinancialProfile } from "@/app/actions/admin.actions";

type Testimonials = Awaited<ReturnType<typeof getUserFinancialProfile>>["testimonials"];

function StarRating({ rating }: { rating: number }) {
  return (
    <span className={tableStyles.stars}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={14}
          fill={s <= rating ? "currentColor" : "none"}
          className={`${s <= rating ? tableStyles.starFilled : tableStyles.starEmpty} ${tableStyles.iconShiftRight}`}
        />
      ))}
    </span>
  );
}

interface UserFeedbackHistoryProps {
  testimonials: Testimonials;
}

export function UserFeedbackHistory({ testimonials }: UserFeedbackHistoryProps) {
  return (
    <div className={cardStyles.panel}>
      <div className={`${cardStyles.panelHeader} ${cardStyles.panelHeaderComfort}`}>
        <h2 className={cardStyles.panelTitle}>
          <MessageSquare size={18} color="var(--text-dim)" />
          Customer Feedback
        </h2>
      </div>
      <div className={tableStyles.tableWrap}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Rating</th>
              <th>Message</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {testimonials.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className={`${cardStyles.emptyState} ${cardStyles.emptyStateCompact}`}>
                    <div className={cardStyles.emptyStateText}>
                      No feedback submitted by this user.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              testimonials.map((feedback) => (
                <tr
                  key={feedback.id}
                  className={
                    feedback.status === "pending"
                      ? tableStyles.rowTintWarning
                      : tableStyles.rowTransparent
                  }
                >
                  <td className={`${tableStyles.cellMono} ${tableStyles.cellSmall} ${tableStyles.cellDim}`}>
                    {new Date(feedback.created_at).toLocaleDateString("en-AU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    })}
                  </td>
                  <td>
                    <StarRating rating={feedback.rating ?? 5} />
                  </td>
                  <td className={`${tableStyles.cellMax300} ${tableStyles.quoteUser}`}>
                    <div className={tableStyles.cellRtl}>{feedback.message}</div>
                  </td>
                  <td>
                    <StatusBadge status={feedback.status} />
                  </td>
                  <td>
                    <FeedbackModerateButtons
                      feedbackId={feedback.id}
                      currentStatus={feedback.status}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
