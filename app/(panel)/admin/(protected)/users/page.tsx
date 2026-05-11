import { getFinanceConfig } from "@/lib/finance-config";
import { UsersPageClient } from "@/components/admin/users/UsersPageClient";

export default async function UsersPage() {
  const financeConfig = await getFinanceConfig();
  return <UsersPageClient financeConfig={financeConfig} />;
}
