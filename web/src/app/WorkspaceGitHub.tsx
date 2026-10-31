import { useEffect, useRef, useState } from "react";
import { ControlButton, controlStyles } from "../components/ControlElements";
import { TextField } from "../components/Primitives";
import { useText } from "../i18n";
import { workspaceGitHubText } from "../text/workspaceGitHub";
import { catalog, cloneStream, observe, type Repo } from "./github";
import { mutationFetch } from "./mutations";
import type { Workspace } from "./snapshot";

type Challenge = {
  schema_version: 1;
  full_name: string;
  workspace_id: string;
  visibility: "private" | "public";
  stage: "create" | "origin" | "push";
  observation_token: string;
  working_tree?: "clean" | "changes" | "unknown";
  local_head?: string;
};
const endpoint = "/api/v1/workspaces/github/publish";
function validChallenge(
  value: unknown,
  name: string,
  id: string,
  visibility: string,
): value is Challenge {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.schema_version === 1 &&
    v.full_name === name &&
    v.workspace_id === id &&
    v.visibility === visibility &&
    ["create", "origin", "push"].includes(String(v.stage)) &&
    typeof v.observation_token === "string" &&
    v.observation_token.length >= 8
  );
}
export function WorkspaceGitHub({
  csrf,
  workspace,
  refresh,
}: {
  csrf?: string;
  workspace?: Workspace;
  refresh: () => void;
}) {
  const t = useText(workspaceGitHubText);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [choice, setChoice] = useState("");
  const [owner, setOwner] = useState("");
  const [repository, setRepository] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [confirmation, setConfirmation] = useState("");
  const [challenge, setChallenge] = useState<Challenge>();
  const selectionRevision = useRef(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("");
  const importAbort = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      importAbort.current?.abort();
    };
  }, []);
  const fullName = `${owner}/${repository}`;
  const inspect = async (
    id: string,
    name: string,
    vis: "private" | "public",
  ) => {
    const url = `${endpoint}?workspace_id=${encodeURIComponent(id)}&full_name=${encodeURIComponent(name)}&visibility=${vis}`;
    const r = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!r.ok) {
      const detail: unknown = await r.json().catch(() => null);
      const error =
        detail && typeof detail === "object" && "error" in detail
          ? detail.error
          : null;
      const code =
        error && typeof error === "object" && "code" in error
          ? error.code
          : null;
      throw new Error(
        (typeof code === "string" &&
          Object.hasOwn(t.reasons, code) &&
          t.reasons[code]) ||
          t.unconfirmed,
      );
    }
    const value: unknown = await r.json();
    if (!validChallenge(value, name, id, vis))
      throw new Error(t.invalidObservation);
    return value;
  };
  const load = async () => {
    setBusy(true);
    setRepos([]);
    setNotice("");
    try {
      setRepos((await catalog()).repositories);
    } catch {
      setNotice(t.catalogFailed);
    } finally {
      setBusy(false);
    }
  };
  const importRepo = async () => {
    if (!csrf || !choice || busy) return;
    setBusy(true);
    setNotice(t.importing);
    const controller = new AbortController();
    importAbort.current = controller;
    try {
      const before = await observe(choice, controller.signal);
      if (before.state !== "absent") throw new Error(t.notFree);
      await cloneStream(
        choice,
        csrf,
        (frame) => {
          if (mounted.current && frame.kind === "progress")
            setNotice(
              t.progress(frame.stage, frame.percent, frame.received_bytes),
            );
        },
        controller.signal,
      );
      const after = await observe(choice, controller.signal);
      if (after.state !== "confirmed") throw new Error(t.importUncertain);
      if (!mounted.current) return;
      setNotice(t.imported);
      refresh();
    } catch (e) {
      if (!mounted.current) return;
      setNotice(e instanceof Error ? e.message : t.importUncertain);
      refresh();
    } finally {
      if (importAbort.current === controller) importAbort.current = null;
      if (mounted.current) setBusy(false);
    }
  };
  const inspectPublish = async () => {
    if (!workspace || busy) return;
    setBusy(true);
    const revision = ++selectionRevision.current;
    setChallenge(undefined);
    setConfirmation("");
    setNotice("");
    try {
      const observed = await inspect(
        workspace.workspace_id,
        fullName,
        visibility,
      );
      if (revision === selectionRevision.current) setChallenge(observed);
    } catch (e) {
      if (revision === selectionRevision.current)
        setNotice(e instanceof Error ? e.message : t.observationFailed);
    } finally {
      setBusy(false);
    }
  };
  const publish = async () => {
    if (
      !workspace ||
      !csrf ||
      !challenge ||
      confirmation !== challenge.full_name ||
      busy
    )
      return;
    const current = challenge;
    setChallenge(undefined);
    setBusy(true);
    setNotice(t.stageRunning);
    try {
      const r = await mutationFetch("workspace.github_publish", endpoint, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Host-CSRF": csrf,
          Origin: window.location.origin,
        },
        body: JSON.stringify({
          workspace_id: current.workspace_id,
          full_name: current.full_name,
          visibility: current.visibility,
          action: current.stage,
          confirmation,
          observation_token: current.observation_token,
        }),
      });
      if (!r.ok) throw new Error(t.stageUncertain);
      const reply: unknown = await r.json();
      if (
        !reply ||
        typeof reply !== "object" ||
        (reply as Record<string, unknown>).state !== "confirmed" ||
        (reply as Record<string, unknown>).stage !== current.stage
      )
        throw new Error(t.replyUnconfirmed);
      setNotice(t.stageDone[current.stage]);
      refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t.uncertain);
      refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label={t.label}>
      {!workspace ? (
        <>
          <h2>{t.importTitle}</h2>
          <ControlButton
            data-testid="repository-load"
            size="row"
            type="button"
            isDisabled={busy}
            onClick={() => void load()}
          >
            {t.showRepos}
          </ControlButton>
          {repos.length > 0 && (
            <>
              <TextField
                label={t.searchRepos}
                value={filter}
                onChange={setFilter}
              />
              <label className={controlStyles.field}>
                {t.repo}
                <select
                  className={controlStyles.fieldInput}
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                >
                  <option value="">{t.chooseRepo}</option>
                  {repos
                    .filter((r) =>
                      r.full_name.toLowerCase().includes(filter.toLowerCase()),
                    )
                    .map((r) => (
                      <option key={r.full_name} value={r.full_name}>
                        {r.full_name}
                      </option>
                    ))}
                </select>
              </label>
              <ControlButton
                data-testid="repository-import"
                size="row"
                type="button"
                isDisabled={!csrf || busy || !choice}
                onClick={() => void importRepo()}
              >
                {t.import}
              </ControlButton>
            </>
          )}
        </>
      ) : workspace.kind === "git_main_worktree" &&
        (workspace.git_remote === "none" || workspace.publish_continuation) ? (
        <>
          <h2
            data-continuation={!!workspace.publish_continuation}
            data-testid="publish-title"
          >
            {workspace.publish_continuation ? t.continueTitle : t.publishTitle}
          </h2>
          <p>
            {workspace.publish_continuation ? t.continueText : t.publishText}
          </p>
          <TextField
            data-testid="publish-owner"
            label={t.owner}
            value={owner}
            onChange={(value) => {
              ++selectionRevision.current;
              setOwner(value);
              setChallenge(undefined);
            }}
          />
          <TextField
            data-testid="publish-repository"
            label={t.repo}
            value={repository}
            onChange={(value) => {
              ++selectionRevision.current;
              setRepository(value);
              setChallenge(undefined);
            }}
          />
          <label className={controlStyles.field}>
            {t.visibility}
            <select
              className={controlStyles.fieldInput}
              value={visibility}
              onChange={(e) => {
                ++selectionRevision.current;
                setVisibility(e.target.value as "private" | "public");
                setChallenge(undefined);
              }}
            >
              <option value="private">{t.private}</option>
              <option value="public">{t.public}</option>
            </select>
          </label>
          <ControlButton
            data-testid="publish-inspect"
            size="row"
            type="button"
            isDisabled={!csrf || busy || !owner || !repository}
            onClick={() => void inspectPublish()}
          >
            {t.inspect}
          </ControlButton>
          {challenge && (
            <>
              <p>
                {t.next(
                  challenge.stage,
                  challenge.full_name,
                  challenge.visibility,
                )}
              </p>
              <p>
                {t.localGit}{" "}
                {challenge.working_tree === "clean"
                  ? t.clean
                  : challenge.working_tree === "changes"
                    ? t.changes
                    : t.stateUnknown}
                {t.head(challenge.local_head)}
              </p>
              <TextField
                data-testid="publish-confirmation"
                label={t.confirm}
                value={confirmation}
                onChange={setConfirmation}
              />
              <ControlButton
                data-stage={challenge.stage}
                data-testid="publish-commit"
                size="row"
                type="button"
                isDisabled={busy || confirmation !== challenge.full_name}
                onClick={() => void publish()}
              >
                {t.run(challenge.stage)}
              </ControlButton>
            </>
          )}
        </>
      ) : workspace.kind === "git_main_worktree" &&
        workspace.git_remote !== "github" ? (
        <p role="status">
          {workspace.git_remote === "other" ? t.otherRemote : t.remoteUnknown}
        </p>
      ) : null}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
