"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAdminTransition as useTransition } from "@/components/admin/ui/useAdminTransition";
import { AdminRefreshScope } from "@/components/admin/ui/AdminRefreshScope";
import { AdminRefreshNotice } from "@/components/admin/ui/AdminRefreshNotice";
import styles from "@/styles/admin/AdminWorkspace.module.css";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import { searchUsers, getUserFinancialProfile, getActiveBankAccountsForAdmin } from "@/app/actions/admin.actions";
import { calcLoyaltyDiscountPct, type FinanceConfig } from "@/lib/pricing";
import { UserSearchPanel, type UserRow } from "@/components/admin/users/UserSearchPanel";
import { UserFinancialStats } from "@/components/admin/users/UserFinancialStats";
import { UserKycManager } from "@/components/admin/users/UserKycManager";
import { UserTransactionTimeline } from "@/components/admin/users/UserTransactionTimeline";
import { UserFeedbackHistory } from "@/components/admin/users/UserFeedbackHistory";
import { UserRecipientsPanel } from "@/components/admin/users/UserRecipientsPanel";
import { AssistedOnboardingPanel } from "@/components/admin/users/AssistedOnboardingPanel";

type FinancialProfile = Awaited<ReturnType<typeof getUserFinancialProfile>>;

export function UsersPageClient({
  financeConfig,
  initialUserId,
}: {
  financeConfig: FinanceConfig;
  initialUserId?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserRow[]>([]);
  const [selectedUser, setSelectedUser] = useState<FinancialProfile | null>(null);
  const [bankAccounts, setBankAccounts] = useState<Awaited<ReturnType<typeof getActiveBankAccountsForAdmin>>>([]);
  const [searched, setSearched] = useState(false);
  const [readErrors, setReadErrors] = useState({ profile: false, search: false, accounts: false });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshRequest = useRef(0);
  const accountRequest = useRef(0);
  const profileRequest = useRef(0);
  const searchRequest = useRef(0);

  const [isSearching, startSearch] = useTransition();
  const [isLoading, startLoad] = useTransition();

  const loadProfile = useCallback(async (userId: string) => {
    const version = ++profileRequest.current;
    try {
      const profile = await getUserFinancialProfile(userId);
      if (version !== profileRequest.current) return;
      setSelectedUser(profile);
      setReadErrors(previous => ({ ...previous, profile: false }));
    } catch (error) {
      console.error("[admin customer profile]", error);
      if (version === profileRequest.current) setReadErrors(previous => ({ ...previous, profile: true }));
    }
  }, []);

  const loadBankAccounts = useCallback(async () => {
    const version = ++accountRequest.current;
    try {
      const accounts = await getActiveBankAccountsForAdmin();
      if (version !== accountRequest.current) return;
      setBankAccounts(accounts);
      setReadErrors(previous => ({ ...previous, accounts: false }));
    } catch (error) {
      console.error("[admin customer accounts]", error);
      if (version === accountRequest.current) setReadErrors(previous => ({ ...previous, accounts: true }));
    }
  }, []);

  // Auto-load profile when navigated here with a userId query param
  useEffect(() => {
    if (!initialUserId) return;
    startLoad(async () => {
      await loadProfile(initialUserId);
    });
  }, [initialUserId, loadProfile]);

  useEffect(() => {
    startLoad(async () => {
      await loadBankAccounts();
    });
  }, [loadBankAccounts]);

  const handleSearch = () => {
    if (!query.trim()) return;
    startSearch(async () => {
      const version = ++searchRequest.current;
      try {
        const data = await searchUsers(query);
        if (version !== searchRequest.current) return;
        profileRequest.current += 1;
        setResults(data as UserRow[]);
        setSearched(true);
        setSelectedUser(null);
        setReadErrors(previous => ({ ...previous, search: false }));
      } catch (error) {
        console.error("[admin customer search]", error);
        if (version === searchRequest.current) setReadErrors(previous => ({ ...previous, search: true }));
      }
    });
  };

  const handleViewProfile = (userId: string) => {
    startLoad(async () => {
      await loadProfile(userId);
    });
  };

  const handleCreated = (userId: string) => {
    setQuery("");
    setResults([]);
    setSearched(false);
    handleViewProfile(userId);
  };

  const handleTimelineTransactionCreated = () => {
    if (!selectedUser?.profile?.id) return;
    handleViewProfile(selectedUser.profile.id);
  };

  const handleRecipientCreated = () => {
    if (!selectedUser?.profile?.id) return;
    handleViewProfile(selectedUser.profile.id);
  };

  const handleProfileUpdated = () => {
    if (!selectedUser?.profile?.id) return;
    handleViewProfile(selectedUser.profile.id);
    // Refresh search results so KYC badge updates inline
    refreshSearchResults();
  };

  const refreshSearchResults = async () => {
    if (!query.trim() || !searched) return;
    const version = ++searchRequest.current;
    try {
      const data = await searchUsers(query);
      if (version !== searchRequest.current) return;
      setResults(data as UserRow[]);
      setReadErrors(previous => ({ ...previous, search: false }));
    } catch (error) {
      console.error("[admin customer search refresh]", error);
      if (version === searchRequest.current) setReadErrors(previous => ({ ...previous, search: true }));
    }
  };

  const refreshCustomer = async () => {
    const version = ++refreshRequest.current;
    const userId = selectedUser?.profile?.id ?? initialUserId;
    setIsRefreshing(true);
    try {
      await Promise.all([
        userId ? loadProfile(userId) : Promise.resolve(),
        refreshSearchResults(),
        loadBankAccounts(),
      ]);
    } finally {
      if (version === refreshRequest.current) setIsRefreshing(false);
    }
  };

  const loyaltyDiscountPct = selectedUser
    ? calcLoyaltyDiscountPct(selectedUser.approvedVolume, financeConfig)
    : 0;
  const selectedUserRecord = selectedUser as (typeof selectedUser & { recipients?: unknown[] }) | null;

  return (
    <AdminRefreshScope refresh={refreshCustomer}>
      <div className={shellStyles.topBar}>
        <span className={shellStyles.pageTitle}>Customers</span>
      </div>

      <div className={shellStyles.pageContent}>
        <div className={styles.header}><div><h1>Customers</h1><p>Find a customer and manage their profile, accounts and transfers.</p></div></div>
        <AdminRefreshNotice error={Object.values(readErrors).some(Boolean)} refreshing={isRefreshing || isLoading || isSearching} onRefresh={refreshCustomer} />

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

        <AssistedOnboardingPanel onCreated={handleCreated} />

        {isLoading && (
          <div className={shellStyles.loadingState}>Loading complete profile data…</div>
        )}

        {selectedUser && (
          <div className={`${cardStyles.panelBodyStack} ${cardStyles.fadeIn}`}>
            <UserFinancialStats
              approvedVolume={selectedUser.approvedVolume}
              approvedCount={selectedUser.approvedCount}
              loyaltyDiscountPct={loyaltyDiscountPct}
              currentRates={selectedUser.currentRates}
            />
            <UserKycManager
              key={`${selectedUser.profile?.id ?? "unknown"}-${(selectedUser.profile as Record<string, unknown> | null)?.updated_at ?? ""}`}
              profile={selectedUser.profile}
              onProfileUpdated={handleProfileUpdated}
              onKycStatusCommitted={status => {
                const userId = selectedUser.profile?.id;
                if (!userId) return;
                setSelectedUser((previous: FinancialProfile | null) => previous?.profile?.id === userId
                  ? { ...previous, profile: { ...previous.profile, kyc_status: status } }
                  : previous);
                setResults(previous => previous.map(row => row.id === userId ? { ...row, kyc_status: status } : row));
              }}
            />
            <UserTransactionTimeline
              userId={selectedUser.profile?.id}
              transactions={selectedUser.transactions}
              recipients={selectedUserRecord?.recipients ?? []}
              bankAccounts={bankAccounts}
              onTransactionCreated={handleTimelineTransactionCreated}
            />
            <UserRecipientsPanel
              userId={selectedUser.profile?.id}
              recipients={selectedUserRecord?.recipients ?? []}
              onRecipientCreated={handleRecipientCreated}
            />
            <UserFeedbackHistory testimonials={selectedUser.testimonials} />
          </div>
        )}
      </div>
    </AdminRefreshScope>
  );
}
