import { useState } from "react";
import { ControlButton } from "../components/ControlElements";
import type { Workspace } from "./snapshot";
import { WorkspaceGitHub } from "./WorkspaceGitHub";

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
  userObservationToken,
  refresh,
  onCreated,
  onHidden,
}: {
  csrf?: string;
  workspace?: Workspace;
  workspaces?: Workspace[];
  userObservationToken?: string;
  refresh: () => void;
  onCreated?: (id: string) => void;
  onHidden?: () => void;
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
    if (
      !csrf ||
      busy ||
      (action === "create" && !userObservationToken) ||
      (target && target.mutation_state !== "allowed")
    )
      return;
    setBusy(true);
    setError("");
    try {
      const resultId = await mutate(
        {
          action,
          ...(action === "create"
            ? { user_observation_token: userObservationToken }
            : {}),
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
      if (
        action === "create" ||
        (action === "settings" && resultId !== target?.workspace_id)
      )
        onCreated?.(resultId);
      if (action === "visibility" && additional.hidden === true) onHidden?.();
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
          <ControlButton
            type="submit"
            isDisabled={!csrf || busy || !userObservationToken}
          >
            Luo työtila
          </ControlButton>
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
            <ControlButton
              type="submit"
              isDisabled={!csrf || busy || !workspace.observation_token}
            >
              Tallenna
            </ControlButton>
          </form>
          {workspace.kind === "directory" && (
            <ControlButton
              type="button"
              isDisabled={!csrf || busy}
              onClick={() => void run("git_init", {})}
            >
              Alusta Git
            </ControlButton>
          )}
          <ControlButton
            type="button"
            isDisabled={!csrf || busy}
            onClick={() => void run("visibility", { hidden: true })}
          >
            Piilota työtila
          </ControlButton>
          <p>
            Poisto ei ole vielä käytettävissä: aktiivisia prosesseja, muita
            työhakemistoja ja liitoksia ei voida varmistaa turvallisesti.
          </p>
        </>
      )}
      <WorkspaceGitHub csrf={csrf} workspace={workspace} refresh={refresh} />
      {workspaces
        ?.filter((w) => w.visibility === "hidden")
        .map((w) => (
          <p key={w.workspace_id}>
            {w.display_name ?? w.name}{" "}
            <ControlButton
              type="button"
              isDisabled={!csrf || busy || !w.observation_token}
              onClick={() => void run("visibility", { hidden: false }, w)}
            >
              Palauta näkyviin
            </ControlButton>
          </p>
        ))}
    </section>
  );
}
