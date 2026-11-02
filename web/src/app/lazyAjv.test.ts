import { describe, expect, it } from "vitest";
import { LazyAjv } from "./lazyAjv";

const base = "https://open-habitat.invalid/test/lazy.schema.json";

describe("LazyAjv", () => {
  it("compiles nothing until a validator is called", () => {
    const ajv = new LazyAjv({ strict: false });
    // An unresolvable reference fails Ajv's compile; creating the validator
    // must not, or every module would pay for compiling at load again.
    const broken = ajv.compile({ $ref: "https://missing.invalid/x.json" });
    expect(() => broken({})).toThrow();
  });

  it("resolves schemas registered after the validator was made", () => {
    const ajv = new LazyAjv({ strict: false });
    const valid = ajv.compile({ $ref: `${base}#/$defs/name` });
    ajv.addSchema({
      $id: base,
      $defs: { name: { type: "string", minLength: 1 } },
    });
    expect(valid("x")).toBe(true);
    expect(valid("")).toBe(false);
    expect(valid(1)).toBe(false);
  });

  it("checks formats only when asked to, as before", () => {
    const schema = { type: "string", format: "date-time" };
    expect(new LazyAjv({ strict: false }).compile(schema)("not a date")).toBe(
      true,
    );
    const formats = new LazyAjv({ strict: false, addFormats: true });
    expect(formats.compile(schema)("not a date")).toBe(false);
    expect(formats.compile(schema)("2026-11-02T10:00:00Z")).toBe(true);
  });

  it("throws on first use of a schema that was never registered", () => {
    const ajv = new LazyAjv({ strict: false });
    const missing = ajv.getSchema(`${base}#/$defs/none`);
    expect(() => missing({})).toThrow(/missing contract/);
  });
});
