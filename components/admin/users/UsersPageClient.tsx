"use client";

import React, { useState, useTransition } from "react";
import { Users } from "lucide-react";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import { searchUsers, getUserFinancialProfile } from "@/app/actions/admin.actions";
import { calcLoyaltyDiscountPct, type FinanceConfig } from "@/lib/pricing";
import { UserSearchPanel, type UserRow } from "@/components/admin/users/UserSearchPanel";
import { UserFinancialStats } from "@/components/admin/users/UserFinancialStats";
import { UserKycManager } from "@/components/admin/users/UserKycManager";
import { UserTransactionTimeline } from "@/components/admin/users/UserTransactionTimeline";
import { UserFeedbackHistory } from "@/components/admin/users/UserFeedbackHistory";

type FinancialProfile = Awaited<ReturnType<typeof getUserFinancialProfile>>;

export function UsersPageClient({ financeConfig }: { financeConfig: FinanceConfig }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserRow[]>([]);
  const [selectedUser, setSelectedUser] = useState<FinancialProfile | null>(null);
  const [searched, setSearched] = useState(false);

  const [isSearching, startSearch] = useTransition();
  const [isLoading, startLoad] = useTransition();

  const handleSearch = () => {
    if (!query.trim()) return;
    startSearch(async () => {
      const data = await searchUsers(query);
      setResults(data as UserRow[]);
      setSearched(true);
      setSelectedUser(null);
    });
  };

  const handleViewProfile = (userId: string) => {
    startLoad(async () => {
      const profile = await getUserFinancialProfile(userId);
      setSelectedUser(profile);
    });
  };

  const loyaltyDiscountPct = selectedUser
    ? calcLoyaltyDiscountPct(selectedUser.approvedVolume, financeConfig)
    : 0;

  return (
    <>
      <div className={shellStyles.topBar}>
        <span className={shellStyles.pageTitle}>Customer 360 CRM</span>
      </div>

      <div className={shellStyles.pageContent}>
        <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
          <div>
            <h1 className={`${cardStyles.sectionTitle} ${cardStyles.sectionTitleWithIcon}`}>
              <span className={cardStyles.sectionTitleIconAccent}>
                <Users size={24} strokeWidth={2.5} />
              </span>
              User Directory &amp; Search
            </h1>
            <p className={cardStyles.sectionDesc}>
              Search by name, email, or phone to manage KYC, approve transactions, and moderate feedback from one place.
            </p>
          </div>
        </div>

        <UserSearchPanel
          query={query}
          onQueryChange={setQuery}
          onSearch={handleSearch}
          isSearching={isSearching}
          searched={searched}
          results={results}
          onViewProfile={handleViewProfile}
          isLoadingProfile={isLoading}
        />

        {isLoading && (
          <div className={shellStyles.loadingState}>Loading complete profile data…</div>
        )}

        {!isLoading && selectedUser && (
          <div className={`${cardStyles.panelBodyStack} ${cardStyles.fadeIn}`}>
            <UserFinancialStats
              approvedVolume={selectedUser.approvedVolume}
              approvedCount={selectedUser.approvedCount}
              loyaltyDiscountPct={loyaltyDiscountPct}
              currentRates={selectedUser.currentRates}
            />
            <UserKycManager profile={selectedUser.profile} />
            <UserTransactionTimeline transactions={selectedUser.transactions} />
            <UserFeedbackHistory testimonials={selectedUser.testimonials} />
          </div>
        )}
      </div>
    </>
  );
}
