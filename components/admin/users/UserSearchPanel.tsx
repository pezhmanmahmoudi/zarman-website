"use client";

import React from "react";
import { Search } from "lucide-react";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import formStyles from "@/styles/admin/AdminForms.module.css";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";

export type UserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_number: string | null;
  kyc_status: string | null;
  created_at: string;
  customer_code?: string | null;
};

interface UserSearchPanelProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  isSearching: boolean;
  searched: boolean;
  results: UserRow[];
  onViewProfile: (userId: string) => void;
  isLoadingProfile: boolean;
}

export function UserSearchPanel({
  query,
  onQueryChange,
  onSearch,
  isSearching,
  searched,
  results,
  onViewProfile,
  isLoadingProfile,
}: UserSearchPanelProps) {
  return (
    <div className={cardStyles.panel}>
      <div className={cardStyles.panelBody}>
        <div className={formStyles.searchRow}>
          <div className={formStyles.searchInputWrap}>
            <Search size={18} className={formStyles.searchIcon} />
            <input
              type="text"
              className={`${formStyles.input} ${formStyles.inputWithIcon}`}
              placeholder="Enter name, email, or phone number..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
            />
          </div>
          <button
            type="button"
            className={formStyles.btnPrimary}
            onClick={onSearch}
            disabled={isSearching || !query.trim()}
          >
            {isSearching ? "Searching…" : "Find User"}
          </button>
        </div>
      </div>

      {searched && (
        <div className={`${tableStyles.tableWrap} ${tableStyles.tableWrapTopBorder}`}>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Customer Info</th>
                <th>Contact</th>
                <th>KYC Status</th>
                <th>Joined</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className={`${cardStyles.emptyState} ${cardStyles.emptyStateCompact}`}>
                      <div className={cardStyles.emptyStateText}>
                        No users found matching &ldquo;{query}&rdquo;
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                results.map((u) => (
                  <tr key={u.id}>
                    <td className={tableStyles.cellStrong}>
                      {u.first_name} {u.last_name}
                      {u.customer_code && (
                        <div className={tableStyles.cellCodeMini}>
                          ({u.customer_code})
                        </div>
                      )}
                    </td>
                    <td>
                      <div className={`${tableStyles.cellDim} ${tableStyles.cellSmallEmail}`}>
                        {u.email ?? "—"}
                      </div>
                      <div className={`${tableStyles.cellMono} ${tableStyles.cellDim} ${tableStyles.cellSmallPhone}`}>
                        {u.mobile_number ?? "—"}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={u.kyc_status} />
                    </td>
                    <td className={`${tableStyles.cellMono} ${tableStyles.cellSmall} ${tableStyles.cellDim}`}>
                      {new Date(u.created_at).toLocaleDateString("en-AU")}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => onViewProfile(u.id)}
                        disabled={isLoadingProfile}
                        className={`${formStyles.btnSecondary} ${formStyles.btnSecondaryCompact}`}
                      >
                        Open Profile
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
