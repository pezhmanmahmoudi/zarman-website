/* eslint-disable @typescript-eslint/no-require-imports -- Offline dialog lifecycle fault injection. */
const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { dashboardHarness } = require("./helpers/dashboard-harness.cjs");

function styleDeclaration() {
  const values = new Map();
  return {
    getPropertyValue: name => values.get(name) ?? "",
    getPropertyPriority: () => "",
    setProperty: (name, value) => values.set(name, value),
    removeProperty: name => values.delete(name),
  };
}
function withDocument(work) {
  const previous = global.document;
  global.document = {
    documentElement: { style: styleDeclaration() },
    body: { isConnected: true, style: styleDeclaration() },
  };
  try { return work(global.document); }
  finally { if (previous === undefined) delete global.document; else global.document = previous; }
}
function toastHarness({ hydrating = false } = {}) {
  const pendingEffects = [];
  const refs = [];
  const h = dashboardHarness({ mocks: {
    react: { ...React,
      useSyncExternalStore: (_subscribe, snapshot, serverSnapshot) => hydrating ? serverSnapshot() : snapshot(),
      useRef: () => { const ref = { current: null }; refs.push(ref); return ref; },
      useEffect: effect => pendingEffects.push(effect),
    },
    "react-dom": { createPortal: (element, target) => {
      assert.equal(target.isConnected, true, "notifications must never use a detached host");
      // Simulate the DOM ref that the previous imperative implementation used.
      const node = {
        get isConnected() { return target.isConnected; },
        showPopover() {
          if (!this.isConnected) throw new DOMException("Invalid on disconnected popover elements", "InvalidStateError");
        },
      };
      if (element.props.ref) element.props.ref.current = node;
      return { element, target };
    } },
  } });
  return { h, pendingEffects, ...h.load("components/admin/ui/admin-dialog-stack.ts"),
    Toast: h.load("components/admin/ui/AdminToast.tsx").AdminToast };
}
const success = { visible: true, type: "success", message: "KYC archived.", onClose() {} };

test("a notification survives the dialog being detached between commit and effects", () => withDocument(document => {
  const ui = toastHarness();
  const confirmation = { isConnected: true, open: true };
  const unregister = ui.registerAdminDialog(confirmation);
  const inside = ui.Toast(success);
  assert.equal(inside.target, confirmation);
  confirmation.isConnected = false;
  assert.doesNotThrow(() => ui.pendingEffects.splice(0).forEach(effect => effect()));
  const outside = ui.Toast(success);
  assert.equal(outside.target, document.body);
  assert.equal(outside.element.props.children.props.children[1].props.children, "KYC archived.");
  unregister();
}));

test("toast follows nested dialogs, ignores closed hosts and returns to the body", () => withDocument(document => {
  const ui = toastHarness();
  const first = { isConnected: true, open: true };
  const second = { isConnected: true, open: true };
  const closeFirst = ui.registerAdminDialog(first);
  const closeSecond = ui.registerAdminDialog(second);
  assert.equal(ui.Toast(success).target, second);
  second.open = false;
  assert.equal(ui.Toast(success).target, first);
  closeSecond();
  first.isConnected = false;
  assert.equal(ui.Toast(success).target, document.body);
  closeFirst();
  assert.equal(document.body.style.getPropertyValue("overflow"), "");
  assert.equal(ui.Toast(success).target, document.body);
}));

test("visible notifications have identical empty SSR and first hydration output", () => {
  const h = dashboardHarness({ mocks: {
    react: React,
    "react-dom": { createPortal() { throw Error("Portals must wait for hydration"); } },
  } });
  const Toast = h.load("components/admin/ui/AdminToast.tsx").AdminToast;
  assert.equal(renderToStaticMarkup(React.createElement(Toast, success)), "");
  withDocument(() => {
    const initialClient = toastHarness({ hydrating: true });
    assert.equal(initialClient.Toast(success), null);
    // This is SSR with document present; it still uses the server snapshot.
    assert.equal(renderToStaticMarkup(React.createElement(Toast, success)), "");
  });
});

test("toast works without Popover API, keeps live announcements and supports dismissal", () => withDocument(() => {
  const ui = toastHarness();
  let dismissed = 0;
  const output = ui.Toast({ ...success, type: "error", message: "خطا در ذخیره‌سازی", onClose: () => dismissed++ });
  assert.equal(output.element.props.role, "alert");
  assert.equal(output.element.props["aria-live"], "assertive");
  assert.equal(output.element.props["aria-atomic"], "true");
  assert.equal(output.element.props.popover, undefined);
  const toast = output.element.props.children;
  assert.equal(toast.props.dir, "rtl");
  const dismiss = toast.props.children[2];
  assert.equal(dismiss.props["aria-label"], "بستن پیام");
  dismiss.props.onClick();
  assert.equal(dismissed, 1);
  assert.equal(ui.Toast(success).element.props.role, "status");
  assert.equal(ui.Toast({ ...success, visible: false }), null);
}));

test("dialog layout cleanup releases its portal host and tolerates Strict Mode replay", () => withDocument(document => {
  const previousHTMLElement = global.HTMLElement;
  global.HTMLElement = class {};
  try {
    let refIndex = 0, layoutEffect;
    const dialog = { isConnected: true, open: false,
      showModal() { assert.equal(this.isConnected, true); this.open = true; },
      close() { this.open = false; }, querySelector: () => null,
    };
    const refs = [{ current: dialog }, { current: { focus() {} } }, { current: false }];
    const h = dashboardHarness({ mocks: {
      react: { ...React, useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
        useRef: () => refs[refIndex++], useLayoutEffect: effect => { layoutEffect = effect; },
      },
      "react-dom": { createPortal: element => element },
    } });
    const stack = h.load("components/admin/ui/admin-dialog-stack.ts");
    const { AdminDialog } = h.load("components/admin/ui/AdminDialog.tsx");
    AdminDialog({ open: true, children: "Confirm", onClose() {} });
    let cleanup = layoutEffect();
    assert.equal(stack.getActiveAdminDialog(), dialog);
    cleanup();
    assert.equal(stack.getActiveAdminDialog(), null);
    assert.equal(document.body.style.getPropertyValue("overflow"), "");
    cleanup = layoutEffect();
    assert.equal(stack.getActiveAdminDialog(), dialog);
    dialog.isConnected = false;
    assert.equal(stack.getActiveAdminDialog(), null);
    assert.doesNotThrow(cleanup);
    assert.equal(layoutEffect(), undefined, "never reopen a removed dialog");
  } finally {
    if (previousHTMLElement === undefined) delete global.HTMLElement;
    else global.HTMLElement = previousHTMLElement;
  }
}));

test("a shared result notification survives the row feedback hook being unmounted", async () => {
  const provider = dashboardHarness({ mocks: { "./AdminToast": { AdminToast: () => null } } });
  const { AdminFeedbackProvider, AdminFeedbackContext } = provider.load("components/admin/ui/AdminFeedbackProvider.tsx");
  let tree = provider.render(AdminFeedbackProvider, { children: "row" });
  provider.effects();
  assert.ok(AdminFeedbackContext);
  const hook = dashboardHarness({ mocks: { "./AdminFeedbackProvider": {
    AdminFeedbackContext: { _currentValue: tree.props.value },
  } } });
  const { useAdminFeedback } = hook.load("components/admin/ui/useAdminFeedback.ts");
  hook.render(useAdminFeedback, {}); hook.effects();
  hook.render(useAdminFeedback, {}).showToast({ type: "success", message: "KYC archived.", duration: 10000 });
  hook.cleanup();
  tree = provider.render(AdminFeedbackProvider, { children: null });
  const notification = React.Children.toArray(tree.props.children)[0];
  assert.equal(notification.props.visible, true);
  assert.equal(notification.props.message, "KYC archived.");
  provider.cleanup();
});

test("confirm and cancel callbacks cannot replay a completed or cancelled archive", async () => {
  const h = dashboardHarness({ mocks: { "./AdminFeedbackProvider": { AdminFeedbackContext: { _currentValue: null } } } });
  const { useAdminFeedback } = h.load("components/admin/ui/useAdminFeedback.ts");
  let complete;
  let writes = 0;
  const pending = new Promise(resolve => { complete = resolve; });
  let feedback = h.render(useAdminFeedback, {}); h.effects();
  feedback.confirm({ title: "Archive", message: "Confirm", onConfirm: async () => { writes++; await pending; } });
  feedback = h.render(useAdminFeedback, {});
  const oldConfirm = feedback.dialogProps.onConfirm;
  const running = oldConfirm();
  await oldConfirm();
  feedback.dialogProps.onCancel(); // loading has not rendered yet
  feedback.confirm({ title: "Other", message: "Other", onConfirm: () => { writes += 100; } });
  assert.equal(h.render(useAdminFeedback, {}).dialogProps.open, true);
  assert.equal(h.render(useAdminFeedback, {}).dialogProps.title, "Archive");
  complete(); await running;
  await oldConfirm();
  assert.equal(writes, 1);
  feedback = h.render(useAdminFeedback, {});
  assert.equal(feedback.dialogProps.open, false);
  feedback.confirm({ title: "Archive again", message: "Confirm", onConfirm: () => { writes++; } });
  feedback = h.render(useAdminFeedback, {});
  feedback.dialogProps.onCancel();
  await feedback.dialogProps.onConfirm();
  assert.equal(writes, 1);
  h.cleanup();
});
