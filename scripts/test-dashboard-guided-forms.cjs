/* eslint-disable @typescript-eslint/no-require-imports -- Offline guided customer-form checks. */
const { test } = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs");
const React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
const { dashboardHarness } = require("./helpers/dashboard-harness.cjs");
const markup = tree => renderToStaticMarkup(tree);
function elements(tree, predicate) {
  const result = [];
  function walk(node) { if (!React.isValidElement(node)) return; if (predicate(node)) result.push(node); React.Children.forEach(node.props.children, walk); }
  walk(tree); return result;
}
function nodeText(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  return React.isValidElement(node) ? React.Children.toArray(node.props.children).map(nodeText).join("") : "";
}
const base = { id: "synthetic-profile", first_name: "Alex", last_name: "Morgan", mobile_number: "0412345678", email: "alex@example.com", dob: "1990-01-01", country: "Australia", address: "1 Test Street", city: "Sydney", state: "NSW", postcode: "2000", document_type: null, kyc_status: "not_submitted" };
function profileHarness({ locale = "en", profile = base, submit = async () => ({ success: true }), update = async () => ({ success: true }) } = {}) {
  const SelectBox = () => null, DatePicker = () => null, AustralianLocationFields = () => null;
  const h = dashboardHarness({ locale, mocks: {
    "@/components/ui/SelectBox/SelectBox": { SelectBox },
    "@/components/ui/DatePicker/CustomDatePicker": { __esModule: true, default: DatePicker },
    "@/components/dashboard/AustralianLocationFields": { AustralianLocationFields },
    "@/app/actions/kyc.actions": { submitKycData: submit, updatePersonalIdentityData: update, savePersonalData: async () => ({ success: true }) },
  } });
  const { DashboardProfile } = h.load("components/dashboard/DashboardProfile.tsx");
  const render = () => h.render(DashboardProfile, { profile, motionEnabled: false });
  const button = text => elements(render(), node => typeof node.props.onClick === "function" && nodeText(node) === text)[0];
  return { h, render, button, SelectBox, DatePicker, AustralianLocationFields,
    input(name, value) { const element = elements(render(), node => node.type === "input" && node.props.name === name)[0]; assert.ok(element, `Missing field ${name}`); element.props.onChange({ target: { name, value, type: element.props.type || "text" } }); },
    consent(name, checked) { elements(render(), node => node.props.name === name)[0].props.onChange({ target: { name, type: "checkbox", checked } }); },
    stepper() { return elements(render(), node => node.props.stepListLabel !== undefined)[0]; },
  };
}

test("guided identity flow validates each stage, prevents skipping and retains drafts in English and Persian", () => {
  for (const locale of ["en", "fa"]) {
    const h = profileHarness({ locale, profile: { ...base, dob: "" } });
    const next = locale === "en" ? "Continue" : "ادامه", back = locale === "en" ? "Back" : "بازگشت";
    assert.equal(h.stepper().props.currentStep, 1);
    h.stepper().props.onStepChange(3); assert.equal(h.stepper().props.currentStep, 1);
    h.button(next).props.onClick(); assert.equal(h.stepper().props.currentStep, 1); assert.ok(elements(h.render(), node => node.props.id === "profile-error-dob").length);
    elements(h.render(), node => node.type === h.DatePicker)[0].props.onChange("1990-02-03");
    h.button(next).props.onClick(); assert.equal(h.stepper().props.currentStep, 2);
    h.input("address", ""); h.button(next).props.onClick(); assert.equal(h.stepper().props.currentStep, 2);
    h.input("address", "Updated street"); h.button(next).props.onClick(); assert.equal(h.stepper().props.currentStep, 3);
    elements(h.render(), node => node.type === h.SelectBox)[0].props.onChange("passport");
    h.input("passportNumber", "N0123456");
    elements(h.render(), node => node.type === h.DatePicker)[0].props.onChange("2030-04-05");
    h.button(back).props.onClick(); assert.equal(elements(h.render(), node => node.props.name === "address")[0].props.value, "Updated street");
    h.button(next).props.onClick(); assert.equal(elements(h.render(), node => node.props.name === "passportNumber")[0].props.value, "N0123456");
    const html = markup(h.render()); assert.match(html, locale === "en" ? /dir="ltr"/ : /dir="rtl"/); assert.doesNotMatch(html, /\?\?\?/);
    assert.match(html, /I have read and agree to the/); assert.match(html, /Privacy Policy/); assert.match(html, /Verification Notice/);
    assert.match(html, /I consent to Zarman Exchange verifying my personal details and ID documents via official records \(DVS\) as per the/);
  }
});

test("identity submission requires both original consents and preserves document values after an API failure", async () => {
  for (const locale of ["en", "fa"]) {
    const calls = []; let fail = true;
    const h = profileHarness({ locale, submit: async payload => { calls.push(payload); if (fail) throw Error("network"); return { success: true }; } });
    const next = locale === "en" ? "Continue" : "ادامه", submit = locale === "en" ? "Submit verification" : "ثبت احراز هویت";
    h.button(next).props.onClick(); h.button(next).props.onClick();
    elements(h.render(), node => node.type === h.SelectBox)[0].props.onChange("passport"); h.input("passportNumber", "N0012345");
    elements(h.render(), node => node.type === h.DatePicker)[0].props.onChange("2030-04-05");
    await h.button(submit).props.onClick(); assert.equal(calls.length, 0); assert.ok(elements(h.render(), node => node.props.id === "profile-error-consents").length);
    h.consent("consentNotice", true); await h.button(submit).props.onClick(); assert.equal(calls.length, 0);
    h.consent("consentDVS", true); await h.button(submit).props.onClick(); assert.equal(calls.length, 1);
    assert.equal(elements(h.render(), node => node.props.name === "passportNumber")[0].props.value, "N0012345");
    assert.equal(h.button(submit).props.disabled, false); assert.ok(elements(h.render(), node => node.props.role === "alert").length);
    assert.equal(calls[0].consent_notice, true); assert.equal(calls[0].consent_dvs, true); assert.equal(calls[0].document_type, "passport");
    fail = false; await h.button(submit).props.onClick();
    const html = markup(h.render()); assert.equal(h.stepper(), undefined);
    assert.match(html, locale === "en" ? /We’re checking your details/ : /در حال بررسی اطلاعات شما هستیم/);
    assert.doesNotMatch(html, /data-status-tone="success"|tab=transfer/);
  }
});

test("personal editing blocks forward navigation until saved and retains the draft on failed save", async () => {
  let fail = true;
  const h = profileHarness({ update: async () => { if (fail) throw Error("offline"); return { success: true }; } });
  h.button("Edit").props.onClick(); h.input("firstName", "Updated");
  h.button("Continue").props.onClick(); assert.equal(h.stepper().props.currentStep, 1);
  await h.button("Save details").props.onClick();
  assert.equal(elements(h.render(), node => node.props.name === "firstName")[0].props.value, "Updated");
  assert.equal(h.button("Save details").props.disabled, false);
  fail = false; await h.button("Save details").props.onClick();
  assert.match(markup(h.render()), /Updated Morgan/); h.button("Continue").props.onClick(); assert.equal(h.stepper().props.currentStep, 2);
});

test("country-specific identity requirements are preserved without manufacturing Australian verification", async () => {
  const calls = [], h = profileHarness({ profile: { ...base, country: "Iran", state: "Tehran", city: "Tehran" }, submit: async payload => { calls.push(payload); return { success: true }; } });
  h.button("Continue").props.onClick(); h.button("Continue").props.onClick();
  assert.equal(elements(h.render(), node => node.props.name === "consentNotice").length, 0);
  await h.button("Submit verification").props.onClick();
  assert.equal(calls[0].country, "Iran"); assert.equal(calls[0].document_type, "none");
  assert.equal(calls[0].consent_notice, true); assert.equal(calls[0].consent_dvs, true);
  assert.match(markup(h.render()), /We’re checking your details/); assert.doesNotMatch(markup(h.render()), /Identity verified/);
});

test("verified and pending profile screens show one relevant next action without reopening verification", () => {
  for (const locale of ["en", "fa"]) {
    const pending = profileHarness({ locale, profile: { ...base, document_type: "passport", kyc_status: "pending" } });
    assert.equal(pending.stepper(), undefined); assert.ok(pending.button(locale === "en" ? "Check status" : "بررسی وضعیت"));
    assert.doesNotMatch(markup(pending.render()), /tab=transfer/);
    const approved = profileHarness({ locale, profile: { ...base, document_type: "passport", kyc_status: "approved" } });
    assert.equal(approved.stepper(), undefined); assert.match(markup(approved.render()), new RegExp(`/${locale}/dashboard\\?tab=transfer`));
    assert.match(markup(approved.render()), /data-status-tone="success"/);
  }
});

test("manual document support saves details without falsely claiming verification was submitted", async () => {
  const previousWindow = global.window;
  const opened = { location: { href: "" }, close() {} };
  try {
    for (const locale of ["en", "fa"]) {
      const h = profileHarness({ locale });
      const next = locale === "en" ? "Continue" : "ادامه";
      h.button(next).props.onClick(); h.button(next).props.onClick();
      elements(h.render(), node => node.type === h.SelectBox)[0].props.onChange("none");
      global.window = { open: () => opened };
      await h.button(locale === "en" ? "Contact support on WhatsApp" : "تماس با پشتیبانی در واتس‌اپ").props.onClick();
      global.window = previousWindow;
      const html = markup(h.render());
      assert.equal(h.stepper().props.currentStep, 3);
      assert.match(html, locale === "en" ? /Verification incomplete/ : /احراز هویت تکمیل نشده/);
      assert.match(html, /href="https:\/\/wa.me\//); assert.match(opened.location.href, /^https:\/\/wa.me\//);
      assert.doesNotMatch(html, /No action is needed|We’re checking your details|تا پایان بررسی نیازی|در حال بررسی اطلاعات شما هستیم/);
    }
  } finally { global.window = previousWindow; }
});

test("feedback failure keeps the message for retry and successful submission displays one acknowledgement", async () => {
  for (const locale of ["en", "fa"]) {
    let fail = true; const writes = [];
    const h = dashboardHarness({ locale, mocks: { "@/lib/supabase": { supabase: { from: table => ({ insert: async rows => { writes.push({ table, rows }); if (fail) throw Error("transport"); return { error: null }; } }) } } } });
    const { DashboardFeedback } = h.load("components/dashboard/DashboardFeedback.tsx");
    const render = () => h.render(DashboardFeedback, { profileId: "synthetic", motionEnabled: false });
    elements(render(), node => node.type === "textarea")[0].props.onChange({ target: { value: "A clear test message" } });
    const form = () => elements(render(), node => node.type === "form")[0];
    form().props.onSubmit({ preventDefault() {} }); await new Promise(resolve => setImmediate(resolve));
    assert.equal(elements(render(), node => node.type === "textarea")[0].props.value, "A clear test message"); assert.match(markup(render()), /role="alert"/);
    fail = false; form().props.onSubmit({ preventDefault() {} }); await new Promise(resolve => setImmediate(resolve));
    assert.equal(writes.length, 2); assert.equal(writes[1].table, "testimonials"); assert.equal(writes[1].rows[0].status, "pending");
    assert.equal(elements(render(), node => node.type === "form").length, 0); assert.match(markup(render()), /role="status"/);
  }
});

test("new guided forms retain actual Persian text and the amount character whitelist", () => {
  for (const file of ["DashboardProfile", "DashboardRequestHub", "DashboardFeedback"]) {
    const source = fs.readFileSync(`components/dashboard/${file}.tsx`, "utf8");
    assert.doesNotMatch(source, /\?{3,}/); assert.match(source, /[\u0600-\u06ff]/);
  }
  const hub = fs.readFileSync("components/dashboard/DashboardRequestHub.tsx", "utf8");
  assert.match(hub, /pattern="\[0-9۰-۹٠-٩\.,٫،\]\*"/);
});
