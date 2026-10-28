import { useCallback, useMemo, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { Icon } from "../components/Icon";
import { LetterMark } from "../components/Integrations";
import { NativeDisconnect } from "../components/NativeDisconnect";
import { Button } from "../components/Primitives";
import { StatusMark } from "../components/Status";
import { type GiteaConnection, host, usable } from "./gitea";
import { type GitLabConnection, usableGitLab } from "./gitlab";
import { IntegrationsSettings } from "./IntegrationsSettings";
import type { IntegrationList, ProviderId } from "./integrations";
import type { Workspace } from "./snapshot";

export type NativeState =
  | "connected"
  | "disconnected"
  | "expired"
  | "pending"
  | "partial"
  | "unknown"
  | "unreachable"
  | "verifying";
const states: Record<NativeState, { label: string; description: string }> = {
  connected: {
    label: "Yhdistetty",
    description: "Git ja gh toimivat työtiloissa.",
  },
  disconnected: {
    label: "Ei yhdistetty",
    description:
      "GitHub-yhteyttä ei löytynyt, joten git push ja gh eivät toimi. Yhdistä kirjautumalla GitHubilla.",
  },
  expired: {
    label: "Vanhentunut",
    description:
      "GitHub ei enää hyväksy palvelimelle tallennettua valtuutusta, joten git push ja gh eivät toimi. Yhdistä uudelleen kirjautumalla GitHubilla.",
  },
  pending: {
    label: "Yhdistäminen kesken",
    description:
      "GitHub-yhteyttä valmistellaan. Odota ennen Git-toimintojen käyttöä.",
  },
  partial: {
    label: "Osittainen yhteys",
    description:
      "GitHub-yhteys ei ole vielä kokonaan valmis. Git-toiminnot eivät välttämättä onnistu.",
  },
  unknown: {
    label: "Tilaa ei tiedetä",
    description: "GitHub-yhteyden tilaa ei juuri nyt voitu vahvistaa.",
  },
  unreachable: {
    label: "GitHub ei vastaa",
    description:
      "Palvelin ei saanut GitHubiin yhteyttä. Valtuutus on tallessa; palvelin yrittää itse uudelleen.",
  },
  verifying: {
    label: "Tarkistetaan",
    description:
      "GitHub hylkäsi valtuutuksen kerran. Palvelin tarkistaa sen vielä uudelleen.",
  },
};
const codeHosts: ProviderId[] = ["gitea", "gitlab"];
type Hosted = {
  w: Workspace;
  kind: "github" | "gitea" | "gitlab";
  repo: string;
  base?: string;
};

/** Asetukset › Koodipalvelut (proto-integration-grouping, Kolme sivua): the
 * hosts workspaces are cloned from and pushed to, and the workspaces each
 * one serves, read from the snapshot the sidebar already holds. Workspaces
 * are opened and removed elsewhere; this page says which host's credential
 * each one depends on. */
export function CodeHostSettings({
  csrf,
  nativeState,
  nativeLogin,
  onReconnect,
  onDisconnect,
  workspaces,
  onNewWorkspace,
}: {
  csrf?: string;
  nativeState?: NativeState;
  nativeLogin?: string;
  onReconnect?: () => void;
  onDisconnect?: () => void;
  workspaces?: readonly Workspace[];
  onNewWorkspace?: () => void;
}) {
  const state = states[nativeState ?? "unknown"];
  const [disconnectNotice, setDisconnectNotice] = useState(false);
  const [gitea, setGitea] = useState<GiteaConnection[]>();
  const [gitlab, setGitLab] = useState<GitLabConnection[]>();
  const onList = useCallback(
    // Unreadable tea or glab settings say nothing about a clone's server.
    (list: IntegrationList) => {
      setGitea(list.gitea?.state === "ok" ? list.gitea.connections : undefined);
      setGitLab(
        list.gitlab?.state === "ok" ? list.gitlab.connections : undefined,
      );
    },
    [],
  );
  const hosted = useMemo(
    () =>
      (workspaces ?? [])
        .filter((w) => w.presence === "present")
        .flatMap((w): Hosted[] =>
          w.gitea_origin
            ? [
                {
                  w,
                  kind: "gitea",
                  repo: w.gitea_origin.full_name,
                  base: w.gitea_origin.base_url,
                },
              ]
            : w.gitlab_origin
              ? [
                  {
                    w,
                    kind: "gitlab",
                    repo: w.gitlab_origin.full_name,
                    base: w.gitlab_origin.base_url,
                  },
                ]
              : w.git_summary?.github_repo
                ? [
                    {
                      w,
                      kind: "github",
                      repo: w.git_summary.github_repo,
                    },
                  ]
                : [],
        )
        .sort((a, b) =>
          (a.w.display_name ?? a.w.name).localeCompare(
            b.w.display_name ?? b.w.name,
            "fi",
          ),
        ),
    [workspaces],
  );
  const githubTrouble =
    nativeState === "expired" || nativeState === "disconnected"
      ? "Push ei onnistu ennen kuin GitHub-yhteys on korjattu. Paikallinen työ jatkuu."
      : nativeState === "partial"
        ? "Push ei välttämättä onnistu ennen kuin GitHub-yhteys on valmis. Paikallinen työ jatkuu."
        : nativeState === "unreachable"
          ? "Push odottaa, kunnes GitHub vastaa taas. Paikallinen työ jatkuu."
          : "";
  // A clone names a repository on a server, not an account: it is in trouble
  // only when none of the person's logins to that server is usable.
  const giteaTrouble = (base: string) =>
    gitea?.some((c) => c.base_url === base && usable(c))
      ? ""
      : gitea
        ? `Pull ja push eivät onnistu ennen kuin ${host(base)}-yhteys on kunnossa. Paikallinen työ jatkuu.`
        : "";
  // glab holds one login per server; the server's clones need it usable.
  const gitlabTrouble = (base: string) =>
    gitlab?.some((c) => c.base_url === base && usableGitLab(c))
      ? ""
      : gitlab
        ? `Pull ja push eivät onnistu ennen kuin GitLab-yhteys palvelimelle ${host(base)} on kunnossa. Paikallinen työ jatkuu.`
        : "";
  return (
    <div className="s-stack">
      <p className="s-intro">
        Palvelut, joista työtilat kloonataan ja joihin agentit pushaavat.
      </p>
      <div className="s-card">
        <div
          className="s-row s-marked"
          data-settings-row="github"
          tabIndex={-1}
        >
          <LetterMark mark="GH" tone={0} />
          <div className="s-lbl">
            <strong>GitHub</strong>
            <span
              className={`s-desc${nativeState === "expired" ? " s-bad" : ""}`}
            >
              {nativeState === "connected" && nativeLogin
                ? `Kirjautunut käyttäjänä ${nativeLogin}. `
                : ""}
              {state.description} Selaimesta uloskirjautuminen ei poista
              palvelimen valtuutusta.
            </span>
          </div>
          <div
            className="s-val"
            data-testid="github-native-state"
            data-state={nativeState ?? "unknown"}
          >
            <StatusMark
              label={state.label}
              kind={
                nativeState === "connected"
                  ? "success"
                  : nativeState === "expired"
                    ? "error"
                    : "unknown"
              }
              tone={
                nativeState === "connected"
                  ? "success"
                  : nativeState === "expired"
                    ? "danger"
                    : "warning"
              }
            />
            {/* Every GitHub sign-in hands its token to the person's gh, so
                the same sign-in also connects a missing login. A working
                login is replaced only by this explicit reconnect, for
                example to swap an expiring token for a lasting one. */}
            {(nativeState === "expired" ||
              nativeState === "disconnected" ||
              nativeState === "connected") &&
              onReconnect && (
                <Button
                  size="row"
                  variant={
                    nativeState === "connected" ? "secondary" : "primary"
                  }
                  data-testid="github-reconnect"
                  label={
                    nativeState === "disconnected"
                      ? "Yhdistä GitHub"
                      : "Yhdistä GitHub uudelleen"
                  }
                  onPress={onReconnect}
                />
              )}
          </div>
          {csrf && nativeState === "connected" && (
            <div className="s-editor">
              <NativeDisconnect
                csrf={csrf}
                onDisconnected={() => {
                  setDisconnectNotice(true);
                  onDisconnect?.();
                }}
              />
            </div>
          )}
          {disconnectNotice && (
            <p className="s-editor" role="status">
              Paikallinen gh-valtuutus poistettu. GitHubin OAuth-lupaa ei
              peruttu.
            </p>
          )}
        </div>
      </div>
      <div className="s-gitea" data-settings-row="gitea" tabIndex={-1}>
        <IntegrationsSettings
          csrf={csrf}
          only={codeHosts}
          compact
          onList={onList}
          onNewWorkspace={onNewWorkspace}
        />
      </div>
      <section
        className="s-stack"
        data-settings-row="workspaces"
        tabIndex={-1}
        aria-labelledby="code-host-workspaces"
      >
        <h3 className="s-h3" id="code-host-workspaces">
          Tuodut työtilat
          {hosted.length ? (
            <span className="s-count">{hosted.length}</span>
          ) : null}
        </h3>
        <div className="s-card" data-testid="code-host-workspaces">
          {hosted.map(({ w, kind, repo, base }) => {
            const trouble =
              kind === "github"
                ? githubTrouble
                : kind === "gitlab"
                  ? gitlabTrouble(base ?? "")
                  : giteaTrouble(base ?? "");
            return (
              <div
                className="s-ws"
                key={w.workspace_id}
                data-testid="code-host-workspace"
                data-host={kind}
              >
                <Icon name="folder" />
                <strong>{w.display_name ?? w.name}</strong>
                <LetterMark
                  mark={
                    kind === "github" ? "GH" : kind === "gitlab" ? "GL" : "Gt"
                  }
                  tone={kind === "github" ? 0 : kind === "gitlab" ? 2 : 3}
                  small
                />
                <span className="s-desc">
                  <code>{repo}</code> ·{" "}
                  {kind === "github"
                    ? "GitHub"
                    : `${kind === "gitlab" ? "GitLab" : "Gitea"} ${host(base ?? "")}`}
                </span>
                {trouble ? (
                  <span className="s-desc s-bad">{trouble}</span>
                ) : null}
              </div>
            );
          })}
          <div className="s-row">
            <p className="s-desc">
              {hosted.length
                ? "Työtilat avataan ja poistetaan sivupalkista. Täällä näkyy, minkä palvelun tunnuksella kukin synkronoi."
                : "Näistä palveluista ei ole vielä tuotu työtiloja. Uusi työtila listaa yllä olevien palvelujen repot."}
            </p>
            {onNewWorkspace ? (
              <div className="s-val">
                <ControlButton
                  data-testid="code-host-new-workspace"
                  size="row"
                  onPress={onNewWorkspace}
                >
                  Uusi työtila…
                </ControlButton>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
