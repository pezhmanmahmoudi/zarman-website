"use client";

import React from "react";
import { Search } from "lucide-react";
import styles from "@/styles/admin/AdminWorkspace.module.css";
import { AdminDataTable, AdminTableCell, AdminTableDate, AdminTableIdentity, AdminTableRow } from "@/components/admin/ui/AdminDataTable";
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
  return <section className={styles.panel} aria-label="Customer directory">
    <div className={styles.historyControls}>
      <form className={styles.searchForm} role="search" onSubmit={event => { event.preventDefault(); if (!isSearching && query.trim()) onSearch(); }}>
        <label className={styles.search}><Search size={16} aria-hidden="true" /><span className={styles.srOnly}>Find customers by name, email or phone</span>
          <input type="search" placeholder="Search name, email or phone" value={query} onChange={event => onQueryChange(event.target.value)} />
        </label>
        <button type="submit" className={styles.action} disabled={isSearching || !query.trim()}>{isSearching ? "Searching..." : "Search"}</button>
      </form>
      {searched && <span className={styles.recordCount}>{results.length} results</span>}
    </div>
    {searched ? <AdminDataTable label="Customers" columns={[
      { key: "customer", label: "Customer" }, { key: "contact", label: "Contact" }, { key: "status", label: "Verification" },
      { key: "joined", label: "Joined" }, { key: "actions", label: "Actions", actions: true },
    ]} empty={!results.length && <strong>No customers found matching &ldquo;{query}&rdquo;.</strong>}>
      {results.map(user => <AdminTableRow key={user.id}>
        <AdminTableCell kind="primary"><AdminTableIdentity name={[user.first_name, user.last_name].filter(Boolean).join(" ") || "Unnamed customer"} detail={user.customer_code} /></AdminTableCell>
        <AdminTableCell label="Contact"><bdi>{user.email || "—"}</bdi><span className={styles.detail}><bdi>{user.mobile_number}</bdi></span></AdminTableCell>
        <AdminTableCell label="Verification"><StatusBadge status={user.kyc_status} /></AdminTableCell>
        <AdminTableCell label="Joined"><AdminTableDate value={user.created_at} /></AdminTableCell>
        <AdminTableCell kind="actions"><button type="button" className={styles.action} disabled={isLoadingProfile} onClick={() => onViewProfile(user.id)}>Open profile</button></AdminTableCell>
      </AdminTableRow>)}
    </AdminDataTable> : <div className={styles.empty}><strong>Find a customer</strong><p>Search to open their profile and accounts.</p></div>}
  </section>;
}
