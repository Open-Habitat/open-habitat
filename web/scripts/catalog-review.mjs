import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer, parseSync } from "vite";

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  visit(node);
  for (const child of Object.values(node))
    if (typeof child === "object") walk(child, visit);
}

// Preserve functions as source: sampled arguments would miss branches and
// cannot faithfully stand in for React nodes or user-provided content.
export function extractCatalog(source, file) {
  const { program, errors } = parseSync(file, source, {
    lang: file.endsWith(".tsx") ? "tsx" : "ts",
  });
  if (errors.length) throw new Error(`${file}: ${errors[0].message}`);
  const bindings = new Map();
  const calls = [];
  for (const statement of program.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration"
        ? statement.declaration
        : statement;
    if (declaration?.type !== "VariableDeclaration") continue;
    for (const node of declaration.declarations) {
      if (node.id.type !== "Identifier") continue;
      bindings.set(node.id.name, node.init);
      if (
        node.init?.type === "CallExpression" &&
        node.init.callee.name === "catalog"
      )
        calls.push([node.id.name, node.init]);
    }
  }
  function resolve(node, seen = new Set()) {
    if (
      [
        "TSAsExpression",
        "TSSatisfiesExpression",
        "ParenthesizedExpression",
      ].includes(node?.type)
    )
      return resolve(node.expression, seen);
    if (node?.type === "Identifier" && bindings.has(node.name)) {
      if (seen.has(node.name))
        throw new Error(`${file}: cyclic catalog binding`);
      seen.add(node.name);
      return resolve(bindings.get(node.name), seen);
    }
    return node;
  }
  function leaves(expression, prefix = "") {
    const node = resolve(expression);
    if (!["ObjectExpression", "ArrayExpression"].includes(node?.type))
      throw new Error(`${file}:${prefix}: expected catalog object`);
    const result = new Map();
    const properties =
      node.type === "ArrayExpression"
        ? node.elements.map((value, index) => ({
            type: "Property",
            key: { value: String(index) },
            value,
          }))
        : node.properties;
    for (const prop of properties) {
      if (prop.type !== "Property" || prop.computed || prop.method)
        throw new Error(`${file}:${prefix}: unsupported catalog property`);
      const name = prop.key.name ?? prop.key.value;
      const key = prefix ? `${prefix}.${name}` : name;
      const value = resolve(prop.value);
      if (["ObjectExpression", "ArrayExpression"].includes(value?.type)) {
        for (const [k, v] of leaves(value, key)) result.set(k, v);
      } else {
        const kind =
          value?.type === "Literal" && typeof value.value === "string"
            ? "string"
            : ["ArrowFunctionExpression", "FunctionExpression"].includes(
                  value?.type,
                )
              ? "function"
              : value?.type === "TemplateLiteral"
                ? "string"
                : undefined;
        if (!kind) throw new Error(`${file}:${key}: unsupported message`);
        const texts = [];
        const helpers = {};
        const collect = (node) =>
          walk(node, (n) => {
            if (n.type === "Literal" && typeof n.value === "string")
              texts.push(n.value);
            if (n.type === "TemplateElement")
              texts.push(n.value.cooked ?? n.value.raw);
            if (n.type === "JSXText") texts.push(n.value);
            const name =
              n.type === "CallExpression" && n.callee.type === "Identifier"
                ? n.callee.name
                : undefined;
            if (name && bindings.has(name) && !Object.hasOwn(helpers, name)) {
              const helper = resolve(bindings.get(name));
              helpers[name] = source.slice(helper.start, helper.end);
              collect(helper);
            }
          });
        collect(value);
        if (result.has(key))
          throw new Error(`${file}:${key}: duplicate message`);
        result.set(key, {
          kind,
          source:
            value.type === "Literal"
              ? value.value
              : source.slice(value.start, value.end),
          texts,
          ...(Object.keys(helpers).length ? { helpers } : {}),
        });
      }
    }
    return result;
  }
  if (!calls.length) throw new Error(`${file}: no catalog found`);
  return calls.flatMap(([name, call]) => {
    const fi = leaves(call.arguments[0]);
    const us = leaves(call.arguments[1]);
    const overrides = call.arguments[2] ? leaves(call.arguments[2]) : new Map();
    for (const [key, value] of us) {
      if (!fi.has(key) || fi.get(key).kind !== value.kind)
        throw new Error(`${file}:${key}: English shape mismatch`);
    }
    for (const [key, value] of overrides) {
      if (!us.has(key) || us.get(key).kind !== value.kind)
        throw new Error(`${file}:${key}: UK override shape mismatch`);
    }
    return [...fi].map(([key, value]) => {
      if (!us.has(key))
        throw new Error(`${file}:${key}: missing English message`);
      return {
        key: `${file}#${name}.${key}`,
        fi: value,
        "en-US": us.get(key),
        "en-GB": overrides.get(key) ?? us.get(key),
      };
    });
  });
}

// The settings search owns its Finnish labels beside row IDs rather than in
// catalog(). Extract only displayed fields, never bilingual search synonyms.
export function extractSettings(sections, englishSource) {
  const shown = (value) =>
    Object.fromEntries(
      ["label", "intro", "desc", "group"]
        .filter((key) => key in value)
        .map((key) => [key, value[key]]),
    );
  const fi = Object.fromEntries(
    sections.map((section) => [
      section.id,
      {
        ...shown(section),
        rows: Object.fromEntries(
          section.rows.map((row) => [row.id, shown(row)]),
        ),
      },
    ]),
  );
  return extractCatalog(
    `${englishSource}\nconst fi = ${JSON.stringify(fi)};\nconst settingsIndexText = catalog(fi, settingsIndexEnglish);`,
    "settingsIndex.ts",
  );
}

export async function readCatalogs(
  dir = new URL("../src/text/", import.meta.url),
) {
  // The index generates some rows with map(). Use Vite's existing TS loader
  // for that module, not a second interpreter for application expressions.
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("../../", dir)),
    server: { middlewareMode: true, watch: null, ws: false },
    appType: "custom",
  });
  try {
    const { settingsSections } = await server.ssrLoadModule(
      "/src/app/settingsIndex.ts",
    );
    return readdirSync(dir)
      .filter((name) => /\.tsx?$/.test(name))
      .sort()
      .flatMap((name) => {
        const source = readFileSync(new URL(name, dir), "utf8");
        return name === "settingsIndex.ts"
          ? extractSettings(settingsSections, source)
          : extractCatalog(source, name);
      });
  } finally {
    await server.close();
  }
}

// Fixed, catalog-derived vocabulary. A set difference recomputed from both
// languages would let a newly copied word exempt itself from the checks.
export const foreignWords = {
  fi: [
    "settings",
    "cancel",
    "retry",
    "restore",
    "loading",
    "failed",
    "workspace",
    "conversation",
  ],
  en: [
    "tila",
    "palauta",
    "sulje",
    "avaa",
    "peruuta",
    "tallenna",
    "poista",
    "valitse",
    "takaisin",
    "odottaa",
    "virhe",
    "onnistui",
  ],
};

const allowedWords = {
  "models.tsx#modelsText.savedToPi:fi": ["settings"], // Native settings.json filename.
  "serverIntegrations.tsx#serverIntegrationsText.sameSettings:fi": ["settings"], // Dropbox's external Settings page.
};

export function languageFindings(rows) {
  const findings = [];
  for (const row of rows) {
    for (const language of ["fi", "en-US", "en-GB"]) {
      const forbidden = new Set(foreignWords[language === "fi" ? "fi" : "en"]);
      for (const text of row[language].texts) {
        const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
        const allowed = allowedWords[`${row.key}:${language}`] ?? [];
        const matches = [
          ...new Set(
            words.filter(
              (word) => forbidden.has(word) && !allowed.includes(word),
            ),
          ),
        ];
        if (language !== "fi" && /[äöå]/i.test(text))
          matches.push("Finnish letter");
        const otherRegion =
          language === "en-US"
            ? /\b(organisations?|organis(?:e|es|ed|ing)|cancelled|cancelling|authorisations?)\b/i
            : language === "en-GB"
              ? /\b(organizations?|canceled|canceling|authorizations?)\b/i
              : undefined;
        if (otherRegion?.test(text)) matches.push("Other English region");
        if (matches.length)
          findings.push({ key: row.key, language, text, matches });
      }
    }
  }
  return findings;
}

// A single JSON document on stdout, suitable for redirection.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2)
    throw new Error(
      "Usage: node web/scripts/catalog-review.mjs > catalog-review.json",
    );
  console.log(JSON.stringify(await readCatalogs(), null, 2));
}
