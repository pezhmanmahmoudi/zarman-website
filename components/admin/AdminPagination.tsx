"use client";

import React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
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

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const navigate = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}?${params.toString()}`);
  };

  const changePageSize = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", value);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  const pageItems: Array<number | "ellipsis-start" | "ellipsis-end"> = [];
  if (totalPages <= 7) {
    for (let page = 1; page <= totalPages; page += 1) pageItems.push(page);
  } else {
    pageItems.push(1);
    if (currentPage > 4) pageItems.push("ellipsis-start");
    const firstVisible = Math.max(2, currentPage - 1);
    const lastVisible = Math.min(totalPages - 1, currentPage + 1);
    for (let page = firstVisible; page <= lastVisible; page += 1) pageItems.push(page);
    if (currentPage < totalPages - 3) pageItems.push("ellipsis-end");
    pageItems.push(totalPages);
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className={tableStyles.paginationFooter} aria-label="Transaction history pagination">
      <div className={tableStyles.paginationSummary}>
        <span className={tableStyles.paginationNote}>{totalCount === 0 ? "No records" : `${start}-${end} of ${totalCount}`}</span>
        <div className={tableStyles.pageSizeControl}>
          <span>Rows</span>
          <SelectBox
            labeledOptions={[
              { label: "10", value: "10" },
              { label: "25", value: "25" },
              { label: "50", value: "50" },
            ]}
            value={String(pageSize)}
            onChange={changePageSize}
            dir="ltr"
            className={tableStyles.pageSizeSelect}
          />
        </div>
      </div>
      <div className={tableStyles.paginationPages}>
        <button className={tableStyles.paginationIconBtn} onClick={() => navigate(1)} disabled={currentPage <= 1} aria-label="First page" title="First page">
          <ChevronFirst size={16} />
        </button>
        <button className={tableStyles.paginationIconBtn} onClick={() => navigate(currentPage - 1)} disabled={currentPage <= 1} aria-label="Previous page" title="Previous page">
          <ChevronLeft size={16} />
        </button>
        {pageItems.map((item) => typeof item === "number" ? (
          <button
            key={item}
            className={`${tableStyles.paginationNumber} ${item === currentPage ? tableStyles.paginationNumberActive : ""}`}
            onClick={() => navigate(item)}
            aria-label={`Page ${item}`}
            aria-current={item === currentPage ? "page" : undefined}
          >
            {item}
          </button>
        ) : (
          <span key={item} className={tableStyles.paginationEllipsis} aria-hidden="true">...</span>
        ))}
        <button className={tableStyles.paginationIconBtn} onClick={() => navigate(currentPage + 1)} disabled={currentPage >= totalPages} aria-label="Next page" title="Next page">
          <ChevronRight size={16} />
        </button>
        <button className={tableStyles.paginationIconBtn} onClick={() => navigate(totalPages)} disabled={currentPage >= totalPages} aria-label="Last page" title="Last page">
          <ChevronLast size={16} />
        </button>
      </div>
    </div>
  );
}
