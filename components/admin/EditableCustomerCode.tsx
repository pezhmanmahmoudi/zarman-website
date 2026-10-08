"use client";

import React, { useState } from "react";
import { updateCustomerCode } from "@/app/actions/admin.actions";
import { AdminFieldEditor } from "@/components/admin/ui/AdminFieldEditor";
import { useAdminRefresh } from "@/components/admin/ui/useAdminRefresh";

interface EditableCustomerCodeProps {
  userId: string;
  currentCode: string | null;
}

export function EditableCustomerCode({ userId, currentCode }: EditableCustomerCodeProps) {
  const refreshAdmin = useAdminRefresh();
  const [savedCode, setSavedCode] = useState<{ source: string | null; value: string | null } | null>(null);
  const displayCode = savedCode?.source === currentCode ? savedCode.value : currentCode;

  return (
    <AdminFieldEditor
      value={displayCode ?? ""}
      displayValue={displayCode || "—"}
      label="Customer code"
      description="Update the code used to identify this customer. Leave it blank to clear the code."
      placeholder="CZ0001 or VIP-2026-01"
      maxLength={32}
      variant="customer"
      onSave={async value => {
        const code = value.trim();
        const result = await updateCustomerCode(userId, code);
        if ("error" in result && result.error) throw new Error(result.error);
        setSavedCode({ source: currentCode, value: code || null });
        refreshAdmin();
      }}
    />
  );
}
