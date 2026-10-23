import { expect, it } from "vitest";
import type { ModelChoice } from "./ModelPicker";
import { modelCapabilityRank, modelDisplayName } from "./modelPresentation";

it("ranks capabilities independently of input order and keeps unranked entries stable", () => {
  const ids = [
    "claude-opus-5-5",
    "custom-z",
    "claude-haiku-4-5",
    "claude-fable-5-1",
    "custom-a",
    "claude-sonnet-5",
  ];
  const models = ids.map((id) => ({ id, name: id }));
  expect(
    [...models]
      .sort((a, b) => modelCapabilityRank(a) - modelCapabilityRank(b))
      .map((m) => m.id),
  ).toEqual([
    "claude-fable-5-1",
    "claude-opus-5-5",
    "claude-sonnet-5",
    "claude-haiku-4-5",
    "custom-z",
    "custom-a",
  ]);
  expect(models.map((m) => m.id)).toEqual(ids);
});
it("uses the matching provider's metadata rather than guessing from the id", () => {
  const models: ModelChoice[] = [
    { provider: "openai", id: "custom-model", name: "Different provider" },
    {
      provider: "claude-bridge",
      id: "custom-model",
      name: "Claude Fable 5.1 1M",
    },
  ];
  expect(modelDisplayName("claude-bridge/custom-model", models)).toBe(
    "Fable 5.1",
  );
  expect(modelDisplayName("openai/custom-model", models)).toBe(
    "Different provider",
  );
  expect(modelDisplayName("claude-bridge/claude-fable-5-1")).toBe("Fable 5.1");
  expect(modelDisplayName("custom/unknown-id")).not.toContain("unknown-id");
});
