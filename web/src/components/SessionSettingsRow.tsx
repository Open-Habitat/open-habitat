import type { SessionMarker } from "../app/sessionSettings";
import { modelDisplayName, thinkingDisplayName } from "./modelPresentation";

export function SessionSettingsRow({ marker }: { marker: SessionMarker }) {
  return (
    <aside
      className="ah-session-settings"
      data-testid="session-settings-row"
      role="note"
      aria-label="Keskustelun asetukset"
    >
      {marker.compact !== undefined ? (
        <span>Tiivistys · {marker.compact}</span>
      ) : null}
      {marker.model !== undefined ? (
        <span data-testid="model-change">
          Malli vaihtui: {modelDisplayName(marker.oldModel)} →{" "}
          {modelDisplayName(marker.model)}
        </span>
      ) : null}
      {marker.thinking !== undefined ? (
        <span data-testid="thinking-change">
          Ajattelu vaihtui: {thinkingDisplayName(marker.oldThinking)} →{" "}
          {thinkingDisplayName(marker.thinking)}
        </span>
      ) : null}
    </aside>
  );
}
