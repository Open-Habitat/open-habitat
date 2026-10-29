import { useEffect } from "react";
import { ControlButton } from "../components/ControlElements";
import {
  checkBundle,
  reloadForNewBundle,
  useBundleState,
} from "./bundleRelease";

/** Release version and short commit, as the gateway reports them. */
export function versionLabel(version?: string, commit?: string) {
  if (!version) return "ei saatu";
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
          Tämä välilehti käyttää vanhempaa versiota.
        </span>
        <ControlButton
          data-testid="version-reload"
          size="row"
          onPress={reloadForNewBundle}
        >
          Lataa uudelleen
        </ControlButton>
      </>
    );
  return (
    <span data-testid="bundle-state" data-state={bundle.status}>
      {bundle.status === "current"
        ? "Tämä välilehti on ajan tasalla."
        : "Välilehden versiota ei ole vielä tarkistettu."}
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
        <strong>Versio</strong>
        <span className="s-desc">Palvelimella nyt käynnissä oleva versio.</span>
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
      Palvelimen versio:{" "}
      <code data-testid="version-value">{versionLabel(version, commit)}</code>{" "}
      <TabState />
    </p>
  );
}
