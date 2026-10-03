// Local files only: no production data, network access or email sends.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { previews, settings, templates } from "./fixtures/request-email-template.mjs";

const output = resolve("artifacts/request-email-previews");
await mkdir(output, { recursive: true });
for (const [name, snapshot] of Object.entries(previews)) {
  const email = templates.renderRequestNotification(snapshot, settings);
  await writeFile(resolve(output, `${name}.html`), email.html, "utf8");
  await writeFile(resolve(output, `${name}.txt`), `${email.subject}\n\n${email.text}`, "utf8");
}
console.log(`Generated ${Object.keys(previews).length} synthetic email previews in ${output}`);
