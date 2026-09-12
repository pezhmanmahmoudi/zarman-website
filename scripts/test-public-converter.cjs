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
const Converter = compile("components/sections/RateSection/ConverterFa.tsx", (id) => {
  if (id === "react") return {
    ...React,
    useState: (initial) => {
      const index = stateIndex++;
      return [stateValues[index] ?? initial, (value) => { stateValues[index] = value; }];
    },
  };
  if (id === "next/navigation") return { useParams: () => ({ locale }) };
  if (id === "@/context/RateContext") return { useRates: () => ({ currentRates, isLoading: false }) };
  if (id === "@/context/FinanceConfigContext") return { useFinanceConfig: () => config };
  if (id === "@/lib/pricing") return pricing;
  if (id === "@/lib/constants/contact") return { buildWhatsAppUrl: () => "" };
  if (id === "@/components/ui/SelectBox/SelectBox") return { SelectBox: () => null };
  if (id === "@/components/ui/Button/Button") {
    return { default: ({ children, disabled }) => React.createElement("button", { disabled }, children), __esModule: true };
  }
  if (id === "lucide-react") return new Proxy({}, { get: () => () => null });
  if (id.endsWith(".css")) return { default: new Proxy({}, { get: (_, key) => String(key) }), __esModule: true };
  return require(id);
}).default;

function render(amount, direction) {
  stateIndex = 0;
  stateValues = [String(amount), direction];
  const html = renderToStaticMarkup(React.createElement(Converter));
  const value = html.match(/<input id="converter-receive-amount"[^>]*value="([^"]*)"/)[1];
  const normalized = value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[،,]/g, "");
  return { html, amount: normalized === "" || normalized === "—" ? normalized : Number(normalized) };
}

function findInput(element) {
  if (!element || typeof element !== "object") return null;
  if (element.props?.id === "converter-send-amount") return element;
  for (const child of React.Children.toArray(element.props?.children)) {
    const found = findInput(child);
    if (found) return found;
  }
  return null;
}

function enterAmount(previous, entered, direction = "AUD") {
  stateIndex = 0;
  stateValues = [previous, direction];
  const input = findInput(Converter());
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
      assert.equal(result.amount, direction === "AUD" ? expectedAud * 50000 : expectedAud);
      assert.equal(result.html.includes('class="feeWarning"'), rawAud < 1000);
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
  ["fa", "10.50", "۱۰٫۵۰"],
  ["fa", "۱٬۲۳۴٫۵۰", "۱،۲۳۴٫۵۰"],
  ["en", "10.", "10."],
  ["fa", "۱۰٫", "۱۰٫"],
  ["en", ".50", "0.50"],
  ["fa", "٫۵۰", "۰٫۵۰"],
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

console.log(`${assertions} public converter SSR assertions passed.`);
