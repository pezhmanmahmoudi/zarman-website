"use client";

import React, { useId, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";
import { ADMIN_PAGE_SIZES, adminPaginationHref, getAdminPaginationState, parseAdminPageJump } from "@/lib/admin-pagination";
import styles from "./AdminPagination.module.css";

interface AdminPaginationProps {
  currentPage: number;
  totalCount: number;
  pageSize: number;
  allowPageSizeChange?: boolean;
  label?: string;
}

function PageJump({ currentPage, totalPages, disabled, onNavigate }: {
  currentPage: number;
  totalPages: number;
  disabled: boolean;
  onNavigate: (page: number) => void;
}) {
  const inputId = useId();
  const [value, setValue] = useState(totalPages ? String(Math.min(currentPage, totalPages)) : "");
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) return;
    const target = parseAdminPageJump(value, totalPages);
    if (target === null) {
      setError(`Enter a whole page number from 1 to ${totalPages}.`);
      return;
    }
    setError("");
    setValue(String(target));
    onNavigate(target);
  };

  return (
    <form className={styles.jumpForm} onSubmit={submit} noValidate>
      <label htmlFor={inputId}>Go to page</label>
      <div className={styles.jumpControls}>
        <input
          id={inputId}
          name="page"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="go"
          value={value}
          onChange={event => { setValue(event.target.value); setError(""); }}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={styles.pageInput}
        />
        <button type="submit" disabled={disabled} className={styles.goButton}>Go</button>
      </div>
      {error && <span id={`${inputId}-error`} className={styles.error} role="alert">{error}</span>}
    </form>
  );
}

export function AdminPagination({ currentPage, totalCount, pageSize, allowPageSizeChange = true, label = "Pagination" }: AdminPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const rowSizeId = useId();
  const { page, count, totalPages, hasPageLimit, outOfRange, start, end, previousPage } = getAdminPaginationState(currentPage, totalCount, pageSize);
  const query = searchParams.toString();
  const noPages = totalPages === 0;
  const number = (value: number) => value.toLocaleString("en-AU");

  const navigate = (target: number) => {
    if (isPending || noPages) return;
    const nextPage = Math.max(1, Math.min(totalPages, target));
    if (nextPage === page) return;
    startTransition(() => router.push(adminPaginationHref(pathname, query, nextPage), { scroll: false }));
  };

  const changePageSize = (value: string) => {
    if (isPending || Number(value) === pageSize) return;
    startTransition(() => router.push(adminPaginationHref(pathname, query, 1, Number(value)), { scroll: false }));
  };

  return (
    <nav className={styles.footer} aria-label={label} aria-busy={isPending}>
      <div className={styles.summary}>
        <span className={styles.recordCount}>
          {noPages ? "No records" : outOfRange ? `No records on this page · ${number(count)} total` : `${number(start)}–${number(end)} of ${number(count)}`}
        </span>
        {allowPageSizeChange && (
          <div className={styles.rowSize}>
            <label htmlFor={rowSizeId}>Rows per page</label>
            <select id={rowSizeId} value={String(pageSize)} onChange={event => changePageSize(event.target.value)} disabled={isPending}>
              {ADMIN_PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className={styles.navigation}>
        <div className={styles.pageControls}>
          <div className={styles.arrows}>
            <button type="button" className={`${styles.iconButton} ${styles.boundaryButton}`} onClick={() => navigate(1)} disabled={isPending || noPages || page <= 1} aria-label="First page" title="First page"><ChevronFirst size={17} /></button>
            <button type="button" className={styles.iconButton} onClick={() => navigate(previousPage)} disabled={isPending || noPages || page <= 1} aria-label="Previous page" title="Previous page"><ChevronLeft size={17} /></button>
          </div>
          <span className={styles.currentPage} role="status" aria-live="polite">
            {isPending ? "Loading…" : outOfRange ? `Page ${number(page)} unavailable` : `Page ${noPages ? 0 : number(page)} of ${number(totalPages)}`}
          </span>
          <div className={styles.arrows}>
            <button type="button" className={styles.iconButton} onClick={() => navigate(page + 1)} disabled={isPending || noPages || page >= totalPages} aria-label="Next page" title="Next page"><ChevronRight size={17} /></button>
            <button type="button" className={`${styles.iconButton} ${styles.boundaryButton}`} onClick={() => navigate(totalPages)} disabled={isPending || noPages || page >= totalPages} aria-label="Last page" title="Last page"><ChevronLast size={17} /></button>
          </div>
        </div>
        <PageJump key={`${page}-${totalPages}-${query}`} currentPage={page} totalPages={totalPages} disabled={isPending || noPages} onNavigate={navigate} />
      </div>
      {outOfRange && <p className={styles.rangeNotice}>Choose a page from 1 to {number(totalPages)} to return to your results.</p>}
      {hasPageLimit && <p className={styles.rangeNotice}>The first {number(totalPages)} pages are available. Narrow your filters to find more specific records.</p>}
    </nav>
  );
}
