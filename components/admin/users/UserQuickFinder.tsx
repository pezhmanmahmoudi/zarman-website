"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { searchUsers } from "@/app/actions/admin.actions";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import formStyles from "@/styles/admin/AdminForms.module.css";

type UserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_number: string | null;
  customer_code?: string | null;
};

export function UserQuickFinder() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  const doSearch = () => {
    if (!query.trim()) return;
    startTransition(async () => {
      const data = (await searchUsers(query)) as UserRow[];
      setResults(data);
      setSearched(true);
    });
  };

  return (
    <div className={cardStyles.panel} style={{ marginBottom: "1rem" }}>
      <div className={cardStyles.panelBody}>
        <div className={formStyles.searchRow}>
          <div className={formStyles.searchInputWrap}>
            <Search size={18} className={formStyles.searchIcon} />
            <input
              type="text"
              className={`${formStyles.input} ${formStyles.inputWithIcon}`}
              placeholder="Find customer by name, email, or phone..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
            />
          </div>
          <button type="button" className={formStyles.btnSecondary} onClick={doSearch} disabled={isPending || !query.trim()}>
            {isPending ? "Searching…" : "Find in Users"}
          </button>
          <Link href="/admin/users#assisted-onboarding" className={formStyles.btnPrimary}>
            Add New Customer
          </Link>
        </div>

        {searched && (
          <div style={{ marginTop: "0.875rem", display: "grid", gap: "0.5rem" }}>
            {results.length === 0 ? (
              <div style={{ fontSize: "0.8125rem", color: "var(--text-dim)" }}>No matching users found.</div>
            ) : (
              results.slice(0, 6).map((u) => (
                <Link
                  key={u.id}
                  href={`/admin/users?userId=${u.id}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    padding: "0.625rem 0.75rem",
                    border: "1px solid var(--border-soft)",
                    borderRadius: "0.5rem",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <span style={{ fontWeight: 600, color: "var(--accent)" }}>
                    {(u.first_name ?? "") + " " + (u.last_name ?? "")}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                    {u.customer_code ? `${u.customer_code} • ` : ""}{u.email ?? u.mobile_number ?? "—"}
                  </span>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
