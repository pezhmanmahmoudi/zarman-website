const fs = require("fs");
const vm = require("vm");
const sourcePath = "C:/Users/z5340863/Downloads/cities_sorted.json";
const targetPath = "components/dashboard/cities_sorted.json";
const profilePath = "components/dashboard/DashboardProfile.tsx";
const cities = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const profile = fs.readFileSync(profilePath, "utf8");
const match = profile.match(/const missingEnNames: Record<string, string> = \{([\s\S]*?)\n\};/);
const existing = vm.runInNewContext("({" + match[1] + "\n})");
const extraById = {754:"Babakan",1359:"Bazar Jomeh",1031:"Barf Anbar",1828:"Benab Marand",1791:"Delvar",562:"Zirab",18642:"Ziveh",18857:"Sepidar",917:"Sedeh",797:"Ziaabad",1069:"Tad",225:"Tarom",18982:"Taher Gurab",1161:"Tabaqdeh",1707:"Tarq Rud",10169:"Asheqlu",1211:"Abbasabad Sardar",1508:"Fakhrabad",881:"Firuzabad",286:"Qir va Karzin",1481:"Madavan",613:"Mazhan",1448:"Mashhadrizeh",1291:"Minadasht",296:"Neyriz",848:"Nikpey",1133:"Nimvar",1734:"Zohoki"};
let missingBefore = 0;
let filled = 0;
for (const city of Object.values(cities)) {
  if (city.en_name == null) {
    missingBefore++;
    const replacement = existing[city.name] || extraById[city.id] || null;
    if (replacement != null) {
      city.en_name = replacement;
      filled++;
    }
  }
}
const unresolved = Object.values(cities).filter(city => city.en_name == null).map(city => ({ id: city.id, name: city.name }));
if (unresolved.length) throw new Error(`Unresolved translations: ${JSON.stringify(unresolved)}`);
fs.writeFileSync(targetPath, JSON.stringify(cities, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ missingBefore, filled, unresolved: unresolved.length }, null, 2));
