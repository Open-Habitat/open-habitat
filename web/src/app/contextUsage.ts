import type { ContextUsage } from "../components/ContextRing";
import type { ModelChoice } from "../components/ModelPicker";
import { modelDisplayName } from "../components/modelPresentation";
import type { ConversationEvent } from "./conversationEvents";
import type { HistoryEntry } from "./history";
import type { Models } from "./PiModels";

/** The model a context window belongs to: the provider from a qualified id,
 * else from the newest native model change naming the same model. */
function catalogModel(
  model: string | undefined,
  entries: HistoryEntry[],
  models: ModelChoice[],
) {
  if (!model) return undefined;
  const [prefix, id] = model.includes("/")
    ? [model.slice(0, model.indexOf("/")), model.slice(model.indexOf("/") + 1)]
    : [undefined, model];
  let provider = prefix;
  for (let i = entries.length - 1; !provider && i >= 0; i--) {
    const entry = entries[i];
    if (entry.kind === "model_change" && entry.content.text.endsWith(`/${id}`))
      provider = entry.content.text.slice(0, -id.length - 1);
  }
  const same = models.filter((m) => m.id === id);
  return (
    same.find((m) => (m.provider ?? "openai-codex") === provider) ??
    (provider ? undefined : same[0])
  );
}

/**
 * Pi's own context-usage reading over the native history the browser holds:
 * the newest assistant usage after the latest compaction; a compaction after
 * it leaves the size unknown until Pi's next reply. Nothing before Pi's first
 * reply. The live journal says whether Pi is compacting now.
 */
export function contextUsage({
  entries,
  fragments = [],
  model,
  catalog,
}: {
  entries: HistoryEntry[];
  fragments?: ConversationEvent[];
  model?: string;
  catalog?: Models;
}): ContextUsage | undefined {
  let tokens: number | undefined;
  let compacted = false;
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.entry_type === "compaction") {
      compacted = true;
      break;
    }
    if (entry.kind === "assistant" && entry.context_tokens) {
      tokens = entry.context_tokens;
      break;
    }
  }
  let compacting = false;
  for (let i = fragments.length - 1; i >= 0; i--) {
    const marker = fragments[i].payload.marker;
    if (marker === "compaction_start" || marker === "compaction_end") {
      compacting = marker === "compaction_start";
      break;
    }
  }
  if (!compacting && !compacted && tokens === undefined) return undefined;
  const choice = catalogModel(model, entries, catalog?.models ?? []);
  return {
    phase: compacting ? "compacting" : compacted ? "after" : "known",
    tokens,
    window: choice?.context_window,
    autoCompaction: catalog?.auto_compaction,
    reserve: choice?.compaction_reserve_tokens,
    model: model ? modelDisplayName(model, catalog?.models) : undefined,
  };
}
