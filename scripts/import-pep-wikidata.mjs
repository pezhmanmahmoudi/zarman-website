// Builds the internal PEP list from Wikidata (CC0: free for commercial use, no vendor cost).
//
//   node --env-file=.env.local scripts/import-pep-wikidata.mjs            # dry run: fetch + summary only
//   node --env-file=.env.local scripts/import-pep-wikidata.mjs --apply    # load into Supabase and activate
//   ... --countries IR,AF,TR     override the default country set
//
// Iran includes former office holders (they remain PEPs for risk purposes); other countries
// include current office holders only, to keep the list focused on the corridor.
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for --apply.

import { createClient } from "@supabase/supabase-js";

const COUNTRIES = {
  IR: { qid: "Q794", name: "Iran", former: true }, AF: { qid: "Q889", name: "Afghanistan" }, IQ: { qid: "Q796", name: "Iraq" },
  TR: { qid: "Q43", name: "Turkey" }, AE: { qid: "Q878", name: "United Arab Emirates" }, AZ: { qid: "Q227", name: "Azerbaijan" },
  AM: { qid: "Q399", name: "Armenia" }, TM: { qid: "Q874", name: "Turkmenistan" }, PK: { qid: "Q843", name: "Pakistan" },
  SA: { qid: "Q851", name: "Saudi Arabia" }, SY: { qid: "Q858", name: "Syria" }, LB: { qid: "Q822", name: "Lebanon" },
  RU: { qid: "Q159", name: "Russia" }, CN: { qid: "Q148", name: "China" }, AU: { qid: "Q408", name: "Australia" },
};
const ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "ZarmanComplianceImport/1.0 (https://zarman.com.au; info@zarman.com.au)";
const apply = process.argv.includes("--apply");
const countryArg = process.argv.find((arg, i) => process.argv[i - 1] === "--countries");
const selected = (countryArg ? countryArg.split(",") : Object.keys(COUNTRIES)).map(code => code.trim().toUpperCase());
for (const code of selected) if (!COUNTRIES[code]) throw new Error(`Unknown country code ${code}. Known: ${Object.keys(COUNTRIES).join(", ")}`);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function sparql(query, attempt = 1) {
  const response = await fetch(`${ENDPOINT}?${new URLSearchParams({ query })}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/sparql-results+json" }, signal: AbortSignal.timeout(90_000),
  });
  if (response.status === 429 || response.status >= 500) {
    if (attempt > 4) throw new Error(`Wikidata kept failing (${response.status}).`);
    await sleep(attempt * 4000);
    return sparql(query, attempt + 1);
  }
  if (!response.ok) throw new Error(`Wikidata query failed (${response.status}).`);
  return (await response.json()).results.bindings;
}

const qidOf = uri => uri.slice(uri.lastIndexOf("/") + 1);

async function fetchOfficeHolders(code) {
  const { qid, former } = COUNTRIES[code];
  const query = `SELECT ?person ?dob ?positionLabel ?end WHERE {
    ?person wdt:P27 wd:${qid}; wdt:P31 wd:Q5; p:P39 ?st .
    ?st ps:P39 ?position .
    OPTIONAL { ?st pq:P582 ?end }
    ${former ? "" : "FILTER NOT EXISTS { ?st pq:P582 ?anyEnd }"}
    OPTIONAL { ?person wdt:P569 ?dob }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fa". }
  }`;
  return sparql(query);
}

async function fetchNames(qids) {
  const values = qids.map(id => `wd:${id}`).join(" ");
  const query = `SELECT ?person ?name ?isAlias WHERE {
    VALUES ?person { ${values} }
    { ?person rdfs:label ?name . FILTER(LANG(?name) IN ("en","fa")) BIND(false AS ?isAlias) }
    UNION
    { ?person skos:altLabel ?name . FILTER(LANG(?name) IN ("en","fa")) BIND(true AS ?isAlias) }
  }`;
  return sparql(query);
}

async function main() {
  const people = new Map();
  for (const code of selected) {
    process.stdout.write(`Fetching office holders for ${code}… `);
    const rows = await fetchOfficeHolders(code);
    for (const row of rows) {
      const id = qidOf(row.person.value);
      const entry = people.get(id) ?? { id, country: COUNTRIES[code].name, positions: new Set(), dob: null, current: false };
      if (row.positionLabel?.value && !/^Q\d+$/.test(row.positionLabel.value)) entry.positions.add(row.positionLabel.value);
      if (!row.end) entry.current = true;
      if (row.dob && !entry.dob) entry.dob = row.dob.value.slice(0, 4);
      people.set(id, entry);
    }
    console.log(`${rows.length} statements, ${people.size} people so far`);
    await sleep(1500);
  }

  const ids = [...people.keys()];
  const entries = [];
  for (let from = 0; from < ids.length; from += 150) {
    process.stdout.write(`Fetching names ${from + 1}-${Math.min(ids.length, from + 150)} of ${ids.length}\r`);
    const rows = await fetchNames(ids.slice(from, from + 150));
    const byPerson = new Map();
    for (const row of rows) {
      const id = qidOf(row.person.value);
      const list = byPerson.get(id) ?? [];
      list.push({ name: row.name.value.trim(), isAlias: row.isAlias.value === "true", lang: row.name["xml:lang"] });
      byPerson.set(id, list);
    }
    for (const [id, names] of byPerson) {
      const person = people.get(id);
      const seen = new Set();
      // English label first (the primary row used for display), then other labels, then aliases.
      names.sort((a, b) => Number(a.isAlias) - Number(b.isAlias) || (a.lang === "en" ? -1 : 1) - (b.lang === "en" ? -1 : 1));
      names.forEach((item, index) => {
        const key = item.name.toLowerCase();
        if (!item.name || /^Q\d+$/.test(item.name) || seen.has(key)) return;
        seen.add(key);
        entries.push({ wikidata_id: id, name: item.name, is_alias: index > 0, country: person.country, positions: [...person.positions].slice(0, 8), dob: person.dob, is_current: person.current });
      });
    }
    await sleep(1200);
  }
  console.log(`\n${people.size} people → ${entries.length} name rows (labels + aliases).`);
  if (!apply) { console.log("Dry run only. Re-run with --apply to load this into Supabase."); return; }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (use --env-file=.env.local).");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const created = await db.from("compliance_list_imports").insert([{ kind: "pep_wikidata", status: "loading", source_name: `Wikidata (${selected.join(", ")})`, entry_count: entries.length }]).select("id").single();
  if (created.error) throw created.error;
  const importId = created.data.id;
  try {
    for (let from = 0; from < entries.length; from += 500) {
      const { error } = await db.from("pep_entries").insert(entries.slice(from, from + 500).map(entry => ({ ...entry, import_id: importId })));
      if (error) throw error;
    }
  } catch (error) {
    await db.from("pep_entries").delete().eq("import_id", importId);
    await db.from("compliance_list_imports").update({ status: "failed", notes: "Import did not complete." }).eq("id", importId);
    throw error;
  }
  await db.from("compliance_list_imports").update({ status: "superseded" }).eq("kind", "pep_wikidata").eq("status", "active");
  const activated = await db.from("compliance_list_imports").update({ status: "active", activated_at: new Date().toISOString(), notes: `${people.size} people, ${entries.length} names. Source: Wikidata (CC0).` }).eq("id", importId);
  if (activated.error) throw activated.error;
  const old = await db.from("compliance_list_imports").select("id").eq("kind", "pep_wikidata").eq("status", "superseded");
  for (const row of old.data ?? []) await db.from("pep_entries").delete().eq("import_id", row.id);
  console.log(`Loaded and activated import ${importId}. Open requests re-screen against it automatically.`);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
