/* eslint-disable @typescript-eslint/no-require-imports -- Offline component and hook harness. */
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const ts = require("typescript"), postcss = require("postcss"), React = require("react");
const root = path.resolve(__dirname, "../..");
function dashboardHarness({ locale = "en", pathname = `/${locale}/dashboard`, query = "", mocks = {} } = {}) {
  const cache = new Map(), css = new Map(), values = [], refs = [], effects = [], cleanups = [], dependencies = [];
  let index = 0, refIndex = 0, effectIndex = 0;
  const hookReact = { ...React,
    useState(initial) { const i = index++; if (!(i in values)) values[i] = typeof initial === "function" ? initial() : initial; return [values[i], value => { values[i] = typeof value === "function" ? value(values[i]) : value; }]; },
    useRef(initial) { const i = refIndex++; return refs[i] ||= { current: initial }; },
    useCallback: fn => fn, useMemo: fn => fn(),
    useEffect(fn, deps) { const i = effectIndex++; if (!dependencies[i] || !deps || deps.some((value,j) => !Object.is(value, dependencies[i][j]))) { effects.push(() => { cleanups[i]?.(); cleanups[i] = fn(); }); dependencies[i] = deps; } },
  };
  const navigation = { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(query), useRouter: () => ({ replace() {}, refresh() {}, push() {} }) };
  function compile(file) {
    const filename = path.resolve(root,file);
    if (cache.has(filename)) return cache.get(filename);
    const output = { exports: {} }; cache.set(filename, output.exports);
    const compiled = ts.transpileModule(fs.readFileSync(filename,"utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const requireLocal = id => {
      if (id in mocks) return mocks[id];
      if (id === "react") return hookReact;
      if (id === "next/navigation") return navigation;
      if (id === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a",props,children) };
      if (id === "next/image") return { __esModule: true, default: props => React.createElement("img",props) };
      if (id === "@/context/LocaleContext") return { useLocale: () => locale };
      if (id === "@/lib/supabase") return { supabase: { auth: { signOut() { throw Error("Unexpected auth mutation"); } } } };
      if (id.endsWith(".module.css")) {
        const filename = path.resolve(root,id.replace(/^@\//,""));
        const prefix = path.basename(filename,".module.css"), classes = {};
        const parsed = postcss.parse(fs.readFileSync(filename,"utf8"));
        parsed.walkRules(rule => {
          rule.selector = rule.selector.replace(/\.([a-zA-Z_][\w-]*)/g, (_,key) => { classes[key] = `${prefix}_${key}`; return `.${classes[key]}`; }).replace(/:global\(([^)]+)\)/g,"$1");
        });
        css.set(filename,parsed.toString());
        return { __esModule:true, default: new Proxy(classes, { get(target,key) { if (typeof key !== "string" || key in target) return target[key]; throw Error(`Missing CSS class ${id}: ${key}`); } }) };
      }
      if (id.startsWith("@/") || id.startsWith(".")) {
        const base = id.startsWith("@/") ? path.resolve(root,id.slice(2)) : path.resolve(path.dirname(filename),id);
        const dependency = [base,`${base}.tsx`,`${base}.ts`,`${base}.json`,path.join(base,"index.ts")].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
        if (dependency) return dependency.endsWith(".json") ? JSON.parse(fs.readFileSync(dependency,"utf8")) : compile(dependency);
      }
      return require(id);
    };
    vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(requireLocal,output,output.exports);
    cache.set(filename,output.exports); return output.exports;
  }
  return { load: compile, css, values, refs,
    render(fn,props) { index = 0; refIndex = 0; effectIndex = 0; return fn(props); },
    effects() { effects.splice(0).forEach(fn => fn()); },
    cleanup() { cleanups.forEach(fn => fn?.()); },
  };
}
const request = {
  id:"fixture-request", transaction_id:"fixture-tx", reference_code:"ZE36827", status:"under_review", service_tier:"standard",
  funding_status:"confirmed", funding_received:234675000, priority_fee_status:"not_applicable", customer_action_required:null,
  created_at:"2026-09-15T01:20:00Z", updated_at:"2026-09-15T03:55:00Z", payment_approved_at:"2026-09-15T01:30:00Z",
  evidence_submitted_at:"2026-09-15T02:00:00Z", funds_confirmed_at:"2026-09-15T03:55:00Z",
  quote: { funding_total:234675000, funding_currency:"IRT", recipient_amount:2235, recipient_currency:"AUD", recipient_snapshot:{ full_name:"Alex Morgan" } },
};
module.exports = { dashboardHarness, request };
