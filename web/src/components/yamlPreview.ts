import { LineCounter, parseDocument } from "yaml";

export type YamlValue =
  | null
  | string
  | number
  | bigint
  | boolean
  | YamlValue[]
  | Map<string, YamlValue>;

export function parseJsonPreview(raw: string): YamlPreview {
  if (new TextEncoder().encode(raw).byteLength > 1024 * 1024)
    return { ok: false, reason: "unsupported" };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  let remaining = 5000;
  function convert(v: unknown, depth: number): YamlValue {
    if (--remaining < 0 || depth > 100) throw new Error("limit");
    if (Array.isArray(v)) return v.map((item) => convert(item, depth + 1));
    if (v && typeof v === "object")
      return new Map(
        Object.entries(v).map(([key, item]) => [key, convert(item, depth + 1)]),
      );
    return v as null | string | number | boolean;
  }
  try {
    return { ok: true, value: convert(value, 0) };
  } catch {
    return { ok: false, reason: "unsupported" };
  }
}

export type YamlPreview =
  | { ok: true; value: YamlValue }
  | { ok: false; reason: "invalid" | "unsupported"; line?: number };

/** Files are untrusted data. Core types only; keep maps as maps so keys such
 * as __proto__ are data. Bound the expanded tree as well as alias expansion:
 * a valid YAML graph may be cyclic or too large to display as an open tree. */
export function parseYamlPreview(raw: string): YamlPreview {
  if (new TextEncoder().encode(raw).byteLength > 1024 * 1024)
    return { ok: false, reason: "unsupported" };
  try {
    const lineCounter = new LineCounter();
    const doc = parseDocument(raw, {
      schema: "core",
      customTags: [],
      merge: false,
      intAsBigInt: true,
      lineCounter,
    });
    if (doc.errors.length) {
      return {
        ok: false,
        reason: "invalid",
        line: doc.errors[0].linePos?.[0].line,
      };
    }
    if (doc.warnings.length) return { ok: false, reason: "unsupported" };
    const value: unknown = doc.toJS({ mapAsMap: true, maxAliasCount: 100 });
    let remaining = 5000;
    const ancestors = new Set<object>();
    function check(v: unknown, depth: number): v is YamlValue {
      if (--remaining < 0 || depth > 100) return false;
      if (
        v === null ||
        ["string", "boolean", "number", "bigint"].includes(typeof v)
      )
        return true;
      if (typeof v !== "object" || !v || ancestors.has(v)) return false;
      ancestors.add(v);
      const valid = Array.isArray(v)
        ? v.every((item) => check(item, depth + 1))
        : v instanceof Map &&
          [...v].every(
            ([key, item]) => typeof key === "string" && check(item, depth + 1),
          );
      ancestors.delete(v);
      return valid;
    }
    return check(value, 0)
      ? { ok: true, value }
      : { ok: false, reason: "unsupported" };
  } catch {
    return { ok: false, reason: "unsupported" };
  }
}
