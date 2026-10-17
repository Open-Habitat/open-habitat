import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname;
async function inspect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await inspect(path);
    else if (/\.(?:html|js|css|map)$/.test(entry.name)) {
      const text = await readFile(path, "utf8");
      if (
        /SYNTEETTINEN DEMO|Demo-käyttäjä|synthetic-observation|demo_scenario|VITE_SYNTHETIC_DEMO|\/fixture\/|Simuloidussa demossa|kirjautumisnäkymän simulaatio|scenario=ready/.test(
          text,
        )
      )
        throw new Error(`Synthetic fixture in production build: ${path}`);
    }
  }
}
await inspect(dist);
console.log("Production build contains no synthetic fixture markers");
