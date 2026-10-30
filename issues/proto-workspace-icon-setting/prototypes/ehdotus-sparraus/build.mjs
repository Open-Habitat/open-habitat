// Inlines the design-system tokens and fonts into the hand-written page so the
// result opens offline as one file:
//   node issues/proto-workspace-icon-setting/prototypes/ehdotus-sparraus/build.mjs
// writes ehdotus-sparraus.html beside this script.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ds = join(here, "../../../../design-system");
const tokens = ["colors", "spacing", "motion", "typography"]
  .map((n) => readFileSync(join(ds, "tokens", `${n}.css`), "utf8"))
  .join("\n")
  .replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, f) => {
    const b64 = readFileSync(join(ds, "fonts", f)).toString("base64");
    return `url("data:font/woff2;base64,${b64}")`;
  });
const src = readFileSync(join(here, "source.html"), "utf8");
if (!src.includes("/*@TOKENS@*/")) throw new Error("token marker missing");
writeFileSync(
  join(here, "ehdotus-sparraus.html"),
  src.replace("/*@TOKENS@*/", () => tokens),
);
console.log("wrote", join(here, "ehdotus-sparraus.html"));
