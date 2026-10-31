import type { SessionMarker } from "../app/sessionSettings";
import { useText } from "../i18n";
import { sessionSettingsRowText } from "../text/sessionSettingsRow";
import { modelDisplayName, thinkingDisplayName } from "./modelPresentation";

export function SessionSettingsRow({ marker }: { marker: SessionMarker }) {
  const t = useText(sessionSettingsRowText);
  return (
    <aside
      className="ah-session-settings"
      data-testid="session-settings-row"
      role="note"
      aria-label={t.label}
    >
      {marker.compact !== undefined ? (
        <span>
          {t.compaction} · {marker.compact}
        </span>
      ) : null}
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
