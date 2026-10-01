"use client";

import React from "react";
import { Star } from "lucide-react";
import styles from "@/styles/admin/AdminWorkspace.module.css";
import { AdminDataTable, AdminTableRow, AdminTableCell, AdminTableDate } from "@/components/admin/ui/AdminDataTable";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { FeedbackModerateButtons } from "@/components/admin/FeedbackModerateButtons";
import type { getUserFinancialProfile } from "@/app/actions/admin.actions";

type Testimonials = Awaited<ReturnType<typeof getUserFinancialProfile>>["testimonials"];

function StarRating({ rating }: { rating: number }) {
  return (
    <span className={tableStyles.stars} role="img" aria-label={rating + " out of 5 stars"}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          aria-hidden="true"
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
  return <section className={styles.panel} aria-label="Customer feedback">
    <div className={styles.toolbar}><h2 className={styles.panelTitle}>Customer feedback</h2></div>
    <AdminDataTable label="Customer feedback" columns={[
      { key: "message", label: "Message" }, { key: "rating", label: "Rating" }, { key: "status", label: "Status" },
      { key: "date", label: "Submitted" }, { key: "actions", label: "Actions", actions: true },
    ]} empty={!testimonials.length && "No feedback submitted by this customer."}>
      {testimonials.map((feedback: Testimonials[number]) => <AdminTableRow key={feedback.id}>
        <AdminTableCell kind="primary"><p className={styles.description} dir="auto">{feedback.message}</p></AdminTableCell>
        <AdminTableCell label="Rating"><StarRating rating={feedback.rating ?? 5} /></AdminTableCell>
        <AdminTableCell label="Status"><StatusBadge status={feedback.status} /></AdminTableCell>
        <AdminTableCell label="Submitted"><AdminTableDate value={feedback.created_at} /></AdminTableCell>
        <AdminTableCell kind="actions"><FeedbackModerateButtons feedbackId={feedback.id} currentStatus={feedback.status} /></AdminTableCell>
      </AdminTableRow>)}
    </AdminDataTable>
  </section>;
}
