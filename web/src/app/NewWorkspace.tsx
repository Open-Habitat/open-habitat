import { useEffect, useRef, useState } from "react";
import { ControlButton, Segmented } from "../components/ControlElements";
import {
  type CloneProgress,
  catalog,
  cloneStream,
  observeSettled,
  type Repo,
} from "./github";
import { mutationFetch } from "./mutations";

const stages: Record<
  Extract<CloneProgress, { kind: "progress" }>["stage"],
  string
> = {
  reserving: "Varataan kohdetta",
  connecting: "Yhdistetään GitHubiin",
  receiving: "Vastaanotetaan objekteja",
  checkout: "Kirjoitetaan tiedostoja",
  verifying: "Tarkistetaan",
};

export function NewWorkspace({
  csrf,
  token,
  available,
  onClose,
  onCreated,
  refresh,
}: {
  csrf: string;
  token?: string;
  available: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
  refresh: () => void;
}) {
  const [mode, setMode] = useState<"github" | "directory">("github");
  const [value, setValue] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  // One request per dialog: once accepted, the form becomes its progress and
  // never offers a second create; a failure ends it with the reason.
  const [phase, setPhase] = useState<"form" | "working" | "failed">("form");
  const busy = phase === "working";
  const [progress, setProgress] = useState<
    Extract<CloneProgress, { kind: "progress" }> | undefined
  >();
  const [submitted, setSubmitted] = useState("");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const abort = useRef(new AbortController());
  useEffect(() => {
    dialog.current?.showModal();
    // A fresh controller per mount: Strict Mode replays this effect.
    const controller = new AbortController();
    abort.current = controller;
    return () => {
      controller.abort();
      dialog.current?.close();
    };
  }, []);
  useEffect(() => {
    let live = true;
    void catalog()
      .then((result) => {
        if (live) setRepos(result.repositories);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  // A clone cut by a daemon restart leaves an interrupted directory that only
  // an explicit restart replaces; its size is shown when it is found.
  const [leftover, setLeftover] = useState<number>();
  const submit = async (restart = false) => {
    if ((phase !== "form" && !restart) || !available) return;
    const name = restart ? submitted : value.trim();
    if (
      mode === "github"
        ? !/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(name)
        : !/^[a-z0-9][a-z0-9._-]*$/.test(name)
    ) {
      setError("Tarkista nimi.");
      return;
    }
    setPhase("working");
    setSubmitted(name);
    setError("");
    setLeftover(undefined);
    setProgress(undefined);
    try {
      if (mode === "github") {
        try {
          // The clone is the daemon's job: it has no short request ceiling,
          // so a large repository is not cut off while git is receiving it.
          await cloneStream(
            name,
            csrf,
            (frame) => {
              if (frame.kind === "progress") setProgress(frame);
            },
            abort.current.signal,
            { restart },
          );
        } catch (e) {
          if (abort.current.signal.aborted) return;
          // A lost stream is not proof that the clone failed.
          const seen = await observeSettled(name).catch(() => undefined);
          if (seen?.state === "interrupted") setLeftover(seen.size_bytes);
          if (seen?.state !== "confirmed") throw e;
        }
      } else {
        if (!token)
          throw new Error("Työtiloja ei voitu tarkistaa. Päivitä näkymä.");
        const response = await mutationFetch(
          "workspace.create",
          "/api/v1/workspaces",
          {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
              "X-Agent-Host-CSRF": csrf,
              Origin: window.location.origin,
            },
            body: JSON.stringify({
              action: "create",
              name,
              git: true,
              user_observation_token: token,
            }),
          },
        );
        if (!response.ok)
          throw new Error(
            "Luontia ei voitu vahvistaa. Tarkista työtilalista ennen uutta yritystä.",
          );
      }
      if (abort.current.signal.aborted) return;
      refresh();
      onCreated(name.split("/").pop() ?? name);
      onClose();
    } catch (e) {
      if (abort.current.signal.aborted) return;
      refresh();
      setPhase("failed");
      setError(
        e instanceof Error && mode === "directory"
          ? e.message
          : "Kloonausta ei voitu vahvistaa. Tarkista työtilalista ennen uutta yritystä.",
      );
    }
  };
  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      aria-labelledby="new-workspace-title"
      className="ah-new-workspace"
    >
      <h2 id="new-workspace-title">Uusi työtila</h2>
      {phase === "form" ? (
        <>
          <Segmented
            label="Työtilan lähde"
            className="ah-new-options"
            options={[
              { id: "github", label: "Kloonaa GitHubista" },
              { id: "directory", label: "Uusi hakemisto" },
            ]}
            value={mode}
            onChange={(next) => {
              setMode(next);
              setValue("");
            }}
          />
          <label htmlFor="workspace-value">
            {mode === "github" ? "Repositorio" : "Nimi"}
          </label>
          <input
            id="workspace-value"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={mode === "github" ? "omistaja/repo" : "uusi-projekti"}
          />
          {mode === "github" && (
            <ul className="ah-new-suggestions">
              {repos
                .filter((repo) =>
                  repo.full_name.toLowerCase().includes(value.toLowerCase()),
                )
                .slice(0, 6)
                .map((repo) => (
                  <li key={repo.full_name}>
                    <ControlButton
                      size="inline"
                      type="button"
                      onClick={() => setValue(repo.full_name)}
                    >
                      {repo.full_name}
                    </ControlButton>
                  </li>
                ))}
            </ul>
          )}
          <p>
            {mode === "github"
              ? "Kloonataan hakemistoon ~/src/<repo> sinun GitHub-tunnuksillasi."
              : "Luodaan ~/src/<nimi> ja alustetaan Git-repoksi."}
          </p>
          {!available && (
            <p role="status">Yhteys pitää vahvistaa ennen työtilan luontia.</p>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="ah-new-footer">
            <ControlButton size="page" type="button" onClick={onClose}>
              Peruuta
            </ControlButton>
            <ControlButton
              size="page"
              type="button"
              variant="primary"
              isDisabled={!available || !value.trim()}
              onClick={() => void submit()}
            >
              Luo työtila
            </ControlButton>
          </div>
        </>
      ) : (
        <>
          <p role="status" className="ah-new-progress">
            {phase === "working"
              ? mode === "github"
                ? `Kloonataan ${submitted}: ${progress ? stages[progress.stage] : "Aloitetaan"}${progress?.percent === undefined ? "…" : ` ${progress.percent} %`}`
                : `Luodaan ${submitted}…`
              : mode === "github"
                ? `Kloonaus ${submitted} ei valmistunut.`
                : `Työtilaa ${submitted} ei luotu.`}
          </p>
          {phase === "working" && mode === "github" ? (
            <p>
              Avaamme uuden työtilan, kun se on valmis. Kloonaus jatkuu
              palvelimella, vaikka yhteys katkeaisi.
            </p>
          ) : null}
          {error && <p role="alert">{error}</p>}
          {!busy && leftover !== undefined && (
            <p>
              Edellinen kloonaus jäi kesken (
              {Math.max(1, Math.round(leftover / 1048576))} MiB). Aloita alusta
              poistaa keskeneräisen hakemiston ja kloonaa uudelleen.
            </p>
          )}
          {busy ? null : (
            <div className="ah-new-footer">
              <ControlButton size="page" type="button" onClick={onClose}>
                Sulje
              </ControlButton>
              {leftover !== undefined && (
                <ControlButton type="button" onClick={() => void submit(true)}>
                  Aloita alusta
                </ControlButton>
              )}
            </div>
          )}
        </>
      )}
      <ControlButton
        size="row"
        type="button"
        className="ah-new-dismiss"
        aria-label="Sulje"
        isDisabled={busy}
        onClick={onClose}
      >
        ×
      </ControlButton>
    </dialog>
  );
}
