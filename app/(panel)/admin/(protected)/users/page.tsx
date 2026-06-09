import { getFinanceConfig } from "@/lib/finance-config";
import { UsersPageClient } from "@/components/admin/users/UsersPageClient";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const [financeConfig, params] = await Promise.all([
    getFinanceConfig(),
    searchParams,
  ]);
  return <UsersPageClient financeConfig={financeConfig} initialUserId={params.userId} />;
}
