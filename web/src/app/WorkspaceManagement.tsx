import { useState } from "react";
import type { Workspace } from "./snapshot";

type Action = "create" | "settings" | "visibility" | "git_init";
async function mutate(input: Record<string, unknown>, csrf: string) {
  const r = await fetch("/api/v1/workspaces", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Agent-Host-CSRF": csrf,
      Origin: window.location.origin,
    },
    body: JSON.stringify(input),
  });
  if (!r.ok)
    throw new Error(
      "Työtilan muutosta ei voitu vahvistaa. Tarkista tilanne päivittämällä näkymä.",
    );
  const result: unknown = await r.json();
  if (
    !result ||
    typeof result !== "object" ||
    !("workspace_id" in result) ||
    typeof result.workspace_id !== "string" ||
    !/^ws_[A-Za-z0-9_-]{8,64}$/.test(result.workspace_id)
  )
    throw new Error("Vastausta ei voitu vahvistaa.");
  return result.workspace_id;
}
export function WorkspaceManagement({
  csrf,
  workspace,
  workspaces,
  refresh,
  onCreated,
}: {
  csrf?: string;
  workspace?: Workspace;
  workspaces?: Workspace[];
  refresh: () => void;
  onCreated?: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [display, setDisplay] = useState(workspace?.display_name ?? "");
  const [git, setGit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (
    action: Action,
    additional: Record<string, unknown>,
    target = workspace,
  ) => {
    if (!csrf || busy) return;
    setBusy(true);
    setError("");
    try {
      const createdId = await mutate(
        {
          action,
          ...(target
            ? {
                workspace_id: target.workspace_id,
                observation_token: target.observation_token,
              }
            : {}),
          ...additional,
        },
        csrf,
      );
      setName("");
      refresh();
      if (action === "create") onCreated?.(createdId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Muutos epäonnistui");
      refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="Työtilojen hallinta">
      {error && <p role="alert">{error}</p>}
      {!workspace && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run("create", { name, git });
          }}
        >
          <h2>Uusi työtila</h2>
          <label>
            Hakemiston nimi{" "}
            <input
              value={name}
              required
              maxLength={255}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={git}
              onChange={(e) => setGit(e.target.checked)}
            />{" "}
            Alusta Git
          </label>
          <button type="submit" disabled={!csrf || busy}>
            Luo työtila
          </button>
        </form>
      )}
      {workspace && (
        <>
          <h2>Työtilan asetukset</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("settings", { display_name: display });
            }}
          >
            <label>
              Näyttönimi{" "}
              <input
                value={display}
                maxLength={255}
                onChange={(e) => setDisplay(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={!csrf || busy || !workspace.observation_token}
            >
              Tallenna
            </button>
          </form>
          {workspace.kind === "directory" && (
            <button
              type="button"
              disabled={!csrf || busy}
              onClick={() => void run("git_init", {})}
            >
              Alusta Git
            </button>
          )}
          <button
            type="button"
            disabled={!csrf || busy}
            onClick={() => void run("visibility", { hidden: true })}
          >
            Piilota työtila
          </button>
          <p>
            Poisto ei ole vielä käytettävissä: aktiivisia prosesseja, muita
            työhakemistoja ja liitoksia ei voida varmistaa turvallisesti.
          </p>
        </>
      )}
      {workspaces
        ?.filter((w) => w.visibility === "hidden")
        .map((w) => (
          <p key={w.workspace_id}>
            {w.display_name ?? w.name}{" "}
            <button
              type="button"
              disabled={!csrf || busy || !w.observation_token}
              onClick={() => void run("visibility", { hidden: false }, w)}
            >
              Palauta näkyviin
            </button>
          </p>
        ))}
    </section>
  );
}
