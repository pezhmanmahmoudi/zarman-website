"use client";

import React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import tableStyles from "@/styles/admin/AdminTable.module.css";

interface AdminPaginationProps {
  currentPage: number;
  totalCount: number;
  pageSize: number;
}

export function AdminPagination({ currentPage, totalCount, pageSize }: AdminPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;

  const navigate = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}?${params.toString()}`);
  };

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className={tableStyles.paginationFooter}>
      <button
        className={tableStyles.paginationBtn}
        onClick={() => navigate(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        ← Previous
      </button>
      <span className={tableStyles.paginationNote}>
        {start}–{end} of {totalCount} &nbsp;(Page {currentPage} / {totalPages})
      </span>
      <button
        className={tableStyles.paginationBtn}
        onClick={() => navigate(currentPage + 1)}
        disabled={currentPage >= totalPages}
      >
        Next →
      </button>
    </div>
  );
}
