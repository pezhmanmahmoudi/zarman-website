"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTransactionReferenceCode } from "@/app/actions/admin.actions";
import { AdminFieldEditor } from "@/components/admin/ui/AdminFieldEditor";

interface EditableReferenceCodeProps {
  transactionId: string | number;
  currentCode: string | null;
}

export function EditableReferenceCode({ transactionId, currentCode }: EditableReferenceCodeProps) {
  const [savedCode, setSavedCode] = useState<{ source: string | null; value: string | null } | null>(null);
  const router = useRouter();
  const displayCode = savedCode?.source === currentCode ? savedCode.value : currentCode;

  return (
    <AdminFieldEditor
      value={displayCode ?? ""}
      displayValue={displayCode || "—"}
      label="Reference code"
      description="Update the reference used to identify this transaction. Leave it blank to clear the code."
      placeholder="ZE12345"
      maxLength={10}
      transformInput={value => value.toUpperCase()}
      onSave={async value => {
        const code = value.trim().toUpperCase();
        const result = await updateTransactionReferenceCode(transactionId, code);
        if ("error" in result && result.error) throw new Error(result.error);
        setSavedCode({ source: currentCode, value: code || null });
        router.refresh();
      }}
    />
  );
}
