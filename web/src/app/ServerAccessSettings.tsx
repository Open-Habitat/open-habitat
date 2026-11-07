import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ControlButton } from "../components/ControlElements";
import {
  type AddOutcome,
  type PendingChange,
  ServerAccess,
} from "../components/ServerAccess";
import { SectionCard } from "../components/ServerSection";
import { liveText } from "../i18n";
import { serverAccessText } from "../text/serverAccess";
import {
  type AccessEntry,
  type AccessTeam,
  type AccessView,
  accessRefusal,
  changeAccess,
  changeTeams,
  type GitHubAccount,
  lookupLogin,
  readAccess,
} from "./serverAccess";

const txt = liveText(serverAccessText);

// The host side of Käyttäjät ja pääsy: one request per change, its row marked
// until the reply settles it. An uncertain reply stays uncertain until the
// administrator reads the list again; nothing is retried.
export function ServerAccessSettings({
  csrf,
  children,
}: {
  csrf?: string;
  /** Further rows of the section's first card. */
  children?: ReactNode;
}) {
  const [view, setView] = useState<AccessView>();
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<Record<string, PendingChange>>({});
  const [problem, setProblem] = useState<{ id: string; text: string }>();
  const [teamPending, setTeamPending] = useState<
    Record<string, "remove" | "uncertain">
  >({});
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
      setTeamPending((p) =>
        Object.fromEntries(
          Object.entries(p).filter(([, c]) => c !== "uncertain"),
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
          // A revoked designation with no admission leaves nothing to list.
          entries:
            entry.state === "removed" ||
            (entry.state === "unlisted" && !entry.administrator_role)
              ? v.entries.filter((e) => e.id !== id)
              : v.entries.some((e) => e.id === id)
                ? v.entries.map((e) => (e.id === id ? entry : e))
                : [...v.entries, entry],
        },
    );
  };
  // A team change answers with the teams; members' rows follow from the
  // broker, so the list is read again once the reply has settled it.
  const changeTeam = async (
    change: Parameters<typeof changeTeams>[1],
  ): Promise<AddOutcome> => {
    const ended = txt.sessionEnded;
    if (!csrf) return { kind: "refused", text: ended };
    changes.current++;
    const result = await changeTeams(csrf, change);
    changes.current++;
    if (result.kind === "changed") {
      setView((v) => v && { ...v, teams: result.teams });
      void reload();
      return { kind: "changed" };
    }
    if (result.kind === "refused")
      return { kind: "refused", text: accessRefusal(result.code) };
    if (result.kind === "login") return { kind: "refused", text: ended };
    return { kind: "uncertain" };
  };
  const removeTeam = async (team: AccessTeam) => {
    const key = `${team.org_id}/${team.slug}`;
    setTeamPending((p) => ({ ...p, [key]: "remove" }));
    const outcome = await changeTeam({
      remove: { org_id: team.org_id, slug: team.slug },
    });
    setTeamPending(({ [key]: _, ...rest }) =>
      outcome.kind === "uncertain" ? { ...rest, [key]: "uncertain" } : rest,
    );
    if (outcome.kind === "refused") setProblem({ id: key, text: outcome.text });
  };
  const change = async (
    action: "add" | "remove" | "forget" | "grant" | "revoke",
    id: string,
    mark: PendingChange,
  ): Promise<AddOutcome> => {
    const ended = txt.sessionEnded;
    if (!csrf) return { kind: "refused", text: ended };
    setProblem(undefined);
    setPending((p) => ({ ...p, [id]: mark }));
    changes.current++;
    const result = await changeAccess(csrf, action, id);
    changes.current++;
    if (result.kind === "changed") {
      settle(id, result.entry);
      return { kind: "changed" };
    }
    if (result.kind === "refused" || result.kind === "login") {
      // A 401 is refused before anything is written.
      settle(id);
      const text = result.kind === "login" ? ended : accessRefusal(result.code);
      setProblem({ id, text });
      return { kind: "refused", text };
    }
    setPending((p) => ({ ...p, [id]: { ...mark, kind: "uncertain" } }));
    return { kind: "uncertain" };
  };
  if (!view)
    return (
      <SectionCard>
        {failed ? (
          <div className="s-row" role="alert">
            {txt.listFailed}
            <ControlButton size="row" onPress={() => void reload()}>
              {txt.reload}
            </ControlButton>
          </div>
        ) : (
          <p className="s-row">{txt.loading}</p>
        )}
        {children}
      </SectionCard>
    );
  return (
    <>
      {failed && (
        <SectionCard>
          <div className="s-row" role="alert">
            {txt.refreshFailed}
            <ControlButton size="row" onPress={() => void reload()}>
              {txt.reload}
            </ControlButton>
          </div>
        </SectionCard>
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
          change("add", user.id, {
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
        onRole={(entry, administrator) =>
          void change(administrator ? "grant" : "revoke", entry.id, {
            kind: administrator ? "grant" : "revoke",
            login: entry.login_hint,
          })
        }
        onRefresh={() => void reload()}
        onAddTeam={(name) => changeTeam({ add: name })}
        onRemoveTeam={(team) => void removeTeam(team)}
        onForget={(entry) =>
          void change("forget", entry.id, {
            kind: "forget",
            login: entry.login_hint,
          })
        }
        teamPending={teamPending}
      >
        {children}
      </ServerAccess>
    </>
  );
}
