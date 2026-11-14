import { useCallback, useEffect, useMemo, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { Icon } from "../components/Icon";
import { LetterMark } from "../components/Integrations";
import { NativeDisconnect } from "../components/NativeDisconnect";
import { Button } from "../components/Primitives";
import { StatusMark } from "../components/Status";
import { liveText } from "../i18n";
import { codeHostsText } from "../text/codeHosts";
import { setGitHubWorkflow, useAccountPreferences } from "./accountPreferences";
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
/** The GitHub workflow permission's state on the card: the token's scopes
 * are the truth about what is granted, the person's opt-in only says what
 * they want. `pending` is the moment between pressing Allow and GitHub. */
export type WorkflowState = "off" | "pending" | "on" | "missing" | "unknown";
export function workflowState(
  scopes: readonly string[] | null,
  wanted: boolean,
  pending = false,
): WorkflowState {
  return pending
    ? "pending"
    : scopes === null
      ? "unknown"
      : scopes.includes("workflow")
        ? "on"
        : wanted
          ? "missing"
          : "off";
}

function WorkflowMark({ s }: { s: WorkflowState }) {
  return s === "on" ? (
    <StatusMark kind="success" tone="success" label={txt.wfOn} />
  ) : s === "pending" ? (
    <StatusMark kind="working" tone="info" label={txt.wfPending} />
  ) : s === "missing" ? (
    <StatusMark kind="error" tone="warning" label={txt.wfMissing} />
  ) : s === "unknown" ? (
    <StatusMark kind="unknown" tone="neutral" label={txt.wfUnknown} />
  ) : (
    <StatusMark tone="neutral" label={txt.wfOff} />
  );
}

/** The token's scopes as chips under the GitHub row's words. */
function ScopeChips({ scopes }: { scopes: readonly string[] | null }) {
  if (scopes === null)
    return (
      <span
        className="s-desc s-scopes"
        data-testid="github-scopes"
        data-unknown=""
      >
        {txt.scopesUnknown}
      </span>
    );
  return (
    <span className="s-scopes" data-testid="github-scopes">
      <span className="s-desc">{txt.scopesLabel}</span>
      <ul className="s-model-chips">
        {scopes.map((s) => (
          <li key={s} data-scope={s}>
            <code>{s}</code>
          </li>
        ))}
      </ul>
    </span>
  );
}

/** A Rivi (github-workflow-scope): the GitHub card's own row for letting
 * agents change GitHub Actions workflows. Allowing and removing both run the
 * GitHub sign-in again, with and without the workflow scope; the token gh
 * then holds sets the remembered opt-in in the person's daemon. Removing it
 * does not revoke the old token on GitHub. */
function GitHubWorkflowRow({
  identity,
  csrf,
  scopes,
  onReconnect,
}: {
  identity?: string;
  csrf?: string;
  scopes: readonly string[] | null;
  onReconnect?: (workflow?: boolean) => void;
}) {
  const prefs = useAccountPreferences(identity, csrf);
  const [pending, setPending] = useState(false);
  // Back from GitHub through the browser's history: the page is restored
  // as it was left, mid sign-in, though nothing is under way any more.
  useEffect(() => {
    const restored = (e: PageTransitionEvent) => {
      if (e.persisted) setPending(false);
    };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);
  const [said, setSaid] = useState("");
  const s = workflowState(scopes, prefs.github_workflow, pending);
  const busy = !prefs.loaded || !!prefs.busy || !onReconnect;
  const signIn = (workflow: boolean) => {
    if (!onReconnect) return;
    setSaid("");
    if (workflow) setPending(true);
    onReconnect(workflow);
  };
  const keepOff = async () => {
    if (!identity || !csrf) return;
    setSaid("");
    await setGitHubWorkflow(identity, false, csrf);
  };
  const failed = prefs.error === "github_workflow";
  const description =
    s === "on"
      ? txt.wfOnDesc
      : s === "pending"
        ? txt.wfPendingDesc
        : s === "missing"
          ? txt.wfMissingDesc
          : s === "unknown"
            ? `${txt.wfUnknownDesc} ${txt.wfShort}`
            : txt.wfExplain;
  // "Don't allow" is confirmed by the daemon's reply, which turns the state
  // to off; its sentence follows that confirmation.
  const kept = said === "kept" && s === "off";
  return (
    <div
      className="s-row s-marked s-wf-row"
      data-settings-row="github-workflow"
      data-testid="github-workflow"
      data-wf={s}
      tabIndex={-1}
    >
      <span className="s-wf-icon" aria-hidden="true">
        <Icon name="shield" />
      </span>
      <div className="s-lbl">
        <strong>{txt.wfTitle}</strong>
        <span
          className={`s-desc${s === "missing" ? " s-bad" : ""}`}
          data-testid="github-workflow-desc"
        >
          {description}
        </span>
      </div>
      <div className="s-val">
        <WorkflowMark s={s} />
        {s === "on" ? (
          <ControlButton
            data-testid="github-workflow-remove"
            size="row"
            variant="secondary"
            isDisabled={busy}
            onPress={() => signIn(false)}
          >
            {txt.removePerm}
          </ControlButton>
        ) : s === "missing" ? (
          <>
            <ControlButton
              data-testid="github-workflow-keep-off"
              size="row"
              variant="quiet"
              isDisabled={busy}
              onPress={() => {
                void keepOff().then(() => setSaid("kept"));
              }}
            >
              {txt.keepOff}
            </ControlButton>
            <ControlButton
              data-testid="github-workflow-allow"
              size="row"
              variant="primary"
              isDisabled={busy}
              onPress={() => signIn(true)}
            >
              {txt.allowAgain}
            </ControlButton>
          </>
        ) : s === "pending" ? (
          // A page brought back from the browser's history, or a sign-in
          // the browser never left for, is not still signing in.
          <ControlButton
            data-testid="github-workflow-cancel"
            size="row"
            variant="quiet"
            onPress={() => setPending(false)}
          >
            {txt.cancelSignIn}
          </ControlButton>
        ) : (
          <ControlButton
            data-testid="github-workflow-allow"
            size="row"
            variant="secondary"
            isDisabled={busy}
            onPress={() => signIn(true)}
          >
            {txt.allow}
            <Icon name="external" />
          </ControlButton>
        )}
      </div>
      {(kept || failed) && (
        <p
          className="s-editor s-desc"
          role="status"
          data-testid="github-workflow-said"
        >
          {failed ? txt.wfSaveFailed : txt.saidKeptOff}
        </p>
      )}
    </div>
  );
}

export function CodeHostSettings({
  identity,
  csrf,
  nativeState,
  nativeReason,
  nativeLogin,
  nativeScopes,
  onReconnect,
  onDisconnect,
  workspaces,
  onNewWorkspace,
}: {
  /** The signed-in person, whose preferences hold the workflow opt-in. */
  identity?: string;
  csrf?: string;
  nativeState?: NativeState;
  nativeReason?: NativeUnknownReason;
  nativeLogin?: string;
  /** The token's scopes with a working login: null when unread. */
  nativeScopes?: readonly string[] | null;
  /** Sign in with GitHub again. workflow says whether to ask for the
   * workflow scope; without it the app keeps what the person has. */
  onReconnect?: (workflow?: boolean) => void;
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
  // The workflow row and the scope chips need a working login: only then
  // does the host read the token's scopes.
  const connected = nativeState === "connected" && nativeScopes !== undefined;
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
            {connected && <ScopeChips scopes={nativeScopes ?? null} />}
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
                  onPress={() => onReconnect()}
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
        {connected && (
          <GitHubWorkflowRow
            identity={identity}
            csrf={csrf}
            scopes={nativeScopes ?? null}
            onReconnect={onReconnect}
          />
        )}
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
