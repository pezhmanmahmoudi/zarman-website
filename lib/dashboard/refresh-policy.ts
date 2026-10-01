/** Data polling only: expiry clocks, animations and explicit user actions are independent. */
export const DASHBOARD_AUTO_REFRESH_MS = 5 * 60 * 1000;

export function dashboardRefreshDue(lastRefresh: number, now = Date.now()) {
  return now - lastRefresh >= DASHBOARD_AUTO_REFRESH_MS;
}
