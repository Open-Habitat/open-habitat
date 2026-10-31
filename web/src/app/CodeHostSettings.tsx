import { useCallback, useMemo, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { Icon } from "../components/Icon";
import { LetterMark } from "../components/Integrations";
import { NativeDisconnect } from "../components/NativeDisconnect";
import { Button } from "../components/Primitives";
import { StatusMark } from "../components/Status";
import { liveText } from "../i18n";
import { codeHostsText } from "../text/codeHosts";
import { type GiteaConnection, host, usable } from "./gitea";
import { type GitLabConnection, usableGitLab } from "./gitlab";
import { IntegrationsSettings } from "./IntegrationsSettings";
import type { IntegrationList, ProviderId } from "./integrations";
import type { Workspace } from "./snapshot";

const txt = liveText(codeHostsText);

export type NativeState =
  | "connected"
  | "disconnected"
  | "expired"
  | "pending"
  | "partial"
  | "unknown"
  | "unreachable"
  | "verifying";
const states = (): Record<
  NativeState,
  { label: string; description: string }
> => ({
  connected: {
    label: txt.connected,
    description: txt.connectedDesc,
  },
  disconnected: {
    label: txt.disconnected,
    description: txt.disconnectedDesc,
  },
  expired: {
    label: txt.expired,
    description: txt.expiredDesc,
  },
  pending: {
    label: txt.pending,
    description: txt.pendingDesc,
  },
  partial: {
    label: txt.partial,
    description: txt.partialDesc,
  },
  unknown: {
    label: txt.unknown,
    description: txt.unknownDesc,
  },
  unreachable: {
    label: txt.unreachable,
    description: txt.unreachableDesc,
  },
  verifying: {
    label: txt.verifying,
    description: txt.verifyingDesc,
  },
});
/** Why the host could not settle the state: the snapshot's
 * native_github.reason, present only beside "unknown". */
export type NativeUnknownReason =
  | "checking"
  | "timeout"
  | "github_error"
  | "unrecognized";
const unknownReasons = (): Record<
  NativeUnknownReason,
  { label: string; description: string }
> => ({
  checking: { label: txt.checking, description: txt.checkingDesc },
  timeout: { label: txt.unknown, description: txt.timeoutDesc },
  github_error: { label: txt.unknown, description: txt.githubErrorDesc },
  unrecognized: { label: txt.unknown, description: txt.unrecognizedDesc },
});
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
  nativeReason,
  nativeLogin,
  onReconnect,
  onDisconnect,
  workspaces,
  onNewWorkspace,
}: {
  csrf?: string;
  nativeState?: NativeState;
  nativeReason?: NativeUnknownReason;
  nativeLogin?: string;
  onReconnect?: () => void;
  onDisconnect?: () => void;
  workspaces?: readonly Workspace[];
  onNewWorkspace?: () => void;
}) {
  const state =
    (nativeState ?? "unknown") === "unknown" && nativeReason
      ? (unknownReasons()[nativeReason] ?? states().unknown)
      : states()[nativeState ?? "unknown"];
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
      ? txt.pushBroken
      : nativeState === "partial"
        ? txt.pushPartial
        : nativeState === "unreachable"
          ? txt.pushWaits
          : "";
  // A clone names a repository on a server, not an account: it is in trouble
  // only when none of the person's logins to that server is usable.
  const giteaTrouble = (base: string) =>
    gitea?.some((c) => c.base_url === base && usable(c))
      ? ""
      : gitea
        ? txt.giteaTrouble(host(base))
        : "";
  // glab holds one login per server; the server's clones need it usable.
  const gitlabTrouble = (base: string) =>
    gitlab?.some((c) => c.base_url === base && usableGitLab(c))
      ? ""
      : gitlab
        ? txt.gitlabTrouble(host(base))
        : "";
  return (
    <div className="s-stack">
      <p className="s-intro">{txt.intro}</p>
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
                ? txt.signedInAs(nativeLogin)
                : ""}
              {state.description} {txt.logoutKeeps}
            </span>
          </div>
          <div
            className="s-val"
            data-testid="github-native-state"
            data-state={nativeState ?? "unknown"}
            data-reason={nativeState === "unknown" ? nativeReason : undefined}
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
                    nativeState === "disconnected" ? txt.connect : txt.reconnect
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
              {txt.disconnectedNotice}
            </p>
          )}
        </div>
      </div>
      {/* Gitea's and GitLab's own rows carry their row ids. */}
      <div className="s-gitea">
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
          {txt.imported}
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
              {hosted.length ? txt.importedNote : txt.noneImported}
            </p>
            {onNewWorkspace ? (
              <div className="s-val">
                <ControlButton
                  data-testid="code-host-new-workspace"
                  size="row"
                  onPress={onNewWorkspace}
                >
                  {txt.newWorkspace}
                </ControlButton>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
