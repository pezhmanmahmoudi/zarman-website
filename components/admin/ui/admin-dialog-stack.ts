// One lock for all open dialogs. Closing an underlying dialog must not unlock
// the page, or move focus out of the dialog that is still active.
const dialogs: HTMLDialogElement[] = [];
const listeners = new Set<() => void>();
let restoreScroll: (() => void) | undefined;

export const getActiveAdminDialog = () => dialogs[dialogs.length - 1] ?? null;
export const getServerAdminDialog = () => null;
export function subscribeAdminDialogs(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function registerAdminDialog(dialog: HTMLDialogElement) {
  if (!dialogs.length) {
    const styles = [document.documentElement.style, document.body.style];
    const previous = styles.map(style => ({
      value: style.getPropertyValue("overflow"),
      priority: style.getPropertyPriority("overflow"),
    }));
    styles.forEach(style => style.setProperty("overflow", "hidden"));
    restoreScroll = () => styles.forEach((style, index) => {
      if (previous[index].value) {
        style.setProperty("overflow", previous[index].value, previous[index].priority);
      } else {
        style.removeProperty("overflow");
      }
    });
  }
  dialogs.push(dialog);
  listeners.forEach(listener => listener());
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const index = dialogs.indexOf(dialog);
    if (index !== -1) dialogs.splice(index, 1);
    if (!dialogs.length) {
      restoreScroll?.();
      restoreScroll = undefined;
    }
    listeners.forEach(listener => listener());
  };
}
