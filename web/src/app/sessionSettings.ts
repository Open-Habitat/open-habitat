import type { HistoryEntry } from "./history";

export type SessionMarker = {
  key: string;
  model?: string;
  thinking?: string;
  oldModel?: string;
  oldThinking?: string;
  compact?: string;
};
export function sessionMarkers(
  entries: HistoryEntry[],
): Map<string, SessionMarker> {
  const markers = new Map<string, SessionMarker>();
  let model: string | undefined;
  let thinking: string | undefined;
  for (const entry of entries) {
    const isModel = entry.kind === "model_change";
    const isThinking = entry.entry_type === "thinking_level_change";
    if (!isModel && !isThinking && entry.entry_type !== "compaction") continue;
    if (entry.entry_type === "compaction") {
      markers.set(entry.entry_key, {
        key: entry.entry_key,
        compact: entry.content.text,
      });
      continue;
    }
    const next = entry.content.text;
    // Startup entries establish the baseline, not conversation content. Repeated
    // native settings also occur after startup/reconnect and carry no change.
    const previous = isModel ? model : thinking;
    if (previous !== undefined && previous !== next) {
      const marker: SessionMarker = { key: entry.entry_key };
      if (isModel) {
        marker.oldModel = previous;
        marker.model = next;
      } else {
        marker.oldThinking = previous;
        marker.thinking = next;
      }
      markers.set(entry.entry_key, marker);
    }
    if (isModel) model = next;
    else thinking = next;
  }
  return markers;
}
export function latestSettings(entries: HistoryEntry[]) {
  let model: string | undefined;
  let thinking: string | undefined;
  for (const entry of entries) {
    if (entry.kind === "model_change") model = entry.content.text;
    else if (entry.kind === "assistant" && entry.model) model = entry.model;
    if (entry.entry_type === "thinking_level_change")
      thinking = entry.content.text;
  }
  return { model, thinking };
}
export function hiddenSessionEntry(
  entry: HistoryEntry,
  markers: Map<string, SessionMarker>,
) {
  return (
    entry.kind === "recap" ||
    entry.entry_type === "session_info" ||
    ((entry.kind === "model_change" ||
      entry.entry_type === "thinking_level_change" ||
      entry.entry_type === "compaction") &&
      !markers.has(entry.entry_key))
  );
}
