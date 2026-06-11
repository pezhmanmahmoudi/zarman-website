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
    <div className={`${cardStyles.panel} ${cardStyles.panelMb1}`}>
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
          <div className={formStyles.searchResultList}>
            {results.length === 0 ? (
              <div className={formStyles.searchResultEmpty}>No matching users found.</div>
            ) : (
              results.slice(0, 6).map((u) => (
                <Link
                  key={u.id}
                  href={`/admin/users?userId=${u.id}`}
                  className={formStyles.searchResultItem}
                >
                  <span className={formStyles.searchResultName}>
                    {(u.first_name ?? "") + " " + (u.last_name ?? "")}
                  </span>
                  <span className={formStyles.searchResultMeta}>
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
