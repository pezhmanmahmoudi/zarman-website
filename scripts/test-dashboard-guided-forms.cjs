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
  const KycDocumentEvidence = ({children}) => children;
  const h = dashboardHarness({ locale, mocks: {
    "@/components/ui/SelectBox/SelectBox": { SelectBox },
    "@/components/ui/DatePicker/CustomDatePicker": { __esModule: true, default: DatePicker },
    "@/components/dashboard/AustralianLocationFields": { AustralianLocationFields },
    "@/components/dashboard/KycDocumentEvidence": { KycDocumentEvidence },
    "@/app/actions/kyc.actions": { submitKycData: submit, updatePersonalIdentityData: update, savePersonalData: async () => ({ success: true }) },
  } });
  const { DashboardProfile } = h.load("components/dashboard/DashboardProfile.tsx");
  const render = () => h.render(DashboardProfile, { profile, motionEnabled: false });
  const button = text => elements(render(), node => typeof node.props.onClick === "function" && nodeText(node) === text)[0];
  return { h, render, button, SelectBox, DatePicker, AustralianLocationFields,
    input(name, value) { const element = elements(render(), node => node.type === "input" && node.props.name === name)[0]; assert.ok(element, `Missing field ${name}`); element.props.onChange({ target: { name, value, type: element.props.type || "text" } }); },
    consent(name, checked) { elements(render(), node => node.props.name === name)[0].props.onChange({ target: { name, type: "checkbox", checked } }); },
    documents() { return elements(render(), node => node.props.onDocumentTypeChange !== undefined)[0]; },
    stepper() { return elements(render(), node => node.props.stepListLabel !== undefined)[0]; },
  };
}

test("account headings stay bilingual while the stepper uses English copy and responsive controls", () => {
  for (const locale of ["en", "fa"]) {
    const h = profileHarness({ locale });
    const html = markup(h.render());
    const phrases = [locale === "en" ? "Your Account" : "حساب کاربری", locale === "en" ? "Identity Verification" : "تأیید هویت", "Personal Details", "Residential Address", "Document Upload", "Please enter your details in English, exactly as they appear on your ID documents.", "Full name", "Step 1 of 3", "Next Step"];
    const countryLabel = "Country of residence";
    for (const phrase of phrases.filter(phrase => phrase !== countryLabel)) assert.ok(html.replace(/<[^>]*>/g, "").includes(phrase), `Missing ${phrase}`);
    const englishEmphasis = elements(h.render(), node => node.type === "strong" && nodeText(node) === "English")[0];
    assert.equal(englishEmphasis.props.className, "font-black");
    assert.match(elements(h.render(), node => node.type === "p" && nodeText(node).startsWith("Please enter your details"))[0].props.className, /font-bold/);
    assert.ok(!html.includes(countryLabel));
    assert.equal(elements(h.render(), node => node.type === h.SelectBox).length, 0);
    assert.equal(elements(h.render(), node => node.props.name === "identity-fingerprint").length, 1);
    const englishForm = elements(h.render(), node => node.props["data-profile-stepper"])[0];
    assert.equal(englishForm.props.lang, "en");
    assert.equal(englishForm.props.dir, "ltr");
    assert.doesNotMatch(nodeText(englishForm), /[\u0600-\u06ff]/);
    assert.match(html, /data-profile-verification="true"/);
    assert.equal(elements(h.render(), node => node.props["data-profile-verification"])[0].props.pointerEffect, false);
    assert.match(html, /data-magic-card="true"/);
    const stepper = h.stepper();
    assert.match(stepper.props.stepCircleContainerClassName, /border-0!.*bg-transparent!.*shadow-none!/);
    const footer = elements(h.render(), node => node.type === "footer")[0];
    assert.match(footer.props.className, /flex-col.*sm:flex-row/);
    const css = [...h.h.css.values()].join("\n");
    assert.match(css, /grid-template-columns:minmax\(0,1fr\).*minmax\(0,1fr\).*minmax\(0,1fr\)/);
    const next = "Next Step";
    h.button(next).props.onClick();
    assert.match(markup(h.render()), /Step 2 of 3/);
    assert.ok(markup(h.render()).includes(countryLabel));
    assert.doesNotMatch(nodeText(elements(h.render(), node => node.props["data-profile-stepper"])[0]), /[\u0600-\u06ff]/);
    const country = elements(h.render(), node => node.type === h.SelectBox)[0];
    assert.equal(country.props.value, "Australia");
    country.props.onChange("Australia");
    assert.equal(elements(h.render(), node => node.type === h.AustralianLocationFields)[0].props.city, "Sydney");
    assert.ok(h.button("Back"));
  }
});

test("profile controls share 48px sizing and location suggestions use an anchored top-layer menu", () => {
  const css = fs.readFileSync("styles/dashboard/DashboardProfileFlow.module.css", "utf8");
  assert.match(css, /height:48px!important;min-height:48px!important/);
  assert.match(css, /border-radius:12px!important/);
  assert.match(css, /@container\(min-width:540px\)/);
  assert.match(css, /@container\(min-width:800px\)/);
  const source = fs.readFileSync("components/dashboard/AustralianLocationFields.tsx", "utf8");
  assert.match(source, /useAnchoredPopover\(\{/);
  assert.match(source, /popover="manual"/);
  assert.match(source, /matchWidth: true, maxHeight: 260/);
  assert.match(source, /aria-activedescendant/);
  assert.match(source, /onClick=\{\(\) => choose\(suggestion\)\}/);
});

test("guided identity flow validates each stage, prevents skipping and retains drafts in English and Persian", () => {
  for (const locale of ["en", "fa"]) {
    const h = profileHarness({ locale, profile: { ...base, dob: "" } });
    const next = "Next Step", back = "Back";
    assert.equal(h.stepper().props.currentStep, 1);
    h.stepper().props.onStepChange(3); assert.equal(h.stepper().props.currentStep, 1);
    h.button(next).props.onClick(); assert.equal(h.stepper().props.currentStep, 1); assert.ok(elements(h.render(), node => node.props.id === "profile-error-dob").length);
    elements(h.render(), node => node.type === h.DatePicker)[0].props.onChange("1990-02-03");
    h.button(next).props.onClick(); assert.equal(h.stepper().props.currentStep, 2);
    h.input("address", ""); h.button(next).props.onClick(); assert.equal(h.stepper().props.currentStep, 2);
    h.input("address", "Updated street"); h.button(next).props.onClick(); assert.equal(h.stepper().props.currentStep, 3);
    h.documents().props.onDocumentTypeChange("passport");
    h.input("passportNumber", "N0123456");
    elements(h.render(), node => node.type === h.DatePicker)[0].props.onChange("2030-04-05");
    h.button(back).props.onClick(); assert.equal(elements(h.render(), node => node.props.name === "address")[0].props.value, "Updated street");
    h.button(next).props.onClick(); assert.equal(elements(h.render(), node => node.props.name === "passportNumber")[0].props.value, "N0123456");
    const html = markup(h.render()); assert.match(html, locale === "en" ? /dir="ltr"/ : /dir="rtl"/); assert.doesNotMatch(html, /\?\?\?/);
    assert.match(html, /I have read and agree to the/); assert.match(html, /Privacy Policy/); assert.match(html, /Verification Notice/);
    assert.match(html, /I consent to Zarman Exchange checking my details/);
  }
});

test("identity submission requires both original consents and preserves document values after an API failure", async () => {
  for (const locale of ["en", "fa"]) {
    const calls = []; let fail = true;
    const h = profileHarness({ locale, submit: async payload => { calls.push(payload); if (fail) throw Error("network"); return { success: true }; } });
    const next = "Next Step", submit = "Submit verification";
    h.button(next).props.onClick(); h.button(next).props.onClick();
    h.documents().props.onDocumentTypeChange("passport"); h.input("passportNumber", "N0012345");
    elements(h.render(), node => node.type === h.DatePicker)[0].props.onChange("2030-04-05");
    h.documents().props.onChange({...h.documents().props.evidence,front:{id:"passport-front",name:"passport.pdf"}});
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
  h.button("Next Step").props.onClick(); assert.equal(h.stepper().props.currentStep, 1);
  await h.button("Save details").props.onClick();
  assert.equal(elements(h.render(), node => node.props.name === "firstName")[0].props.value, "Updated");
  assert.equal(h.button("Save details").props.disabled, false);
  fail = false; await h.button("Save details").props.onClick();
  assert.match(markup(h.render()), /Updated Morgan/); h.button("Next Step").props.onClick(); assert.equal(h.stepper().props.currentStep, 2);
});

test("non-Australian residents must supply documents and explicitly consent without claiming a DVS result", async () => {
  const calls = [], h = profileHarness({ profile: { ...base, country: "Iran", state: "Tehran", city: "Tehran" }, submit: async payload => { calls.push(payload); return { success: true }; } });
  h.button("Next Step").props.onClick(); h.button("Next Step").props.onClick();
  h.documents().props.onDocumentTypeChange("foreign_passport");
  elements(h.render(), node => node.type === h.DatePicker)[0].props.onChange("2030-04-05");
  h.documents().props.onChange({...h.documents().props.evidence,documentNumber:"N100",documentIssuer:"Iran",front:{id:"foreign-front",name:"passport.pdf"}});
  await h.button("Submit verification").props.onClick(); assert.equal(calls.length,0);
  h.consent("consentNotice",true); h.consent("consentDVS",true);
  await h.button("Submit verification").props.onClick();
  assert.equal(calls[0].country, "Iran"); assert.equal(calls[0].document_type, "foreign_passport");
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

test("alternative ID requires both sides and a separately selected proof of address; changing ID clears old uploads", async () => {
  const calls=[],h=profileHarness({submit:async payload=>{calls.push(payload);return {success:true};}});
  h.button("Next Step").props.onClick();h.button("Next Step").props.onClick();
  h.documents().props.onDocumentTypeChange("photo_id");
  h.consent("consentNotice",true);h.consent("consentDVS",true);
  const today=new Date().toISOString().slice(0,10);
  h.documents().props.onChange({...h.documents().props.evidence,front:{id:"front",name:"front.jpg"},documentNumber:"12345",documentIssuer:"NSW"});
  await h.button("Submit verification").props.onClick();assert.equal(calls.length,0);
  assert.ok(h.documents().props.errors["evidence-back"]);assert.ok(h.documents().props.errors["evidence-address"]);assert.ok(h.documents().props.errors.addressType);
  h.documents().props.onChange({...h.documents().props.evidence,back:{id:"back",name:"back.jpg"},address:{id:"address",name:"bill.pdf"},addressType:"utility_bill",addressDate:today});
  h.documents().props.onBusyChange(true);assert.equal(h.button("Submit verification").props.disabled,true);assert.equal(h.button("Back").props.disabled,true);
  h.documents().props.onBusyChange(false);
  h.documents().props.onDocumentTypeChange("proof_of_age");
  assert.equal(h.documents().props.evidence.front,undefined);
  await h.button("Submit verification").props.onClick();assert.equal(calls.length,0);
});

test("feedback failure keeps the message for retry and successful submission displays one acknowledgement", async () => {
  for (const locale of ["en", "fa"]) {
    let fail = true; const writes = [];
    const h = dashboardHarness({ locale, mocks: {
      // Decorative scenes have their own lifecycle suite; isolate their hooks from this form harness.
      "@/components/dashboard/DashboardLottieScene": { DashboardLottieScene: ({ name }) => React.createElement("span", { "data-lottie-scene": name }) },
      "@/lib/supabase": { supabase: { from: table => ({ insert: async rows => { writes.push({ table, rows }); if (fail) throw Error("transport"); return { error: null }; } }) } },
    } });
    const { DashboardFeedback } = h.load("components/dashboard/DashboardFeedback.tsx");
    const render = () => h.render(DashboardFeedback, { profileId: "synthetic", motionEnabled: false });
    elements(render(), node => node.type === "textarea")[0].props.onChange({ target: { value: "A clear test message" } });
    const form = () => elements(render(), node => node.type === "form")[0];
    form().props.onSubmit({ preventDefault() {} }); await new Promise(resolve => setImmediate(resolve));
    assert.equal(elements(render(), node => node.type === "textarea")[0].props.value, "A clear test message"); assert.match(markup(render()), /role="alert"/);
    fail = false; form().props.onSubmit({ preventDefault() {} }); await new Promise(resolve => setImmediate(resolve));
    assert.equal(writes.length, 2); assert.equal(writes[1].table, "testimonials"); assert.equal(writes[1].rows[0].status, "pending");
    assert.equal(elements(render(), node => node.type === "form").length, 0); assert.match(markup(render()), /role="status"/);
    assert.match(markup(render()), /data-lottie-scene="feedback-heart"/);
  }
});

test("new guided forms retain actual Persian text and the amount character whitelist", () => {
  for (const file of ["DashboardProfile", "DashboardRequestHub", "DashboardFeedback"]) {
    const source = fs.readFileSync(`components/dashboard/${file}.tsx`, "utf8");
    assert.doesNotMatch(source, /\?{3,}/); assert.match(source, /[\u0600-\u06ff]/);
  }
  const hub = fs.readFileSync("components/dashboard/DashboardRequestHub.tsx", "utf8");
  assert.match(hub, /pattern=\{aud \? "\[0-9۰-۹٠-٩\.,٫،٬\]\*" : undefined\}/);
});
