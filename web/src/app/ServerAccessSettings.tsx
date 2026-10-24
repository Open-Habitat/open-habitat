import { useCallback, useEffect, useRef, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { type PendingChange, ServerAccess } from "../components/ServerAccess";
import {
  type AccessEntry,
  type AccessView,
  accessRefusal,
  changeAccess,
  type GitHubAccount,
  lookupLogin,
  readAccess,
} from "./serverAccess";

// The host side of Käyttäjät ja pääsy: one request per change, its row marked
// until the reply settles it. An uncertain reply stays uncertain until the
// administrator reads the list again; nothing is retried.
export function ServerAccessSettings({ csrf }: { csrf?: string }) {
  const [view, setView] = useState<AccessView>();
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<Record<string, PendingChange>>({});
  const [problem, setProblem] = useState<{ id: string; text: string }>();
  // Bumped when a change is sent and when its reply arrives. A list read
  // that a change overtook may predate it, so it is read again rather than
  // shown; an accepted read thus postdates every settled or uncertain change.
  const changes = useRef(0);
  const reload = useCallback(async (signal?: AbortSignal) => {
    try {
      let next: AccessView;
      let at: number;
      do {
        at = changes.current;
        next = await readAccess(signal);
      } while (at !== changes.current);
      setView(next);
      setFailed(false);
      // That read settles every uncertain row; sent changes still wait.
      setPending((p) =>
        Object.fromEntries(
          Object.entries(p).filter(([, c]) => c.kind !== "uncertain"),
        ),
      );
    } catch {
      if (!signal?.aborted) setFailed(true);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);
  const settle = (id: string, entry?: AccessEntry) => {
    setPending(({ [id]: _, ...rest }) => rest);
    if (!entry) return;
    setView(
      (v) =>
        v && {
          ...v,
          entries:
            entry.state === "removed"
              ? v.entries.filter((e) => e.id !== id)
              : v.entries.some((e) => e.id === id)
                ? v.entries.map((e) => (e.id === id ? entry : e))
                : [...v.entries, entry],
        },
    );
  };
  const change = async (
    action: "add" | "remove",
    id: string,
    mark: PendingChange,
  ) => {
    if (!csrf) return;
    setProblem(undefined);
    setPending((p) => ({ ...p, [id]: mark }));
    changes.current++;
    const result = await changeAccess(csrf, action, id);
    changes.current++;
    if (result.kind === "changed") settle(id, result.entry);
    else if (result.kind === "refused" || result.kind === "login") {
      // A 401 is refused before anything is written.
      settle(id);
      setProblem({
        id,
        text:
          result.kind === "login"
            ? "Istunto on päättynyt. Kirjaudu uudelleen."
            : accessRefusal(result.code),
      });
    } else setPending((p) => ({ ...p, [id]: { ...mark, kind: "uncertain" } }));
  };
  if (!view)
    return failed ? (
      <div className="s-row" role="alert">
        Käyttäjälistaa ei voitu ladata.
        <ControlButton size="row" onPress={() => void reload()}>
          Lataa uudelleen
        </ControlButton>
      </div>
    ) : (
      <p className="s-row">Ladataan käyttäjiä…</p>
    );
  return (
    <>
      {failed && (
        <div className="s-row" role="alert">
          Listaa ei voitu päivittää.
          <ControlButton size="row" onPress={() => void reload()}>
            Lataa uudelleen
          </ControlButton>
        </div>
      )}
      <ServerAccess
        view={view}
        pending={pending}
        problem={problem}
        canWrite={!!csrf}
        lookup={(login) =>
          csrf
            ? lookupLogin(csrf, login)
            : Promise.resolve({ kind: "unavailable" })
        }
        onAdd={(user: GitHubAccount, restore) =>
          void change("add", user.id, {
            kind: restore ? "restore" : "add",
            login: user.login || undefined,
            name: user.name || undefined,
          })
        }
        onRemove={(entry) =>
          void change("remove", entry.id, {
            kind: "remove",
            login: entry.login_hint,
          })
        }
        onRefresh={() => void reload()}
      />
    </>
  );
}
