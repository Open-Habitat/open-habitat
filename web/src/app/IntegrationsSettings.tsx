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
import {
  connectGitea,
  type GiteaAPI,
  type GiteaConnection,
  giteaAction,
  replaceGiteaToken,
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

const refusals: Record<string, string> = {
  credentials_rejected:
    "Palvelin ei hyväksynyt tunnusta tai salasanaa. Mitään ei tallennettu.",
  server_unreachable:
    "Palvelimeen ei saatu yhteyttä. Tarkista palvelimen nimi, portti ja suojaus. Mitään ei tallennettu.",
  endpoint_rejected:
    "DAV-osoitteesta ei löytynyt kalentereita tai yhteystietoja, tai palvelin ohjasi toiseen verkkotunnukseen. Tarkista osoite. Mitään ei tallennettu.",
  account_exists: "Tämä tili on jo yhdistetty.",
  account_missing: "Tiliä ei enää ole. Sivu päivitetään.",
  provider_unavailable:
    "Tämä integraatio ei ole käytettävissä tällä palvelimella.",
  redirect_invalid:
    "Tämä ei ole se osoite, johon kirjautuminen päättyi. Liitä osoiteriviltä koko osoite.",
  quota_insufficient:
    "Valitut kansiot eivät enää mahdu kotihakemistoosi. Jätä jokin pois.",
  attempt_active:
    "Kirjautuminen tai ensimmäinen synkronointi on kesken. Odota, että se päättyy.",
  attempt_not_found: "Kirjautuminen ei ole enää voimassa. Aloita alusta.",
};
/** A refused Gitea write wrote nothing; the field says where to look. */
const giteaRefusals: Record<string, [GiteaField, string]> = {
  invalid_address: [
    "server",
    "Anna palvelimen HTTPS-osoite, esimerkiksi https://git.example.org.",
  ],
  forbidden_destination: [
    "server",
    "Tähän osoitteeseen ei voi yhdistää. Anna Gitea-palvelimen oma osoite.",
  ],
  unreachable: [
    "server",
    "Palvelin ei vastaa. Tarkista osoite ja Habitatin verkkoyhteys palvelimeen.",
  ],
  tls_untrusted: [
    "server",
    "Palvelimen varmennetta ei voitu tarkistaa. Ylläpitäjän pitää lisätä sen varmentaja luotettuihin.",
  ],
  redirect_refused: [
    "server",
    "Palvelin ohjasi toiseen osoitteeseen. Anna Gitean lopullinen osoite.",
  ],
  not_gitea: [
    "server",
    "Osoitteesta ei vastannut Gitea. Tarkista osoite ja sen mahdollinen polku.",
  ],
  invalid_token: [
    "token",
    "Tunnuksessa on merkkejä, joita pääsytunnuksessa ei ole. Kopioi se uudelleen.",
  ],
  token_rejected: [
    "token",
    "Tunnus hylättiin. Tarkista tunnus ja sen lukuoikeudet Giteassa.",
  ],
  insufficient_scope: [
    "token",
    "Tunnukselta puuttuu lukuoikeus käyttäjätietoihin tai repoihin. Anna sille read:user ja read:repository.",
  ],
  account_mismatch: [
    "token",
    "Tunnus kuuluu toiselle Gitea-tilille kuin tämä yhteys.",
  ],
  connection_exists: ["form", "Tämä Gitea-tili tai tunnus on jo yhdistetty."],
  native_conflict: [
    "form",
    "tea-asetuksissa on jo samanniminen tai kahdentunut kirjautuminen. Selvitä se tealla.",
  ],
  connection_changed: ["form", "Yhteys on muuttunut. Sivu päivitetään."],
  native_busy: [
    "form",
    "Toinen muutos on kesken. Yritä hetken päästä uudelleen.",
  ],
  write_failed: ["form", "Asetusta ei voitu tallentaa. Mitään ei muutettu."],
  provider_unavailable: [
    "form",
    "Gitea ei ole käytettävissä tällä palvelimella.",
  ],
};
const giteaRefusal = (code: string): { field: GiteaField; text: string } => {
  const [field, text] = giteaRefusals[code] ?? [
    "form",
    "Pyyntöä ei hyväksytty. Mitään ei muutettu.",
  ];
  return { field, text };
};
const giteaActionRefusals: Record<string, string> = {
  clone_running:
    "Tämän yhteyden kloonaus on käynnissä. Keskeytä se tai odota sen valmistumista ja yritä sitten uudelleen.",
  helper_conflict:
    "Git-asetuksissasi on tälle palvelimelle jo toinen tunnusapuri. Habitat ei kirjoita sen päälle.",
  connection_changed: "Yhteys on muuttunut. Sivu päivitetään.",
  native_busy: "Toinen muutos on kesken. Yritä hetken päästä uudelleen.",
  unsupported_entry: "Tätä tea-kirjautumista ei voi muuttaa täältä.",
};

const refusalText = (e: unknown) =>
  e instanceof Refused
    ? (refusals[e.code] ?? "Pyyntöä ei hyväksytty. Mitään ei muutettu.")
    : undefined;

const appleRefusals: Record<string, string> = {
  credentials_rejected:
    "Apple ei hyväksynyt Apple ID:tä ja salasanaa. Tarkista, että annoit sovellussalasanan etkä Apple-tilin omaa salasanaa. Mitään ei tallennettu.",
  server_unreachable:
    "Appleen ei saatu yhteyttä. Yritä hetken päästä uudelleen. Mitään ei tallennettu.",
  endpoint_rejected:
    "iCloud ei kertonut kalenterin tai yhteystietojen osoitetta. Mitään ei tallennettu.",
  account_exists: "Valittu palvelu on jo yhdistetty.",
};
/** Adding services with the stored password: what failed, and so ask. */
const reuseRefusals: Record<string, string> = {
  credentials_rejected:
    "Tallennettu sovellussalasana ei enää kelpaa. Luo uusi ja anna se tähän. Mitään ei tallennettu.",
  account_missing: "Tallennettua sovellussalasanaa ei löytynyt. Anna se tähän.",
};

/** The states in which the daemon is waiting on the tool or the person. */
const live = (v?: LoginView) =>
  v !== undefined &&
  ["starting", "device_code", "open_url", "completing"].includes(v.state);

type Flow = { provider: Provider; stage: ConnectStage };

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
  const [giteaChecks, setGiteaChecks] = useState<Record<string, GiteaAPI>>({});
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
          ((only && !only.includes(view.provider)) ||
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
  }, [load, only, except]);

  // While the tool waits, ask the daemon how far it got.
  // A failed read schedules the next one: a lost poll must not strand the
  // dialog while the daemon finishes the sign-in.
  const view = flow?.stage.stage === "login" ? flow.stage.view : undefined;
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    void retry;
    if (!live(view)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void readLogin(controller.signal)
        .then((next) => {
          if (controller.signal.aborted) return;
          setFlow((f) =>
            f &&
            f.stage.stage === "login" &&
            f.stage.view.attempt_id === next.attempt_id
              ? { ...f, stage: { ...f.stage, view: next } }
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
  }, [view, load, retry]);

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

  const startLogin = async (provider: Provider, address?: string) => {
    if (!csrf) return;
    setFlow({
      provider,
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
      });
      setFlow({ provider, stage: { stage: "login", view: next } });
    } catch (e) {
      const text = refusalText(e);
      setFlow({
        provider,
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
      setNotice("Apple-tili poistettu.");
    } catch (e) {
      const text = refusalText(e);
      if (text) {
        setAppleRemoving({ appleId, services, error: text });
        if (e instanceof Refused && e.code === "account_missing") void load();
      } else {
        setAppleRemoving(undefined);
        setNotice(
          "Poiston tulosta ei saatu. Sivu päivitetään; tarkista tila ennen kuin yrität uudelleen.",
        );
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
            setNotice(
              "Kirjautumisen peruminen ei varmistunut. Se voi vielä valmistua; tarkista tilanne tältä sivulta.",
            );
        })
        .finally(() => void load());
      return;
    }
    if (changed) void load();
  };

  const stopSync = async (account: Account) => {
    if (!csrf) return;
    try {
      const current = await readLogin();
      if (
        current.provider !== account.provider ||
        current.address !== account.address ||
        current.state !== "completing" ||
        !current.attempt_id
      ) {
        setNotice(
          "Keskeytä synkronointi siinä selainistunnossa, jossa aloitit sen. Palvelimen itse jatkaman ensimmäisen synkronoinnin voi pysäyttää vain poistamalla tilin.",
        );
        return;
      }
      await controlLogin(csrf, {
        action: "cancel",
        attempt_id: current.attempt_id,
      });
      setNotice(
        "Synkronointi keskeytetään. Jo kopioidut tiedostot ja kirjautuminen säilyvät.",
      );
    } catch {
      setNotice(
        "Keskeyttämisen tulos ei varmistunut. Tarkista tila ennen uutta yritystä.",
      );
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
          ? `Poistettu. ${change.kept_directories.join(" ja ")} jäi kotihakemistoosi.`
          : change.trashed_directories?.length
            ? `Poistettu. ${change.trashed_directories.join(" ja ")} siirrettiin roskakoriin.`
            : "Poistettu.",
      );
    } catch (e) {
      const text = refusalText(e);
      if (text) {
        setRemoving({ account, error: text });
        if (e instanceof Refused && e.code === "account_missing") void load();
      } else {
        setRemoving(undefined);
        setNotice(
          "Poiston tulosta ei saatu. Sivu päivitetään; tarkista tila ennen kuin yrität uudelleen.",
        );
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
      const change = replace
        ? await replaceGiteaToken(sent, replace.id, token)
        : await connectGitea(sent, address, token);
      if (!current(sent)) return;
      const connection = change.connection;
      setGitea((g) =>
        g && connection
          ? {
              ...g,
              stage: { stage: "done", connection, replaced: !!replace },
            }
          : g,
      );
      if (connection && change.api)
        setGiteaChecks((c) => ({ ...c, [connection.id]: "ok" }));
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
    if (!sent || giteaBusy) return;
    setGiteaBusy(true);
    try {
      const change = await giteaAction(sent, intent.kind, intent.connection.id);
      if (!current(sent)) return;
      const api = change.api;
      if (api) setGiteaChecks((c) => ({ ...c, [intent.connection.id]: api }));
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
          ? (giteaActionRefusals[e.code] ??
              "Pyyntöä ei hyväksytty. Mitään ei muutettu.")
          : "Vastausta ei saatu. Sivu päivitetään; tarkista tila ennen kuin yrität uudelleen.",
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
      await giteaAction(sent, "disconnect", target.id);
      if (!current(sent)) return;
      setGiteaRemoving(undefined);
      setNotice(
        "Gitea-tili irrotettu. Kloonatut työtilat jäivät; poista tunnus tarvittaessa myös Giteasta.",
      );
    } catch (e) {
      if (!current(sent)) return;
      if (e instanceof Refused)
        setGiteaRemoving({
          connection: target,
          error:
            giteaActionRefusals[e.code] ??
            "Pyyntöä ei hyväksytty. Mitään ei muutettu.",
        });
      else {
        setGiteaRemoving(undefined);
        setNotice(
          "Irrotuksen tulosta ei saatu. Sivu päivitetään; tarkista tila ennen kuin yrität uudelleen.",
        );
      }
    } finally {
      void load();
    }
  };

  const shows = (id: ProviderId) =>
    (!only || only.includes(id)) && !except?.includes(id);
  if (!list)
    return failed ? (
      <p role="alert">
        Integraatioita ei voitu hakea. Yritä hetken päästä uudelleen.
      </p>
    ) : (
      <p data-testid="integrations-loading" className="ig-wait" role="status">
        <span className="ig-spin" aria-hidden="true" />
        Luetaan integraatioita työkaluilta…
      </p>
    );
  return (
    <>
      {notice ? (
        <p data-testid="integration-removal-result" role="status">
          {notice}
        </p>
      ) : null}
      {failed ? (
        <p role="alert">Tilaa ei voitu tarkistaa. Näytetään edellinen tieto.</p>
      ) : null}
      <IntegrationsOverview
        compact={compact}
        list={
          only || except
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
          onContinue={() => {
            if (flow.provider.login === "app_password")
              setStage({ stage: "password" });
            else void startLogin(flow.provider);
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
          onRestart={() => {
            const v =
              flow.stage.stage === "login" ? flow.stage.view : undefined;
            void startLogin(flow.provider, v?.relogin ? v.address : undefined);
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
