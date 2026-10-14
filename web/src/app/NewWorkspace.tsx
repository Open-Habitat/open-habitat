import { useEffect, useRef, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { catalog, clone, type Repo } from "./github";

export function NewWorkspace({
  csrf,
  token,
  onClose,
  onCreated,
  refresh,
}: {
  csrf: string;
  token?: string;
  onClose: () => void;
  onCreated: (name: string) => void;
  refresh: () => void;
}) {
  const [mode, setMode] = useState<"github" | "directory">("github");
  const [value, setValue] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  useEffect(() => {
    let live = true;
    void catalog(1)
      .then((page) => {
        if (live) setRepos(page.repositories);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const submit = async () => {
    if (busy) return;
    const name = value.trim();
    if (
      mode === "github"
        ? !/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(name)
        : !/^[a-z0-9][a-z0-9._-]*$/.test(name)
    ) {
      setError("Tarkista nimi.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "github") await clone(name, csrf);
      else {
        if (!token)
          throw new Error("Työtiloja ei voitu tarkistaa. Päivitä näkymä.");
        const response = await fetch("/api/v1/workspaces", {
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
        });
        if (!response.ok)
          throw new Error(
            "Luontia ei voitu vahvistaa. Tarkista työtilalista ennen uutta yritystä.",
          );
      }
      refresh();
      onCreated(name.split("/").pop() ?? name);
      onClose();
    } catch (e) {
      refresh();
      setError(
        e instanceof Error && mode === "directory"
          ? e.message
          : "Kloonausta ei voitu vahvistaa. Tarkista työtilalista ennen uutta yritystä.",
      );
    } finally {
      setBusy(false);
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
      <div className="ah-new-options">
        <ControlButton
          type="button"
          aria-pressed={mode === "github"}
          onClick={() => {
            setMode("github");
            setValue("");
          }}
        >
          Kloonaa GitHubista
        </ControlButton>
        <ControlButton
          type="button"
          aria-pressed={mode === "directory"}
          onClick={() => {
            setMode("directory");
            setValue("");
          }}
        >
          Uusi hakemisto
        </ControlButton>
      </div>
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
      {error && <p role="alert">{error}</p>}
      <div className="ah-new-footer">
        <ControlButton type="button" isDisabled={busy} onClick={onClose}>
          Peruuta
        </ControlButton>
        <ControlButton
          type="button"
          isDisabled={busy || !value.trim()}
          onClick={() => void submit()}
        >
          {busy ? "Luodaan…" : "Luo työtila"}
        </ControlButton>
      </div>
      <ControlButton
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
