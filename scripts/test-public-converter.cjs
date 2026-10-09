/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS test harness for controlled TSX module loading. */
// Exercise the actual converter render with controlled rates, settings and inputs.
// No database or browser is needed; no transaction is submitted.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const projectRoot = path.resolve(__dirname, "..");
let locale = "en";
let stateValues = [];
let stateIndex = 0;
let currentRates = { buyAUD: 50000, sellAUD: 50000 };
let config = { fee_threshold: 1000, applied_fee: 30 };

function compile(file, localRequire) {
  const source = fs.readFileSync(path.join(projectRoot, file), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const compiled = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename: file })(
    localRequire, compiled, compiled.exports,
  );
  return compiled.exports;
}

const pricing = compile("lib/pricing.ts", require);
const numbers = compile("lib/numbers.ts", require);
const quoteMoney = compile("lib/requests/quote-money.ts", id => id === "@/lib/pricing" ? pricing : require(id));
const Converter = compile("components/sections/RateSection/ConverterFa.tsx", (id) => {
  if (id === "react") return {
    ...React,
    useState: (initial) => {
      const index = stateIndex++;
      if (stateValues[index] === undefined) stateValues[index] = typeof initial === "function" ? initial() : initial;
      return [stateValues[index], (value) => { stateValues[index] = value; }];
    },
  };
  if (id === "next/navigation") return { useParams: () => ({ locale }) };
  if (id === "@/context/RateContext") return { useRates: () => ({ currentRates, isLoading: false }) };
  if (id === "@/context/FinanceConfigContext") return { useFinanceConfig: () => config };
  if (id === "@/lib/pricing") return pricing;
  if (id === "@/lib/numbers") return numbers;
  if (id === "@/lib/requests/quote-money") return quoteMoney;
  if (id === "@/lib/constants/contact") return { buildWhatsAppUrl: () => "" };
  if (id === "@/components/ui/SelectBox/SelectBox") return { SelectBox: () => null };
  if (id === "@/components/ui/Button/Button") {
    return { default: ({ children, disabled }) => React.createElement("button", { disabled }, children), __esModule: true };
  }
  if (id === "lucide-react") return new Proxy({}, { get: () => () => null });
  if (id.endsWith(".css")) return { default: new Proxy({}, { get: (_, key) => String(key) }), __esModule: true };
  return require(id);
}).default;

function render(amount, direction, side = "send") {
  stateIndex = 0;
  stateValues = [String(amount), direction, side];
  const html = renderToStaticMarkup(React.createElement(Converter));
  const value = html.match(/<input id="converter-receive-amount"[^>]*value="([^"]*)"/)[1];
  const normalized = value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[،٬,]/g, "");
  return { html, amount: normalized === "" || normalized === "—" ? normalized : Number(normalized) };
}

function findElement(element, predicate) {
  if (!element || typeof element !== "object") return null;
  if (predicate(element)) return element;
  for (const child of React.Children.toArray(element.props?.children)) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}

function findInput(element, side = "send") {
  return findElement(element, node => node.props?.id === `converter-${side}-amount`);
}

function enterAmount(previous, entered, direction = "AUD", side = "send") {
  stateIndex = 0;
  stateValues = [previous, direction, side];
  const input = findInput(Converter(), side);
  assert.ok(input, "The editable amount input exists");
  input.props.onChange({ target: { value: entered } });
  return stateValues[0];
}

let assertions = 0;
for (locale of ["fa", "en"]) {
  for (const direction of ["AUD", "IRT"]) {
    // Below-fee amounts, normal fees, and just below/at/above the threshold.
    for (const [rawAud, expectedAud] of [[10, 0], [500, 470], [999, 969], [1000, 1000], [1001, 1001]]) {
      const entered = direction === "AUD" ? rawAud : rawAud * 50000;
      const result = render(entered, direction);
      assert.equal(result.amount, expectedAud === 0 ? "—" : direction === "AUD" ? expectedAud * 50000 : expectedAud);
      assert.equal(result.html.includes('class="feeWarning"'), expectedAud > 0 && rawAud < 1000);
      assertions += 2;
    }
    assert.equal(render(0, direction).amount, "");
    assertions++;
  }
}

locale = "en";
config = { ...config, applied_fee: 45 };
assert.equal(render(500, "AUD").amount, 22750000);
assert.equal(render(25000000, "IRT").amount, 455);
config = { ...config, fee_threshold: 500 };
assert.equal(render(500, "AUD").amount, 25000000);
assert.equal(render(25000000, "IRT").amount, 500);

locale = "fa";
config = { fee_threshold: 1000, applied_fee: 30 };
assert.equal(render("۲۵،۰۰۰،۰۰۰", "IRT").amount, 470);
assert.equal(render("٢٥٬٠٠٠٬٠٠٠", "IRT").amount, 470);

currentRates = { buyAUD: null, sellAUD: null };
const unavailable = render(500, "AUD");
assert.equal(unavailable.amount, "—");
assert.ok(unavailable.html.includes("نرخ در دسترس نیست"));
assert.ok(unavailable.html.includes('disabled=""'));
assertions += 9;

currentRates = { buyAUD: 50000, sellAUD: 50000 };
// Actual input handlers must preserve cents, trailing zeros and in-progress typing.
for (const [language, entered, displayed] of [
  ["en", "10.50", "10.50"],
  ["en", "1,234.50", "1,234.50"],
  ["en", "۱۲۳۴٫۵۰", "1,234.50"],
  ["en", "١٬٢٣٤٫٥٠", "1,234.50"],
  ["fa", "10.50", "۱۰.۵۰"],
  ["fa", "۱٬۲۳۴٫۵۰", "۱٬۲۳۴.۵۰"],
  ["en", "10.", "10."],
  ["fa", "۱۰٫", "۱۰."],
  ["en", ".50", "0.50"],
  ["fa", "٫۵۰", "۰.۵۰"],
]) {
  locale = language;
  assert.equal(enterAmount("3,000", entered), displayed);
  assertions += 2;
}
for (locale of ["fa", "en"]) {
  for (const malformed of ["10.5.0", "۱۰٫۵٫۰", "10.555", "10abc", "1e3", "-10.50"]) {
    assert.equal(enterAmount("123", malformed), "123");
    assertions += 2;
  }
  assert.equal(enterAmount("123", ""), "");
  assertions += 2;
}
locale = "en";
config = { fee_threshold: 1000, applied_fee: 0 };
assert.equal(render(enterAmount("", "10.50"), "AUD").amount, 525000);
assert.equal(render(enterAmount("", "1,000.50"), "AUD").amount, 50025000);
locale = "fa";
assert.equal(render(enterAmount("", "۱۰٫۵۰"), "AUD").amount, 525000);
config = { fee_threshold: 1000, applied_fee: 30 };
assert.equal(render("۹۹۹٫۹۹", "AUD").amount, 48499500);
assert.equal(render("۱۰۰۰٫۰۰", "AUD").amount, 50000000);
assertions += 5;

// Edit the actual lower field and verify the locked target, fees and request handoff.
function currentTree() { stateIndex = 0; return Converter(); }
function valueOf(side) { return findInput(currentTree(), side).props.value; }
function rawValue(side) { return Number(numbers.normaliseAmountDigits(valueOf(side))); }
function changeAmount(side, value) { findInput(currentTree(), side).props.onChange({ target: { value } }); }
for (locale of ["fa", "en"]) {
  config = { fee_threshold: 1000, applied_fee: 30 };
  currentRates = { buyAUD: 50000, sellAUD: 60000 };
  for (const [from, target, sent] of [["AUD", 23500000, 500], ["AUD", 50000000, 1000], ["IRT", 470, 30000000], ["IRT", 999.99, 61799400], ["IRT", 1000, 60000000]]) {
    stateValues = ["3000", from, "send"];
    changeAmount("receive", String(target));
    const receive = findInput(currentTree(), "receive");
    assert.equal(receive.props.readOnly, undefined);
    assert.equal(receive.props.dir, "ltr");
    assert.equal(receive.props.lang, locale);
    assert.equal(receive.props.inputMode, from === "IRT" ? "decimal" : "numeric");
    assert.equal(rawValue("receive"), target);
    assert.equal(rawValue("send"), sent);
    assert.equal(findElement(currentTree(), node => typeof node.props?.onClick === "function").props.disabled, false);
    assertions += 7;
  }
  stateValues = ["3000", "IRT", "send"];
  changeAmount("receive", "١٬٢١٢٫٢٥");
  assert.equal(valueOf("receive"), locale === "fa" ? "۱٬۲۱۲.۲۵" : "1,212.25");
  assert.equal(rawValue("send"), 72735000);
  changeAmount("receive", "۱۰٫۰۵");
  assert.equal(valueOf("receive"), locale === "fa" ? "۱۰.۰۵" : "10.05");
  assert.equal(rawValue("send"), 2403000);
  changeAmount("receive", "۱۰٫");
  assert.equal(valueOf("receive"), locale === "fa" ? "۱۰." : "10.");
  changeAmount("receive", "۱۰.۵۰");
  assert.equal(valueOf("receive"), locale === "fa" ? "۱۰.۵۰" : "10.50");
  for (const invalid of ["10.5.0", "۱۰٫۵٫۰", "10.555", "10abc", "1e3", "-10"]) {
    const previous = valueOf("receive");
    changeAmount("receive", invalid);
    assert.equal(valueOf("receive"), previous);
    assertions++;
  }
  // A rate refresh changes the calculated side only.
  currentRates = { buyAUD: 50000, sellAUD: 70000 };
  assert.equal(valueOf("receive"), locale === "fa" ? "۱۰.۵۰" : "10.50");
  assert.equal(rawValue("send"), 2835000);
  changeAmount("send", "35000000");
  assert.equal(rawValue("receive"), 470);
  changeAmount("receive", "");
  assert.equal(valueOf("send"), "");
  assert.equal(valueOf("receive"), "");
  assert.equal(findElement(currentTree(), node => typeof node.props?.onClick === "function").props.disabled, true);
  assertions += 12;

  // Whole Toman targets stay exact, with the corresponding AUD rounded once to cents.
  currentRates = { buyAUD: 174000, sellAUD: 180000 };
  stateValues = ["3000", "AUD", "send"];
  changeAmount("receive", "۱٬۰۰۰٬۰۰۱");
  assert.equal(rawValue("receive"), 1000001);
  assert.equal(rawValue("send"), 35.75);
  changeAmount("receive", "1000001.5");
  assert.equal(rawValue("receive"), 1000001);
  const previousWindow = global.window;
  let destination;
  global.window = { location: { assign(value) { destination = value; } } };
  try {
    findElement(currentTree(), node => typeof node.props?.onClick === "function").props.onClick();
    const url = new URL(destination, "https://example.test");
    assert.equal(url.searchParams.get("requestAmountAud"), "35.75");
    assert.equal(url.searchParams.get("requestDirection"), "sell_aud");
  } finally { global.window = previousWindow; }
  const selector = findElement(currentTree(), node => node.props?.labeledOptions && !node.props.disabled);
  selector.props.onChange("IRT");
  assert.equal(valueOf("send"), locale === "fa" ? "۳۶" : "36");
  assert.equal(stateValues[2], "send");
  assertions += 7;

  // Impossible fee-boundary targets and missing rates cannot submit a misleading estimate.
  currentRates = { buyAUD: 50000, sellAUD: 60000 };
  stateValues = ["3000", "AUD", "send"];
  changeAmount("receive", "49000000");
  assert.equal(rawValue("receive"), 49000000);
  assert.equal(valueOf("send"), "—");
  assert.ok(findElement(currentTree(), node => node.props?.id === "converter-amount-error"));
  assert.equal(findElement(currentTree(), node => typeof node.props?.onClick === "function").props.disabled, true);
  currentRates = { buyAUD: null, sellAUD: null };
  changeAmount("receive", "۱٬۰۰۰٬۰۰۰");
  assert.equal(rawValue("receive"), 1000000);
  assert.equal(valueOf("send"), "—");
  assertions += 6;
}

console.log(`${assertions} public converter SSR assertions passed.`);
