// Builds index.html from src.html: the design-system tokens and fonts are
// inlined so the page is one self-contained file.
//   node issues/proto-large-content-graceful/prototype/build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ds = join(here, "../../../design-system");
const css = ["colors", "typography", "spacing", "motion"]
  .map((name) => readFileSync(join(ds, "tokens", `${name}.css`), "utf8"))
  .join("\n")
  .replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, file) => {
    const data = readFileSync(join(ds, "fonts", file)).toString("base64");
    return `url("data:font/woff2;base64,${data}")`;
  });
const src = readFileSync(join(here, "src.html"), "utf8");
writeFileSync(join(here, "index.html"), src.replace("/*TOKENS*/", () => css));
