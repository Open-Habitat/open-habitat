import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppleGuide,
  type AppleMode,
  AppleRemoveDialog,
  type AppleStage,
  type AppleSubmit,
} from "../components/AppleIntegration";
import {
  GiteaDialog,
  GiteaDisconnectDialog,
  type GiteaField,
  type GiteaStage,
} from "../components/GiteaConnection";
import {
  type AppleIntent,
  ConnectDialog,
  type ConnectStage,
  type GiteaIntent,
  IntegrationsOverview,
  RemoveDialog,
} from "../components/Integrations";
import { liveText } from "../i18n";
import { integrationsSettingsText } from "../text/integrationsSettings";
import { useExperimentalFeature } from "./accountPreferences";
import {
  connectGitea,
  type GiteaCheck,
  type GiteaConnection,
  giteaAction,
  replaceGiteaToken,
  usable,
} from "./gitea";
import { useGitLabSettings } from "./gitlabSettings";
import {
  type Account,
  type AppleService,
  appleServiceOf,
  changePassword,
  connectApple,
  connectPasswordAccount,
  controlLogin,
  type IntegrationChange,
  type IntegrationList,
  type Level,
  type LoginView,
  listedProvider,
  type PasswordAccount,
  type Provider,
  type ProviderId,
  Refused,
  readIntegrations,
  readLogin,
  removeAccount,
} from "./integrations";

const txt = liveText(integrationsSettingsText);

const refusals = new Proxy({} as Record<string, string>, {
  get: (_target, code: string) => txt.refusals[code],
});
/** A refused Gitea write wrote nothing; the field says where to look. */
const giteaFields: Record<string, GiteaField> = {
  invalid_address: "server",
  forbidden_destination: "server",
  unreachable: "server",
  tls_untrusted: "server",
  redirect_refused: "server",
  not_gitea: "server",
  invalid_token: "token",
  token_rejected: "token",
  insufficient_scope: "token",
  account_mismatch: "token",
  connection_exists: "form",
  native_conflict: "form",
  connection_changed: "form",
  native_busy: "form",
  write_failed: "form",
  provider_unavailable: "form",
};
const giteaRefusals = new Proxy({} as Record<string, [GiteaField, string]>, {
  get: (_target, code: string) =>
    giteaFields[code] && [giteaFields[code], txt.gitea[code]],
});
const giteaRefusal = (code: string): { field: GiteaField; text: string } => {
  const [field, text] = giteaRefusals[code] ?? ["form", txt.refused];
  return { field, text };
};
const giteaActionRefusals = new Proxy({} as Record<string, string>, {
  get: (_target, code: string) => txt.giteaAction[code],
});

const refusalText = (e: unknown) =>
  e instanceof Refused ? (refusals[e.code] ?? txt.refused) : undefined;

const appleRefusals = new Proxy({} as Record<string, string>, {
  get: (_target, code: string) => txt.apple[code],
});
/** Adding services with the stored password: what failed, and so ask. */
const reuseRefusals = new Proxy({} as Record<string, string>, {
  get: (_target, code: string) => txt.reuse[code],
});

/** The states in which the daemon is waiting on the tool or the person. */
const live = (v?: LoginView) =>
  v !== undefined &&
  ["starting", "device_code", "open_url", "completing"].includes(v.state);

/** level is the account level the person chose, kept for a restart. */
type Flow = { provider: Provider; stage: ConnectStage; level?: Level };

/** The person's outside accounts: reads the catalog and the accounts live
 * from the person's tools through their daemon, and relays sign-ins.
 * Asetukset › Tiedot agenteille shows every data source, Koodipalvelut only
 * Gitea, and an onboarding step only the providers of that step. */
export function IntegrationsSettings({
  csrf,
  only,
  except,
  initial,
  compact = false,
  onList,
  onNewWorkspace,
}: {
  csrf?: string;
  /** Show only these providers and their accounts (an onboarding step). */
  only?: ProviderId[];
  /** Leave these providers out (they have a settings page of their own). */
  except?: ProviderId[];
  /** A catalog the caller has just read; it is shown instead of reading
   * again, and the next change reads afresh as usual. */
  initial?: IntegrationList;
  compact?: boolean;
  /** Each catalog the view shows, so the caller can tell what is connected. */
  onList?: (list: IntegrationList) => void;
  /** Opens Uusi työtila, offered once a code host is connected. */
  onNewWorkspace?: () => void;
}) {
  const atlassianEnabled = useExperimentalFeature("atlassian-connect");
  const trelloEnabled = useExperimentalFeature("trello-connect");
  // Experimental providers stay out of sight, sign-in included, until enabled.
  const hidden = useCallback(
    (id: ProviderId) =>
      (id === "atlassian" && !atlassianEnabled) ||
      (id === "trello" && !trelloEnabled),
    [atlassianEnabled, trelloEnabled],
  );
  const [list, setList] = useState<IntegrationList | undefined>(initial);
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState<Set<string> | "all">(
    initial ? new Set() : "all",
  );
  const reported = useRef(onList);
  reported.current = onList;
  useEffect(() => {
    if (list) reported.current?.(list);
  }, [list]);
  const [flow, setFlow] = useState<Flow>();
  const [removing, setRemoving] = useState<{
    account: Account;
    busy?: boolean;
    error?: string;
  }>();
  const [notice, setNotice] = useState("");
  const [apple, setApple] = useState<{ mode: AppleMode; stage: AppleStage }>();
  const [appleRemoving, setAppleRemoving] = useState<{
    appleId: string;
    services: AppleService[];
    busy?: boolean;
    error?: string;
  }>();
  const [gitea, setGitea] = useState<{
    replace?: GiteaConnection;
    stage: GiteaStage;
  }>();
  const [giteaChecks, setGiteaChecks] = useState<Record<string, GiteaCheck>>(
    {},
  );
  // Connections this view has checked or is checking without being asked.
  const giteaSeen = useRef(new Set<string>());
  const [giteaBusy, setGiteaBusy] = useState(false);
  const [giteaRemoving, setGiteaRemoving] = useState<{
    connection: GiteaConnection;
    busy?: boolean;
    error?: string;
  }>();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // A reply that arrives after the session changed belongs to the previous
  // person's write and is never shown to the next one.
  const session = useRef(csrf);
  session.current = csrf;
  const current = (sent: string) => alive.current && session.current === sent;
  // Another login replaced the session: the previous person's Gitea form,
  // with the token typed into it, and a dialog waiting on their write are not
  // the next person's to see.
  const shownFor = useRef(csrf);
  useEffect(() => {
    if (shownFor.current && shownFor.current !== csrf) {
      setGitea(undefined);
      setGiteaRemoving(undefined);
      setGiteaChecks({});
      giteaSeen.current = new Set();
      setGiteaBusy(false);
    }
    shownFor.current = csrf;
  }, [csrf]);

  const load = useCallback(async (one?: Account) => {
    setChecking(one ? new Set([`${one.provider}:${one.address}`]) : "all");
    try {
      const next = await readIntegrations();
      if (!alive.current) return;
      setList(next);
      setFailed(false);
    } catch {
      if (alive.current) setFailed(true);
    } finally {
      if (alive.current) setChecking(new Set());
    }
  }, []);

  // A connection the page shows is checked once without being asked, so a
  // read-only token is named before a push meets Gitea's 403. One at a
  // time, as the daemon serializes them, and silently: Tarkista asks again
  // and says what went wrong. The daemon refuses a write that meets another
  // rather than queueing it, so the person's own action waits for the check
  // in flight and stops the rest; what was left unchecked, or met a busy
  // daemon, is checked when the list is read again.
  const giteaAuto = useRef({ holds: 0, done: Promise.resolve() });
  useEffect(() => {
    const sent = csrf;
    const shown =
      (!only || only.includes("gitea")) && !except?.includes("gitea");
    if (!sent || !shown || !list?.gitea) return;
    const due = list.gitea.connections.filter(
      (c) => usable(c) && !giteaSeen.current.has(c.id),
    );
    if (!due.length) return;
    for (const c of due) giteaSeen.current.add(c.id);
    const auto = giteaAuto.current;
    auto.done = auto.done
      .then(async () => {
        for (const [i, c] of due.entries()) {
          if (!alive.current || session.current !== sent) return;
          if (auto.holds > 0) {
            for (const left of due.slice(i)) giteaSeen.current.delete(left.id);
            return;
          }
          try {
            const change = await giteaAction(sent, "check", c.id);
            if (!alive.current || session.current !== sent) return;
            const api = change.api;
            if (api)
              setGiteaChecks((m) =>
                m[c.id] ? m : { ...m, [c.id]: { api, push: change.push } },
              );
          } catch (e) {
            if (e instanceof Refused && e.code === "native_busy")
              giteaSeen.current.delete(c.id);
          }
        }
      })
      .catch(() => {});
  }, [csrf, list, only, except]);
  /** Runs the person's own Gitea write after the automatic check in flight. */
  const giteaOwn = async <T,>(write: () => Promise<T>): Promise<T> => {
    const auto = giteaAuto.current;
    auto.holds++;
    try {
      await auto.done;
      return await write();
    } finally {
      auto.holds--;
    }
  };

  const gitlab = useGitLabSettings({
    csrf,
    list,
    current,
    alive,
    load,
    setNotice,
    onNewWorkspace,
  });

  const preread = useRef(initial !== undefined);
  useEffect(() => {
    if (preread.current) preread.current = false;
    else void load();
    // A sign-in this browser started survives a reload: show it again.
    void readLogin()
      .then((view) => {
        if (view.address && view.state === "completing") return;
        if (!alive.current || (!live(view) && view.state !== "choose_folders"))
          return;
        // A page resumes only the sign-in of a provider it shows.
        if (
          view.provider &&
          (hidden(view.provider) ||
            (only && !only.includes(view.provider)) ||
            except?.includes(view.provider))
        )
          return;
        void readIntegrations().then((l) => {
          const provider = l.providers.find((p) => p.id === view.provider);
          if (alive.current && provider)
            setFlow({ provider, stage: { stage: "login", view } });
        });
      })
      .catch(() => {});
  }, [load, only, except, hidden]);

  // While the tool waits, ask the daemon how far it got.
  // A failed read schedules the next one: a lost poll must not strand the
  // dialog while the daemon finishes the sign-in.
  const view = flow?.stage.stage === "login" ? flow.stage.view : undefined;
  const [retry, setRetry] = useState(0);
  // A folder choice is read again while its sizes are being counted.
  const counting =
    view?.state === "choose_folders" &&
    view.folders?.some((f) => f.measuring) === true;
  useEffect(() => {
    void retry;
    if (!live(view) && !counting) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void readLogin(controller.signal, view?.provider)
        .then((next) => {
          if (controller.signal.aborted) return;
          setFlow((f) =>
            f &&
            f.stage.stage === "login" &&
            f.stage.view.attempt_id === next.attempt_id
              ? {
                  ...f,
                  // A refusal describes the step it answered; once the
                  // daemon moves on it would mislabel the new state.
                  stage:
                    next.state === f.stage.view.state
                      ? { ...f.stage, view: next }
                      : { stage: "login", view: next },
                }
              : f,
          );
          if (next.state === "completed") void load();
        })
        .catch(() => {
          if (!controller.signal.aborted) setRetry((n) => n + 1);
        });
    }, 1500);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [view, counting, load, retry]);

  // Catalog observations outlive the dialog and are visible to any session
  // of this Unix user. Single flight; a failed read retains the last state.
  // Synced files keep changing without a first sync too: ordinary passes run
  // every minute, so their progress and last success stay live while shown.
  const backgroundSync = list?.accounts.some((a) =>
    a.services.some((s) => s.state === "syncing" || !!s.directory),
  );
  useEffect(() => {
    if (!backgroundSync) return;
    const controller = new AbortController();
    let timer: number;
    const poll = async () => {
      try {
        if (document.hidden) return;
        const next = await readIntegrations(controller.signal);
        if (!controller.signal.aborted) {
          setList(next);
          setFailed(false);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(poll, 15000);
      }
    };
    timer = window.setTimeout(poll, 15000);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [backgroundSync]);

  const setStage = (stage: ConnectStage) =>
    setFlow((f) => (f ? { ...f, stage } : f));

  const startLogin = async (
    provider: Provider,
    address?: string,
    level?: Level,
  ) => {
    if (!csrf) return;
    setFlow({
      provider,
      level,
      stage: {
        stage: "login",
        view: {
          schema_version: 1,
          state: "starting",
          provider: provider.id,
          relogin: Boolean(address),
        },
      },
    });
    try {
      const next = await controlLogin(csrf, {
        action: "start",
        provider: provider.id,
        ...(address ? { address } : {}),
        ...(level ? { level } : {}),
      });
      setFlow({ provider, level, stage: { stage: "login", view: next } });
    } catch (e) {
      const text = refusalText(e);
      setFlow({
        provider,
        level,
        stage: text
          ? {
              stage: "login",
              view: {
                schema_version: 1,
                state: "failed",
                provider: provider.id,
                failure: "tool_failed",
              },
              error: text,
            }
          : { stage: "uncertain" },
      });
    }
  };

  const onPassword = async (account: PasswordAccount) => {
    if (!csrf || flow?.stage.stage !== "password") return;
    const relogin = flow.stage.relogin;
    setStage({ stage: "password", relogin, busy: true });
    try {
      const change = relogin
        ? await changePassword(
            csrf,
            relogin,
            account.password,
            flow.provider.id,
          )
        : await connectPasswordAccount(csrf, account, flow.provider.id);
      const connected = change.account;
      if (connected)
        setList((l) =>
          l
            ? {
                ...l,
                skill: change.skill,
                accounts: [
                  ...l.accounts.filter(
                    (a) =>
                      !(
                        a.provider === connected.provider &&
                        a.address === connected.address
                      ),
                  ),
                  connected,
                ],
              }
            : l,
        );
      setStage({
        stage: "connected",
        address: connected?.address ?? relogin ?? "",
        relogin: Boolean(relogin),
      });
    } catch (e) {
      const text = refusalText(e);
      if (text) setStage({ stage: "password", relogin, error: text });
      else setStage({ stage: "uncertain" });
    }
  };

  const merge = (change: IntegrationChange) =>
    setList((l) => {
      const changed = change.accounts ?? [];
      return l
        ? {
            ...l,
            skill: change.skill,
            accounts: [
              ...l.accounts.filter(
                (a) =>
                  !changed.some(
                    (c) => c.provider === a.provider && c.address === a.address,
                  ),
              ),
              ...changed,
            ],
          }
        : l;
    });

  const onApple = (intent: AppleIntent) => {
    setNotice("");
    if (intent.kind === "remove") {
      setAppleRemoving({ appleId: intent.appleId, services: intent.services });
      return;
    }
    const have = (list?.accounts ?? [])
      .filter((a) => a.apple_id === intent.appleId)
      .flatMap((a) => appleServiceOf(a) ?? []);
    setApple({
      mode:
        intent.kind === "add"
          ? {
              kind: "add",
              appleId: intent.appleId,
              missing: intent.missing,
              have,
            }
          : {
              kind: "renew",
              appleId: intent.appleId,
              services: intent.services,
            },
      stage: { stage: "steps" },
    });
  };

  const onAppleSubmit = async (submit: AppleSubmit) => {
    if (!csrf || !apple || apple.stage.stage !== "steps") return;
    const { mode } = apple;
    const askPassword = apple.stage.askPassword;
    setApple({ mode, stage: { stage: "steps", busy: true, askPassword } });
    try {
      const change =
        mode.kind === "renew"
          ? await changePassword(
              csrf,
              submit.appleId,
              submit.password ?? "",
              "apple",
            )
          : await connectApple(
              csrf,
              submit.appleId,
              submit.services,
              submit.password,
              submit.mailAddress,
            );
      merge(change);
      setApple({
        mode,
        stage: {
          stage: "done",
          connected: (change.accounts ?? []).flatMap(
            (a) => appleServiceOf(a) ?? [],
          ),
          failed: change.failed ?? [],
        },
      });
    } catch (e) {
      if (!(e instanceof Refused)) {
        setApple({ mode, stage: { stage: "uncertain" } });
        return;
      }
      // The stored password did not do: ask for one, as for a new Apple ID.
      const reuse =
        mode.kind === "add" && submit.password === undefined
          ? reuseRefusals[e.code]
          : undefined;
      setApple({
        mode,
        stage: {
          stage: "steps",
          askPassword: askPassword || reuse !== undefined,
          error: reuse ?? appleRefusals[e.code] ?? refusalText(e),
        },
      });
    }
  };

  const confirmAppleRemove = async () => {
    if (!csrf || !appleRemoving) return;
    const { appleId, services } = appleRemoving;
    setAppleRemoving({ appleId, services, busy: true });
    try {
      const change = await removeAccount(csrf, "apple", appleId, false);
      setList((l) =>
        l
          ? {
              ...l,
              skill: change.skill,
              accounts: l.accounts.filter((a) => a.apple_id !== appleId),
            }
          : l,
      );
      setAppleRemoving(undefined);
      setNotice(txt.appleRemoved);
    } catch (e) {
      const text = refusalText(e);
      if (text) {
        setAppleRemoving({ appleId, services, error: text });
        if (e instanceof Refused && e.code === "account_missing") void load();
      } else {
        setAppleRemoving(undefined);
        setNotice(txt.removeUncertain);
        void load();
      }
    }
  };

  const loginWrite = async (control: Parameters<typeof controlLogin>[1]) => {
    if (!csrf || flow?.stage.stage !== "login") return;
    const current = flow.stage.view;
    setStage({ stage: "login", view: current, busy: true });
    try {
      const next = await controlLogin(csrf, control);
      setStage({ stage: "login", view: next });
      if (
        next.state === "completed" ||
        (next.state === "completing" && next.address)
      )
        void load();
    } catch (e) {
      const text = refusalText(e);
      if (text) setStage({ stage: "login", view: current, error: text });
      else setStage({ stage: "uncertain" });
    }
  };

  const close = () => {
    const v = flow?.stage.stage === "login" ? flow.stage.view : undefined;
    const changed =
      flow?.stage.stage === "connected" ||
      flow?.stage.stage === "uncertain" ||
      v?.state === "completed" ||
      // A first sync that failed keeps the login it signed in.
      v?.state === "failed" ||
      (v?.state === "completing" && Boolean(v.address));
    setFlow(undefined);
    // Leaving the dialog ends a sign-in still in progress; nothing it had
    // not finished is kept. A cancellation whose answer is lost is said to
    // be uncertain and never sent again on its own.
    if (
      csrf &&
      v?.attempt_id &&
      !(v.state === "completing" && v.address) &&
      (live(v) || v.state === "choose_folders")
    ) {
      void controlLogin(csrf, { action: "cancel", attempt_id: v.attempt_id })
        .catch((e) => {
          if (!(e instanceof Refused) && alive.current)
            setNotice(txt.cancelUncertain);
        })
        .finally(() => void load());
      return;
    }
    if (changed) void load();
  };

  const stopSync = async (account: Account) => {
    if (!csrf) return;
    try {
      const current = await readLogin(undefined, account.provider);
      if (
        current.provider !== account.provider ||
        current.address !== account.address ||
        current.state !== "completing" ||
        !current.attempt_id
      ) {
        setNotice(txt.stopElsewhere);
        return;
      }
      await controlLogin(csrf, {
        action: "cancel",
        attempt_id: current.attempt_id,
      });
      setNotice(txt.stopping);
    } catch {
      setNotice(txt.stopUncertain);
    }
    void load();
  };

  const confirmRemove = async (deleteDirectories: boolean) => {
    if (!csrf || !removing) return;
    const { account } = removing;
    setRemoving({ account, busy: true });
    try {
      const change = await removeAccount(
        csrf,
        account.provider,
        account.address,
        deleteDirectories,
      );
      setList((l) =>
        l
          ? {
              ...l,
              skill: change.skill,
              accounts: l.accounts.filter(
                (a) =>
                  !(
                    a.provider === account.provider &&
                    a.address === account.address
                  ),
              ),
            }
          : l,
      );
      setRemoving(undefined);
      setNotice(
        change.kept_directories?.length
          ? txt.removedKept(change.kept_directories)
          : change.trashed_directories?.length
            ? txt.removedTrashed(change.trashed_directories)
            : txt.removed,
      );
    } catch (e) {
      const text = refusalText(e);
      if (text) {
        setRemoving({ account, error: text });
        if (e instanceof Refused && e.code === "account_missing") void load();
      } else {
        setRemoving(undefined);
        setNotice(txt.removeUncertain);
        void load();
      }
    }
  };

  const submitGitea = async (address: string, token: string) => {
    const sent = csrf;
    const replace = gitea?.replace;
    if (!sent) return;
    setGitea((g) => g && { ...g, stage: { stage: "form", busy: true } });
    try {
      const change = await giteaOwn(() =>
        replace
          ? replaceGiteaToken(sent, replace.id, token)
          : connectGitea(sent, address, token),
      );
      if (!current(sent)) return;
      const connection = change.connection;
      setGitea((g) =>
        g && connection
          ? {
              ...g,
              stage: {
                stage: "done",
                connection,
                replaced: !!replace,
                push: change.push,
              },
            }
          : g,
      );
      if (connection && change.api) {
        const check = { api: change.api, push: change.push };
        giteaSeen.current.add(connection.id);
        setGiteaChecks((c) => ({ ...c, [connection.id]: check }));
      }
      void load();
    } catch (e) {
      if (!current(sent)) return;
      if (e instanceof Refused) {
        setGitea(
          (g) =>
            g && {
              ...g,
              stage: { stage: "form", error: giteaRefusal(e.code) },
            },
        );
        if (e.code === "connection_changed") void load();
      } else {
        // Whether tea's file changed is unknown: read it, never resend.
        setGitea((g) => g && { ...g, stage: { stage: "uncertain" } });
        void load();
      }
    }
  };

  const onGitea = async (intent: GiteaIntent) => {
    setNotice("");
    if (intent.kind === "replace") {
      setGitea({ replace: intent.connection, stage: { stage: "form" } });
      return;
    }
    if (intent.kind === "disconnect") {
      setGiteaRemoving({ connection: intent.connection });
      return;
    }
    const sent = csrf;
    const kind = intent.kind;
    if (!sent || giteaBusy) return;
    setGiteaBusy(true);
    try {
      const change = await giteaOwn(() =>
        giteaAction(sent, kind, intent.connection.id),
      );
      if (!current(sent)) return;
      const api = change.api;
      if (api) {
        const check = { api, push: change.push };
        setGiteaChecks((c) => ({ ...c, [intent.connection.id]: check }));
      }
      if (gitea?.stage.stage === "done" && change.connection) {
        const connection = change.connection;
        setGitea((g) =>
          g && g.stage.stage === "done"
            ? { ...g, stage: { ...g.stage, connection } }
            : g,
        );
      }
    } catch (e) {
      if (!current(sent)) return;
      setNotice(
        e instanceof Refused
          ? (giteaActionRefusals[e.code] ?? txt.refused)
          : txt.noReply,
      );
    } finally {
      if (alive.current) setGiteaBusy(false);
      void load();
    }
  };

  const confirmGiteaRemove = async () => {
    const sent = csrf;
    const target = giteaRemoving?.connection;
    if (!sent || !target) return;
    setGiteaRemoving({ connection: target, busy: true });
    try {
      await giteaOwn(() => giteaAction(sent, "disconnect", target.id));
      if (!current(sent)) return;
      setGiteaRemoving(undefined);
      setNotice(txt.giteaDisconnected);
    } catch (e) {
      if (!current(sent)) return;
      if (e instanceof Refused)
        setGiteaRemoving({
          connection: target,
          error: giteaActionRefusals[e.code] ?? txt.refused,
        });
      else {
        setGiteaRemoving(undefined);
        setNotice(txt.disconnectUncertain);
      }
    } finally {
      void load();
    }
  };

  const shows = (id: ProviderId) =>
    !hidden(id) && (!only || only.includes(id)) && !except?.includes(id);
  if (!list)
    return failed ? (
      <p role="alert">{txt.listFailed}</p>
    ) : (
      <p data-testid="integrations-loading" className="ig-wait" role="status">
        <span className="ig-spin" aria-hidden="true" />
        {txt.reading}
      </p>
    );
  return (
    <>
      {notice ? (
        <p data-testid="integration-removal-result" role="status">
          {notice}
        </p>
      ) : null}
      {failed ? <p role="alert">{txt.stale}</p> : null}
      <IntegrationsOverview
        compact={compact}
        list={
          only || except || !atlassianEnabled || !trelloEnabled
            ? {
                ...list,
                providers: list.providers.filter((p) => shows(p.id)),
                accounts: list.accounts.filter((a) => shows(listedProvider(a))),
                gitea: shows("gitea") ? list.gitea : undefined,
                gitlab: shows("gitlab") ? list.gitlab : undefined,
              }
            : list
        }
        checking={checking}
        onCheck={(a) => void load(a)}
        onGitea={(intent) => void onGitea(intent)}
        giteaChecks={giteaChecks}
        giteaBusy={giteaBusy}
        {...gitlab.overview}
        onConnect={(provider) => {
          setNotice("");
          if (provider.id === "gitea") setGitea({ stage: { stage: "form" } });
          else if (provider.id === "gitlab") gitlab.connect();
          else if (provider.id === "apple")
            setApple({ mode: { kind: "new" }, stage: { stage: "steps" } });
          else setFlow({ provider, stage: { stage: "intro" } });
        }}
        onApple={onApple}
        onSignInAgain={(account) => {
          const provider = list.providers.find(
            (p) => p.id === account.provider,
          );
          if (!provider) return;
          if (provider.login === "app_password")
            setFlow({
              provider,
              stage: { stage: "password", relogin: account.address },
            });
          else void startLogin(provider, account.address);
        }}
        onChangeLevel={(account) => {
          const provider = list.providers.find(
            (p) => p.id === account.provider,
          );
          if (!provider) return;
          setNotice("");
          setFlow({ provider, stage: { stage: "intro", account } });
        }}
        onStopSync={(account) => void stopSync(account)}
        onRemove={(account) => {
          setNotice("");
          setRemoving({ account });
        }}
      />
      {flow ? (
        <ConnectDialog
          provider={flow.provider}
          stage={flow.stage}
          onContinue={(level) => {
            if (flow.provider.login === "app_password")
              setStage({ stage: "password" });
            else
              void startLogin(
                flow.provider,
                flow.stage.stage === "intro"
                  ? flow.stage.account?.address
                  : undefined,
                level,
              );
          }}
          onPassword={(a) => void onPassword(a)}
          onPaste={(url) => {
            const id =
              flow.stage.stage === "login"
                ? flow.stage.view.attempt_id
                : undefined;
            if (id)
              void loginWrite({
                action: "redirect",
                attempt_id: id,
                redirect_url: url,
              });
          }}
          onFolders={(ids) => {
            const id =
              flow.stage.stage === "login"
                ? flow.stage.view.attempt_id
                : undefined;
            if (id)
              void loginWrite({
                action: "folders",
                attempt_id: id,
                folders: ids,
              });
          }}
          onSkipFolders={() => {
            const id =
              flow.stage.stage === "login"
                ? flow.stage.view.attempt_id
                : undefined;
            if (id) void loginWrite({ action: "skip_folders", attempt_id: id });
          }}
          onRestart={() => {
            const v =
              flow.stage.stage === "login" ? flow.stage.view : undefined;
            void startLogin(
              flow.provider,
              v?.relogin ? v.address : undefined,
              flow.level,
            );
          }}
          onClose={close}
        />
      ) : null}
      {gitea ? (
        <GiteaDialog
          replace={gitea.replace}
          stage={gitea.stage}
          onSubmit={(address, token) => void submitGitea(address, token)}
          onRepair={(connection) =>
            void onGitea({ kind: "repair", connection })
          }
          onClose={() => {
            if (gitea.stage.stage === "form" && gitea.stage.busy) return;
            setGitea(undefined);
          }}
        />
      ) : null}
      {gitlab.dialogs}
      {giteaRemoving ? (
        <GiteaDisconnectDialog
          connection={giteaRemoving.connection}
          busy={giteaRemoving.busy}
          error={giteaRemoving.error}
          onConfirm={() => void confirmGiteaRemove()}
          onClose={() => setGiteaRemoving(undefined)}
        />
      ) : null}
      {apple ? (
        <AppleGuide
          mode={apple.mode}
          stage={apple.stage}
          onSubmit={(s) => void onAppleSubmit(s)}
          onClose={() => {
            const changed = apple.stage.stage !== "steps";
            setApple(undefined);
            if (changed) void load();
          }}
        />
      ) : null}
      {appleRemoving ? (
        <AppleRemoveDialog
          appleId={appleRemoving.appleId}
          services={appleRemoving.services}
          busy={appleRemoving.busy}
          error={appleRemoving.error}
          onConfirm={() => void confirmAppleRemove()}
          onClose={() => setAppleRemoving(undefined)}
        />
      ) : null}
      {removing ? (
        <RemoveDialog
          account={removing.account}
          busy={removing.busy}
          error={removing.error}
          onConfirm={(d) => void confirmRemove(d)}
          onClose={() => setRemoving(undefined)}
        />
      ) : null}
    </>
  );
}
