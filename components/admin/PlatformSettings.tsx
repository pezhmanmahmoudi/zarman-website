"use client";
import { useCallback } from "react";
import { getSystemSettings, getPromoCodes } from "@/app/actions/admin.actions";
import { SystemSettingsForm } from "./SystemSettingsForm";
import { AdminRefreshScope } from "./ui/AdminRefreshScope";
import { AdminRefreshNotice } from "./ui/AdminRefreshNotice";
import { useAdminSnapshot } from "./ui/useAdminSnapshot";

type SettingsSnapshot = { settings: Awaited<ReturnType<typeof getSystemSettings>>; promoCodes: Awaited<ReturnType<typeof getPromoCodes>> };
export function PlatformSettings({ initialData }: { initialData: SettingsSnapshot }) {
  const load = useCallback(async () => {
    const [settings, promoCodes] = await Promise.all([getSystemSettings(), getPromoCodes()]);
    return { settings, promoCodes };
  }, []);
  const { data, refresh, refreshing, refreshError } = useAdminSnapshot(initialData, load);
  return <AdminRefreshScope refresh={refresh}>
    <AdminRefreshNotice error={refreshError} refreshing={refreshing} onRefresh={refresh} />
    <SystemSettingsForm initialSettings={data.settings} initialCodes={data.promoCodes} />
  </AdminRefreshScope>;
}
