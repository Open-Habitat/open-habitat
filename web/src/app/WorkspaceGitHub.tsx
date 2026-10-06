import { useState } from "react";
import type { Workspace } from "./snapshot";
import { catalog, cloneStream, observe, type Repo } from "./github";
import { ControlButton } from "../components/ControlElements";

type Challenge = {
  schema_version: 1;
  full_name: string;
  workspace_id: string;
  visibility: "private" | "public";
  stage: "create" | "origin" | "push";
  observation_token: string;
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
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("");
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
    if (!r.ok) throw new Error("GitHubin tai Gitin tilaa ei voitu vahvistaa.");
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
      const all: Repo[] = [];
      const seen = new Set<string>();
      for (let page = 1; page <= 100; page++) {
        const result = await catalog(page);
        for (const repo of result.repositories) {
          if (seen.has(repo.full_name.toLowerCase()))
            throw new Error("Luettelo on epävarma.");
          seen.add(repo.full_name.toLowerCase());
          all.push(repo);
        }
        if (!result.has_more) {
          setRepos(all);
          return;
        }
      }
      throw new Error("Luettelo on liian pitkä.");
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
    try {
      const before = await observe(choice);
      if (before.state !== "absent")
        throw new Error("Kohde ei ole vahvistetusti vapaa. Tarkista työtilat.");
      await cloneStream(choice, csrf, () => {});
      const after = await observe(choice);
      if (after.state !== "confirmed")
        throw new Error(
          "Tuonnin tulos on epävarma. Tarkista paikallinen Git ennen uutta yritystä.",
        );
      setNotice("Repo tuotu työtilaksi.");
      refresh();
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : "Tuonnin tulos on epävarma. Tarkista paikallinen Git ennen uutta yritystä.",
      );
      refresh();
    } finally {
      setBusy(false);
    }
  };
  const inspectPublish = async () => {
    if (!workspace || busy) return;
    setBusy(true);
    setChallenge(undefined);
    setConfirmation("");
    setNotice("");
    try {
      setChallenge(await inspect(workspace.workspace_id, fullName, visibility));
    } catch {
      setNotice("Havainto epäonnistui. Mitään ei muutettu.");
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
      const r = await fetch(endpoint, {
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
          <ControlButton
            type="button"
            isDisabled={busy}
            onClick={() => void load()}
          >
            Näytä repot
          </ControlButton>
          {repos.length > 0 && (
            <>
              <label>
                Hae repoja{" "}
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </label>
              <label>
                Repo{" "}
                <select
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
              <ControlButton
                type="button"
                isDisabled={!csrf || busy || !choice}
                onClick={() => void importRepo()}
              >
                Tuo työtilaksi
              </ControlButton>
            </>
          )}
        </>
      ) : workspace.kind === "git_main_worktree" ? (
        <>
          <h2>Julkaise GitHubiin</h2>
          <p>
            Jokainen vaihe (luonti, origin, push) vaatii uuden havainnon.
            Epävarmaa vaihetta ei toisteta automaattisesti.
          </p>
          <label>
            Omistaja{" "}
            <input
              value={owner}
              onChange={(e) => {
                setOwner(e.target.value);
                setChallenge(undefined);
              }}
            />
          </label>
          <label>
            Repo{" "}
            <input
              value={repository}
              onChange={(e) => {
                setRepository(e.target.value);
                setChallenge(undefined);
              }}
            />
          </label>
          <label>
            Näkyvyys{" "}
            <select
              value={visibility}
              onChange={(e) => {
                setVisibility(e.target.value as "private" | "public");
                setChallenge(undefined);
              }}
            >
              <option value="private">Yksityinen</option>
              <option value="public">Julkinen</option>
            </select>
          </label>
          <ControlButton
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
                ({visibility}). Kirjoita tarkka nimi vahvistaaksesi.
              </p>
              <label>
                Vahvista owner/repository{" "}
                <input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </label>
              <ControlButton
                type="button"
                isDisabled={busy || confirmation !== challenge.full_name}
                onClick={() => void publish()}
              >
                Suorita {challenge.stage}
              </ControlButton>
            </>
          )}
        </>
      ) : null}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
