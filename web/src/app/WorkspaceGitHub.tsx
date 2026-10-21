import { useEffect, useRef, useState } from "react";
import { ControlButton, controlStyles } from "../components/ControlElements";
import { TextField } from "../components/Primitives";
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
      const reasons: Record<string, string> = {
        origin_conflict:
          "Origin osoittaa toiseen repoon. Tarkista paikallinen Git ennen julkaisemista.",
        remote_conflict:
          "GitHub-repo on jo käytössä, väärällä näkyvyydellä tai sitä ei voitu varmistaa tyhjäksi.",
        github_auth_unavailable:
          "Paikallinen GitHub-valtuutus ei vastaa tätä käyttäjää.",
        workspace_changed:
          "Työtila muuttui havainnon jälkeen. Päivitä työtilat.",
      };
      throw new Error(
        (typeof code === "string" && reasons[code]) ||
          "GitHubin tai Gitin tilaa ei voitu vahvistaa.",
      );
    }
    const value: unknown = await r.json();
    if (!validChallenge(value, name, id, vis))
      throw new Error("Havainto ei kelpaa.");
    return value;
  };
  const load = async () => {
    setBusy(true);
    setRepos([]);
    setNotice("");
    try {
      setRepos((await catalog()).repositories);
    } catch {
      setNotice("Repojen hakua ei voitu vahvistaa. Yritä myöhemmin uudelleen.");
    } finally {
      setBusy(false);
    }
  };
  const importRepo = async () => {
    if (!csrf || !choice || busy) return;
    setBusy(true);
    setNotice("Tuonti käynnissä…");
    const controller = new AbortController();
    importAbort.current = controller;
    try {
      const before = await observe(choice, controller.signal);
      if (before.state !== "absent")
        throw new Error("Kohde ei ole vahvistetusti vapaa. Tarkista työtilat.");
      await cloneStream(
        choice,
        csrf,
        (frame) => {
          if (mounted.current && frame.kind === "progress")
            setNotice(
              `Tuonti: ${frame.stage}${frame.percent === undefined ? "" : ` ${frame.percent} %`}${frame.received_bytes === undefined ? "" : ` · ${frame.received_bytes} tavua`}`,
            );
        },
        controller.signal,
      );
      const after = await observe(choice, controller.signal);
      if (after.state !== "confirmed")
        throw new Error(
          "Tuonnin tulos on epävarma. Tarkista paikallinen Git ennen uutta yritystä.",
        );
      if (!mounted.current) return;
      setNotice("Repo tuotu työtilaksi.");
      refresh();
    } catch (e) {
      if (!mounted.current) return;
      setNotice(
        e instanceof Error
          ? e.message
          : "Tuonnin tulos on epävarma. Tarkista paikallinen Git ennen uutta yritystä.",
      );
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
        setNotice(
          e instanceof Error
            ? e.message
            : "Havainto epäonnistui. Mitään ei muutettu.",
        );
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
    setNotice("Vaihe käynnissä…");
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
      if (!r.ok)
        throw new Error(
          "Vaiheen tulos on epävarma. Älä toista kirjoitusta; tarkista GitHub ja Git uudella havainnolla.",
        );
      const reply: unknown = await r.json();
      if (
        !reply ||
        typeof reply !== "object" ||
        (reply as Record<string, unknown>).state !== "confirmed" ||
        (reply as Record<string, unknown>).stage !== current.stage
      )
        throw new Error(
          "Vastausta ei voitu vahvistaa. Tarkista tila ennen jatkamista.",
        );
      setNotice(
        `${current.stage === "create" ? "GitHub-repo luotu" : current.stage === "origin" ? "Origin asetettu" : "Push vahvistettu"}. Tarkista seuraava vaihe uudella havainnolla.`,
      );
      refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Tulos on epävarma.");
      refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="GitHub-työtilat">
      {!workspace ? (
        <>
          <h2>Tuo GitHub-repo</h2>
          <ControlButton data-testid="repository-load"
            size="row"
            type="button"
            isDisabled={busy}
            onClick={() => void load()}
          >
            Näytä repot
          </ControlButton>
          {repos.length > 0 && (
            <>
              <TextField
                label="Hae repoja"
                value={filter}
                onChange={setFilter}
              />
              <label className={controlStyles.field}>
                Repo
                <select
                  className={controlStyles.fieldInput}
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                >
                  <option value="">Valitse repo</option>
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
              <ControlButton data-testid="repository-import"
                size="row"
                type="button"
                isDisabled={!csrf || busy || !choice}
                onClick={() => void importRepo()}
              >
                Tuo työtilaksi
              </ControlButton>
            </>
          )}
        </>
      ) : workspace.kind === "git_main_worktree" &&
        (workspace.git_remote === "none" || workspace.publish_continuation) ? (
        <>
          <h2 data-continuation={!!workspace.publish_continuation} data-testid="publish-title">
            {workspace.publish_continuation
              ? "Jatka GitHub-julkaisua"
              : "Julkaise GitHubiin"}
          </h2>
          <p>
            {workspace.publish_continuation
              ? "GitHub-originilla ei näy haettuja haaroja. Tarkista omistaja, repo ja näkyvyys ennen mahdollista push-vaihetta."
              : "Jokainen vaihe (luonti, origin, push) vaatii uuden havainnon. Epävarmaa vaihetta ei toisteta automaattisesti."}
          </p>
          <TextField
            data-testid="publish-owner"
            label="Omistaja"
            value={owner}
            onChange={(value) => {
              ++selectionRevision.current;
              setOwner(value);
              setChallenge(undefined);
            }}
          />
          <TextField
            label="Repo"
            value={repository}
            onChange={(value) => {
              ++selectionRevision.current;
              setRepository(value);
              setChallenge(undefined);
            }}
          />
          <label className={controlStyles.field}>
            Näkyvyys
            <select
              className={controlStyles.fieldInput}
              value={visibility}
              onChange={(e) => {
                ++selectionRevision.current;
                setVisibility(e.target.value as "private" | "public");
                setChallenge(undefined);
              }}
            >
              <option value="private">Yksityinen</option>
              <option value="public">Julkinen</option>
            </select>
          </label>
          <ControlButton data-testid="publish-inspect"
            size="row"
            type="button"
            isDisabled={!csrf || busy || !owner || !repository}
            onClick={() => void inspectPublish()}
          >
            Tarkista GitHub ja Git
          </ControlButton>
          {challenge && (
            <>
              <p>
                Seuraava vaihe: {challenge.stage}. Kohde: {challenge.full_name}{" "}
                ({challenge.visibility}). Kirjoita tarkka nimi vahvistaaksesi.
              </p>
              <p>
                Paikallinen Git:{" "}
                {challenge.working_tree === "clean"
                  ? "puhdas"
                  : challenge.working_tree === "changes"
                    ? "muutoksia"
                    : "tila tuntematon"}
                ; HEAD {challenge.local_head ?? "tuntematon"}.
              </p>
              <TextField
                label="Vahvista owner/repository"
                value={confirmation}
                onChange={setConfirmation}
              />
              <ControlButton data-stage={challenge.stage} data-testid="publish-commit"
                size="row"
                type="button"
                isDisabled={busy || confirmation !== challenge.full_name}
                onClick={() => void publish()}
              >
                Suorita {challenge.stage}
              </ControlButton>
            </>
          )}
        </>
      ) : workspace.kind === "git_main_worktree" &&
        workspace.git_remote !== "github" ? (
        <p role="status">
          {workspace.git_remote === "other"
            ? "Työtilalla on toinen etärepo. Julkaiseminen vaatii työtilan ilman etärepoa."
            : "Gitin etärepoa ei voitu tarkistaa. Päivitä tiedot ennen julkaisemista."}
        </p>
      ) : null}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
