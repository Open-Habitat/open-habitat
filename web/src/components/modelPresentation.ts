import type { ModelChoice } from "./ModelPicker";

// Product capability order, not provider response order or lexical model ids.
const claudeRank = ["fable", "opus", "sonnet", "haiku"];
export function modelCapabilityRank(model: ModelChoice) {
  const family = /^claude-(fable|opus|sonnet|haiku)-/.exec(model.id)?.[1];
  const rank = family ? claudeRank.indexOf(family) : -1;
  return rank < 0 ? claudeRank.length : rank;
}

export function modelDisplayName(model?: string, models: ModelChoice[] = []) {
  const id = model?.replace(/^[^/]+\//, "");
  const provider = model?.includes("/") ? model.split("/")[0] : undefined;
  const metadata = models.find(
    (m) =>
      m.id === id && (!provider || (m.provider ?? "openai-codex") === provider),
  );
  if (metadata?.name.trim())
    return metadata.name.replace(/^Claude\s+/, "").replace(/\s+1M$/, "");
  // Native history may outlive its catalog. Recognized ids retain readable names.
  const claude =
    /^claude-(fable|opus|sonnet|haiku)-(\d+)(?:[.-](\d+))?(?:-latest)?$/.exec(
      id ?? "",
    );
  if (claude)
    return `${claude[1][0].toUpperCase()}${claude[1].slice(1)} ${claude[2]}${claude[3] ? `.${claude[3]}` : ""}`;
  if (id && /^gpt-/i.test(id)) return id.replace(/^gpt-/i, "GPT ");
  return "Malli ei tiedossa";
}

export function thinkingDisplayName(level?: string) {
  return level ? level[0].toUpperCase() + level.slice(1) : "Ei tiedossa";
}
