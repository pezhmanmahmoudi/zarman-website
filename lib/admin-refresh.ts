export function reloadAdminPage(delayMs = 0) {
  const reload = () => window.location.reload();
  if (delayMs > 0) {
    window.setTimeout(reload, delayMs);
    return;
  }
  reload();
}