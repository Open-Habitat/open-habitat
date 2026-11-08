import { syncedTime } from "../app/integrations";
import type { SessionMarker } from "../app/sessionSettings";
import { useText } from "../i18n";
import { sessionSettingsRowText } from "../text/sessionSettingsRow";
import { Icon } from "./Icon";
import { modelDisplayName, thinkingDisplayName } from "./modelPresentation";

/** Pi's compaction in the conversation: when it happened, and the summary
 * that now stands for the older messages, folded away. */
function CompactionMarker({ marker }: { marker: SessionMarker }) {
  const t = useText(sessionSettingsRowText);
  const summary = marker.compact?.trim();
  return (
    <aside
      className="ah-session-settings ah-compaction-mark"
      data-testid="compaction-marker"
      role="note"
    >
      <span>
        <Icon name="check" width={14} height={14} />
        {t.compacted(marker.at ? syncedTime(marker.at) : "")}
      </span>
      {summary ? (
        <details>
          <summary>{t.summary}</summary>
          <p className="ah-compaction-summary">{summary}</p>
        </details>
      ) : null}
    </aside>
  );
}

export function SessionSettingsRow({ marker }: { marker: SessionMarker }) {
  const t = useText(sessionSettingsRowText);
  if (marker.compact !== undefined) return <CompactionMarker marker={marker} />;
  return (
    <aside
      className="ah-session-settings"
      data-testid="session-settings-row"
      role="note"
      aria-label={t.label}
    >
      {marker.model !== undefined ? (
        <span data-testid="model-change">
          {t.modelChanged} {modelDisplayName(marker.oldModel)} →{" "}
          {modelDisplayName(marker.model)}
        </span>
      ) : null}
      {marker.thinking !== undefined ? (
        <span data-testid="thinking-change">
          {t.thinkingChanged} {thinkingDisplayName(marker.oldThinking)} →{" "}
          {thinkingDisplayName(marker.thinking)}
        </span>
      ) : null}
    </aside>
  );
}
