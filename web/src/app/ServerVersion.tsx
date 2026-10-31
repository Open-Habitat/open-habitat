import { useEffect } from "react";
import { ControlButton } from "../components/ControlElements";
import { liveText } from "../i18n";
import { serverVersionText } from "../text/serverVersion";
import {
  checkBundle,
  reloadForNewBundle,
  useBundleState,
} from "./bundleRelease";

const txt = liveText(serverVersionText);

/** Release version and short commit, as the gateway reports them. */
export function versionLabel(version?: string, commit?: string) {
  if (!version) return txt.missing;
  return commit ? `${version} (${commit.slice(0, 7)})` : version;
}

/** Whether this tab runs the bundle the server serves now. */
function TabState() {
  const bundle = useBundleState();
  useEffect(() => void checkBundle(), []);
  if (bundle.status === "newer")
    return (
      <>
        <span data-testid="bundle-state" data-state={bundle.status}>
          {txt.older}
        </span>
        <ControlButton
          data-testid="version-reload"
          size="row"
          onPress={reloadForNewBundle}
        >
          {txt.reload}
        </ControlButton>
      </>
    );
  return (
    <span data-testid="bundle-state" data-state={bundle.status}>
      {bundle.status === "current" ? txt.current : txt.unchecked}
    </span>
  );
}

/** The version row of Asetukset → Palvelin. */
export function ServerVersionRow({
  version,
  commit,
}: {
  version?: string;
  commit?: string;
}) {
  return (
    <div
      data-testid="server-version"
      className="s-row"
      data-settings-row="server-version"
      tabIndex={-1}
    >
      <div className="s-lbl">
        <strong>{txt.version}</strong>
        <span className="s-desc">{txt.desc}</span>
      </div>
      <div className="s-val s-version">
        <code data-testid="version-value">{versionLabel(version, commit)}</code>
        <TabState />
      </div>
    </div>
  );
}

/** The line at the bottom of every settings section. */
export function ServerVersionLine({
  version,
  commit,
}: {
  version?: string;
  commit?: string;
}) {
  return (
    <p className="md-note s-version-line">
      {txt.line}{" "}
      <code data-testid="version-value">{versionLabel(version, commit)}</code>{" "}
      <TabState />
    </p>
  );
}
