import { expect, it } from "vitest";
import { cloneProgressText } from "./cloneProgress";

it("does not invent a byte total from Git's object percentage", () => {
  expect(cloneProgressText("receiving", 22, 1310720)).toBe(
    "Haetaan 22 % · 1,3 MiB",
  );
  expect(cloneProgressText("receiving", 22, 1310720, 10485760)).toBe(
    "Haetaan 22 % · 1,3 MiB / 10 MiB",
  );
});
it("does not present checkout stage percentage as download progress", () => {
  expect(cloneProgressText("checkout", 100)).toBe("Viimeistellään…");
  expect(cloneProgressText("verifying")).toBe("Viimeistellään…");
});
