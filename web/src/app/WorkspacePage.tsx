import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ControlButton, LinkRow } from "../components/ControlElements";
import {
  HomeConversationGrid,
  type HomeConversation,
  homeSections,
  useCardArchiveAction,
} from "../components/HomeWorkspaces";
import { Dialog } from "../components/Overlays";
import { TextField } from "../components/Primitives";
import { relativeRecapAge } from "../components/RecapCard";
import { WorkspaceGitLayer } from "../components/WorkspaceGitLayer";
import { WorkspaceActions } from "../components/WorkspaceActions";
import {
  type ConversationStore,
  useConversationMetadata,
} from "./conversationStore";
import type { Workspace } from "./snapshot";
import { type Choice, PiModelSelector } from "./PiModelSelector";
import { WorkspaceGitHub } from "./WorkspaceGitHub";
import { mutateWorkspace } from "./WorkspaceManagement";
import { type WorkspaceGit, workspaceGit } from "./workspaceGit";
import "./WorkspacePage.css";

export function WorkspacePage({
  workspace,
  conversations,
  store,
  csrf,
  onNew,
  onArchive,
  archiveReason,
  onNewChoice,
  startReason,
  onRecheckCreation,
  defaultRefused,
  defaultUnavailable,
  onRefreshDefault,
  refresh,
  actionRequest,
  onActionHandled,
}: {
  workspace: Workspace;
  conversations: HomeConversation[];
  store: ConversationStore;
  csrf?: string;
  onNew?: (id: string) => void;
  onArchive?: (id: string) => Promise<boolean>;
  archiveReason?: (conversation: HomeConversation) => string;
  onNewChoice?: (id: string, choice: Choice) => void;
  startReason?: string;
  onRecheckCreation?: () => void;
  defaultRefused?: boolean;
  defaultUnavailable?: boolean;
  onRefreshDefault?: () => void;
  refresh: () => void;
  actionRequest?: "rename" | "hide";
  onActionHandled?: () => void;
}) {
  const navigate = useNavigate();
  const archiveAction = useCardArchiveAction(onArchive);
  const metadata = useConversationMetadata(store);
  const decorated = conversations.map((c) => ({
    ...c,
    attention: metadata.attention.get(c.id) ?? c.attention,
    command: metadata.staleStatuses.has(c.id)
      ? c.command
      : (metadata.statuses.get(c.id)?.state ?? c.command),
    pendingQuestion:
      !metadata.staleStatuses.has(c.id) &&
      (!!metadata.statuses.get(c.id)?.pending_question || !!c.pendingQuestion),
  }));
  const section = homeSections([workspace], decorated)[0];
  const done = decorated.filter(
    (c) => !section.open.some((open) => open.id === c.id),
  );
  const [git, setGit] = useState<WorkspaceGit>();
  const [gitError, setGitError] = useState(false);
  const [gitRead, setGitRead] = useState(0);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryChoice, setRecoveryChoice] = useState<Choice>();
  const [gitOpen, setGitOpen] = useState(false);
  const actionButton = useRef<HTMLButtonElement>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [display, setDisplay] = useState(
    workspace.display_name ?? workspace.name,
  );
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const isGit =
    workspace.kind === "git_main_worktree" ||
    workspace.kind === "git_linked_worktree";
  // biome-ignore lint/correctness/useExhaustiveDependencies: gitRead explicitly requests a fresh native observation.
  useEffect(() => {
    if (!isGit) return;
    const controller = new AbortController();
    setGitError(false);
    void workspaceGit(workspace.workspace_id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setGit(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setGit(undefined);
          setGitError(true);
        }
      });
    return () => controller.abort();
  }, [workspace.workspace_id, isGit, gitRead]);
  const mutate = async (action: "settings" | "visibility") => {
    if (
      !csrf ||
      busy ||
      !workspace.observation_token ||
      workspace.mutation_state !== "allowed"
    )
      return;
    setBusy(true);
    setProblem("");
    try {
      const id = await mutateWorkspace(
        {
          action,
          workspace_id: workspace.workspace_id,
          observation_token: workspace.observation_token,
          ...(action === "settings"
            ? { display_name: display }
            : { hidden: true }),
        },
        csrf,
      );
      refresh();
      setRenameOpen(false);
      if (action === "visibility") navigate("/workspaces");
      else if (id !== workspace.workspace_id) navigate(`/workspaces/${id}`);
    } catch {
      setProblem(
        "Työtilan muutosta ei voitu vahvistaa. Päivitä tiedot ennen uutta yritystä.",
      );
      refresh();
    } finally {
      setBusy(false);
    }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: consume each explicit cross-page menu intent once; rerenders must not repeat a write.
  useEffect(() => {
    if (!actionRequest) return;
    onActionHandled?.();
    if (actionRequest === "rename") setRenameOpen(true);
    else void mutate("visibility");
  }, [actionRequest]);
  const displayPath = workspace.path?.endsWith(`/src/${workspace.name}`)
    ? `~/src/${workspace.name}`
    : (workspace.path ?? workspace.name);
  const summary = git ?? (!gitError ? workspace.git_summary : undefined);
  const label = summary
    ? `${summary.branch} · ${summary.dirty_count} ${summary.dirty_count === 1 ? "muutos" : "muutosta"}${git?.ahead ? ` ↑${git.ahead}` : ""}${git?.behind ? ` ↓${git.behind}` : ""}`
    : "Git-tila ei tiedossa";
  return (
    <div className="ah-workspace-page">
      <header className="ah-workspace-page-head">
        <div className="ah-workspace-page-title">
          <h1 tabIndex={-1}>{workspace.display_name ?? workspace.name}</h1>
          <p>
            <code title={workspace.path}>{displayPath}</code>
          </p>
        </div>
        <ControlButton
          className="ah-workspace-plus"
          variant="quiet"
          aria-label="Aloita uusi Pi-keskustelu"
          title={startReason || "Uusi keskustelu"}
          isDisabled={!onNew}
          onPress={() => onNew?.(workspace.workspace_id)}
        >
          +
        </ControlButton>
        <WorkspaceActions
          page
          workspace={workspace}
          menuRef={actionButton}
          onRename={() => requestAnimationFrame(() => setRenameOpen(true))}
          onHide={() => void mutate("visibility")}
          settingsAvailable={
            !!csrf && !busy && workspace.mutation_state === "allowed"
          }
        />
      </header>
      {startReason ? <p role="status">{startReason}</p> : null}
      {onRecheckCreation ? (
        <ControlButton variant="secondary" onPress={onRecheckCreation}>
          Tarkista luonnin tulos
        </ControlButton>
      ) : null}
      {defaultUnavailable && onRefreshDefault ? (
        <ControlButton variant="quiet" onPress={onRefreshDefault}>
          Päivitä oletusagentin tiedot
        </ControlButton>
      ) : null}
      {defaultRefused && onNewChoice ? (
        <Dialog
          triggerLabel="Valitse toinen malli"
          title="Malli uudelle keskustelulle"
          isOpen={recoveryOpen}
          onOpenChange={setRecoveryOpen}
        >
          <PiModelSelector
            csrf={csrf}
            scope="new"
            onChoice={setRecoveryChoice}
          />
          <ControlButton
            isDisabled={!recoveryChoice || !csrf}
            onPress={() => {
              if (recoveryChoice) {
                onNewChoice(workspace.workspace_id, recoveryChoice);
                setRecoveryOpen(false);
              }
            }}
          >
            Aloita keskustelu valitulla mallilla
          </ControlButton>
        </Dialog>
      ) : null}
      {problem && <p role="alert">{problem}</p>}
      {isGit ? (
        <div className="ah-workspace-git">
          <WorkspaceGitLayer
            label={label}
            title={`Git · ${workspace.name}`}
            open={gitOpen}
            onOpenChange={(open) => {
              setGitOpen(open);
              if (open) setGitRead((value) => value + 1);
            }}
          >
            {gitError ? (
              <p role="status">
                Git-tilaa ei voitu lukea. Näkyvä tila ei ole vahvistettu.
              </p>
            ) : !git ? (
              <p>Ladataan Git-tilaa…</p>
            ) : (
              <>
                <p>
                  <code>{git.branch}</code>
                  {git.upstream
                    ? ` · ${git.upstream} · ${git.ahead ?? "?"} edellä · ${git.behind ?? "?"} jäljessä`
                    : " · Seurantahaaraa ei voitu vahvistaa"}
                </p>
                <p className="ah-git-note">
                  Paikallinen havainto · ei hae verkosta.{" "}
                  {git.fetched_at
                    ? `Viimeisin kirjattu haku ${relativeRecapAge(git.fetched_at * 1000, Date.now())}.`
                    : "Viimeisimmän haun aikaa ei ole vahvistettu."}
                </p>
                <h3>Muutokset · {git.dirty_count}</h3>
                {!git.files.length ? (
                  <p>Ei muutoksia</p>
                ) : (
                  <ul className="ah-git-files">
                    {git.files.map((file) => (
                      <li key={file.path}>
                        <code>{file.status}</code>
                        <code>
                          {file.previous_path ? `${file.previous_path} → ` : ""}
                          {file.path}
                        </code>
                      </li>
                    ))}
                  </ul>
                )}
                {git.files_truncated && (
                  <p>Näytetään ensimmäiset 200 muutosta.</p>
                )}
                <h3>Viimeisimmät commitit</h3>
                {!git.commits_available ? (
                  <p>Committeja ei voitu lukea.</p>
                ) : git.commits.length === 0 ? (
                  <p>Ei vielä committeja.</p>
                ) : (
                  <ul className="ah-git-commits">
                    {git.commits.map((commit) => (
                      <li key={commit.hash}>
                        <code>{commit.hash.slice(0, 7)}</code>
                        <span>{commit.subject}</span>
                        {commit.pushed === false ? (
                          <small>paikallinen</small>
                        ) : null}
                        <time
                          dateTime={new Date(
                            commit.timestamp * 1000,
                          ).toISOString()}
                        >
                          {new Date(commit.timestamp * 1000).toLocaleDateString(
                            "fi-FI",
                          )}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <ControlButton
              variant="quiet"
              onPress={() => setGitRead((value) => value + 1)}
            >
              Päivitä Git-tila
            </ControlButton>
            {workspace.kind === "git_main_worktree" &&
            (workspace.git_remote === "none" ||
              workspace.publish_continuation) ? (
              <WorkspaceGitHub
                workspace={workspace}
                csrf={csrf}
                refresh={() => {
                  refresh();
                  setGitRead((value) => value + 1);
                }}
              />
            ) : null}
          </WorkspaceGitLayer>
        </div>
      ) : (
        <p className="ah-git-note">
          {workspace.kind === "directory"
            ? "Hakemisto · ei Git-työtilaa"
            : "Git-tila ei tiedossa"}
        </p>
      )}
      <div className="ah-workspace-rename">
        <Dialog
          triggerLabel="Muuta näyttönimeä…"
          title="Muuta näyttönimeä"
          returnFocusRef={actionButton}
          isOpen={renameOpen}
          onOpenChange={setRenameOpen}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void mutate("settings");
            }}
          >
            <TextField
              label="Näyttönimi"
              value={display}
              onChange={setDisplay}
            />
            <ControlButton type="submit" isDisabled={!csrf || busy}>
              Tallenna
            </ControlButton>
          </form>
          {problem && <p role="alert">{problem}</p>}
        </Dialog>
      </div>
      <section aria-label="Avoimet keskustelut">
        <h2>
          Avoimet <span>{section.open.length}</span>
        </h2>
        {section.open.length ? (
          <HomeConversationGrid
            conversations={section.open}
            archiveAction={archiveAction}
            archiveReason={archiveReason}
          />
        ) : (
          <p>Ei avoimia keskusteluja. Aloita uusi keskustelu +:sta.</p>
        )}
      </section>
      <details className="ah-workspace-done">
        <summary>Valmiit · {done.length}</summary>
        <ul>
          {done.map((c) => (
            <li key={c.id}>
              <LinkRow href={c.href}>{c.title}</LinkRow>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
