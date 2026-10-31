import { describe, expect, it } from "vitest";
import { providerRoute } from "./ModelField";

describe("providerRoute", () => {
  it("resolves a known provider to a named route", () => {
    const route = providerRoute("anthropic");
    expect(route).toHaveLength(3);
    expect(route?.[0]).toBeTruthy();
  });

  // The dev server's React Refresh reads `constructor` from every export of a
  // component module; an inherited name that resolved threw on every load.
  it.each(["constructor", "toString", "__proto__", "hasOwnProperty", "google"])(
    "treats %s as an unknown provider",
    (name) => {
      expect(providerRoute(name)).toBeUndefined();
    },
  );
});
