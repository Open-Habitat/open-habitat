import { expect, it } from "vitest";
import type { ModelChoice } from "./ModelPicker";
import {
  modelCapabilityRank,
  modelDescription,
  modelDisplayName,
} from "./modelPresentation";

it("ranks capabilities independently of input order and keeps unranked entries stable", () => {
  const ids = [
    "claude-opus-5-5",
    "custom-z",
    "claude-haiku-4-5",
    "claude-fable-5-2",
    "custom-a",
    "claude-sonnet-5",
  ];
  const models = ids.map((id) => ({ id, name: id }));
  expect(
    [...models]
      .sort((a, b) => modelCapabilityRank(a) - modelCapabilityRank(b))
      .map((m) => m.id),
  ).toEqual([
    "claude-fable-5-2",
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
      name: "Claude Fable 5.2 1M",
    },
  ];
  expect(modelDisplayName("claude-bridge/custom-model", models)).toBe(
    "Fable 5.2",
  );
  expect(modelDisplayName("openai/custom-model", models)).toBe(
    "Different provider",
  );
  expect(modelDisplayName("claude-bridge/claude-fable-5-2")).toBe("Fable 5.2");
  // History may outlive the catalog that named its model.
  expect(modelDisplayName("claude-bridge/claude-fable-5-1")).toBe("Fable 5.1");
  expect(modelDisplayName("openai-codex/gpt-6.1-terra")).toBe("GPT-6.1 Terra");
  expect(modelDisplayName("openai-codex/gpt-6-astra")).toBe("GPT-6 Astra");
  expect(modelDisplayName("openai-codex/gpt-5.5")).toBe("GPT 5.5");
  expect(modelDisplayName("custom/unknown-id")).not.toContain("unknown-id");
});
it("ranks OpenAI families by capability and describes only known families", () => {
  const ids = ["gpt-6-luna", "gpt-6.1-terra", "gpt-6-astra", "gpt-6.1-sol"];
  expect(
    ids
      .map((id) => ({ id, name: id }))
      .sort((a, b) => modelCapabilityRank(a) - modelCapabilityRank(b))
      .map((m) => m.id),
  ).toEqual(["gpt-6-astra", "gpt-6.1-sol", "gpt-6.1-terra", "gpt-6-luna"]);
  expect(modelDescription("claude-bridge/claude-opus-5-5")).toMatch(/\S/);
  expect(modelDescription("gpt-6-luna-preview")).toBe(
    modelDescription("gpt-6-luna"),
  );
  expect(modelDescription("gpt-5.5")).toBeUndefined();
  expect(modelDescription("custom-model")).toBeUndefined();
});
