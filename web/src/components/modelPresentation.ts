import { liveText } from "../i18n";
import { modelsText } from "../text/models";
import type { ModelChoice } from "./ModelPicker";

const txt = liveText(modelsText);

// Product capability order within a provider, not provider response order or
// lexical model ids. OpenAI's order follows the Pi catalog's declared prices
// (Astra above Sol above Terra above Luna), as the families carry no rank.
const familyTier: Record<ModelFamily, number> = {
  fable: 0,
  opus: 1,
  sonnet: 2,
  haiku: 3,
  astra: 0,
  sol: 1,
  terra: 2,
  luna: 3,
};
export type ModelFamily = keyof typeof modelsText.fi.families;

/** The product family a model id names, or undefined for one we do not know:
 * an unknown model gets no description rather than a guess. */
export function modelFamily(id?: string): ModelFamily | undefined {
  const bare = id?.replace(/^[^/]+\//, "") ?? "";
  return (/^claude-(fable|opus|sonnet|haiku)-/.exec(bare)?.[1] ??
    /^gpt-[\d.]+-(astra|sol|terra|luna)(?:-|$)/.exec(bare)?.[1]) as
    | ModelFamily
    | undefined;
}

export function modelCapabilityRank(model: ModelChoice) {
  const family = modelFamily(model.id);
  return family ? familyTier[family] : 4;
}

/** What the model is good for compared with the provider's others; the same
 * words wherever a model is shown or chosen. */
export function modelDescription(id?: string) {
  const family = modelFamily(id);
  return family ? txt.families[family] : undefined;
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
  // Pi's own names for OpenAI's families: "GPT-6.1 Terra".
  const gpt = /^gpt-([\d.]+)-(astra|sol|terra|luna)$/.exec(id ?? "");
  if (gpt) return `GPT-${gpt[1]} ${gpt[2][0].toUpperCase()}${gpt[2].slice(1)}`;
  if (id && /^gpt-/i.test(id)) return id.replace(/^gpt-/i, "GPT ");
  return txt.modelUnknown;
}

export function thinkingDisplayName(level?: string) {
  return level ? level[0].toUpperCase() + level.slice(1) : txt.unknown;
}
