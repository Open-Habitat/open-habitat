import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectDialog,
  type ConnectStage,
  IntegrationsOverview,
  RemoveDialog,
} from "../components/Integrations";
import {
  type Account,
  changePassword,
  connectPasswordAccount,
  controlLogin,
  type IntegrationList,
  type LoginView,
  type PasswordAccount,
  type Provider,
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
  account_exists: "Tämä tili on jo yhdistetty.",
  account_missing: "Tiliä ei enää ole. Sivu päivitetään.",
  provider_unavailable:
    "Tämä integraatio ei ole käytettävissä tällä palvelimella.",
  redirect_invalid:
    "Tämä ei ole se osoite, johon kirjautuminen päättyi. Liitä osoiteriviltä koko osoite.",
  quota_insufficient:
    "Valitut kansiot eivät enää mahdu kotihakemistoosi. Jätä jokin pois.",
  attempt_active:
    "Toinen kirjautuminen on kesken tällä tilillä toisessa selaimessa. Odota, että se päättyy.",
  attempt_not_found: "Kirjautuminen ei ole enää voimassa. Aloita alusta.",
};
const refusalText = (e: unknown) =>
  e instanceof Refused
    ? (refusals[e.code] ?? "Pyyntöä ei hyväksytty. Mitään ei muutettu.")
    : undefined;

/** The states in which the daemon is waiting on the tool or the person. */
const live = (v?: LoginView) =>
  v !== undefined &&
  ["starting", "device_code", "open_url", "completing"].includes(v.state);

type Flow = { provider: Provider; stage: ConnectStage };

/** Asetukset › Integraatiot: reads the catalog and the accounts live from
 * the person's tools through their daemon, and relays sign-ins. */
export function IntegrationsSettings({ csrf }: { csrf?: string }) {
  const [list, setList] = useState<IntegrationList>();
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState<Set<string> | "all">("all");
  const [flow, setFlow] = useState<Flow>();
  const [removing, setRemoving] = useState<{
    account: Account;
    busy?: boolean;
    error?: string;
  }>();
  const [notice, setNotice] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async (only?: Account) => {
    setChecking(only ? new Set([`${only.provider}:${only.address}`]) : "all");
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

  useEffect(() => {
    void load();
    // A sign-in this browser started survives a reload: show it again.
    void readLogin()
      .then((view) => {
        if (!alive.current || (!live(view) && view.state !== "choose_folders"))
          return;
        void readIntegrations().then((l) => {
          const provider = l.providers.find((p) => p.id === view.provider);
          if (alive.current && provider)
            setFlow({ provider, stage: { stage: "login", view } });
        });
      })
      .catch(() => {});
  }, [load]);

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
        ? await changePassword(csrf, relogin, account.password)
        : await connectPasswordAccount(csrf, account);
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

  const loginWrite = async (control: Parameters<typeof controlLogin>[1]) => {
    if (!csrf || flow?.stage.stage !== "login") return;
    const current = flow.stage.view;
    setStage({ stage: "login", view: current, busy: true });
    try {
      const next = await controlLogin(csrf, control);
      setStage({ stage: "login", view: next });
      if (next.state === "completed") void load();
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
      v?.state === "completed";
    setFlow(undefined);
    // Leaving the dialog ends a sign-in still in progress; nothing it had
    // not finished is kept. A cancellation whose answer is lost is said to
    // be uncertain and never sent again on its own.
    if (csrf && v?.attempt_id && (live(v) || v.state === "choose_folders")) {
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

  if (!list)
    return failed ? (
      <p role="alert">
        Integraatioita ei voitu hakea. Yritä hetken päästä uudelleen.
      </p>
    ) : (
      <p className="ig-wait" role="status">
        <span className="ig-spin" aria-hidden="true" />
        Luetaan integraatioita työkaluilta…
      </p>
    );
  return (
    <>
      {notice ? <p role="status">{notice}</p> : null}
      {failed ? (
        <p role="alert">Tilaa ei voitu tarkistaa. Näytetään edellinen tieto.</p>
      ) : null}
      <IntegrationsOverview
        list={list}
        checking={checking}
        onCheck={(a) => void load(a)}
        onConnect={(provider) => {
          setNotice("");
          setFlow({ provider, stage: { stage: "intro" } });
        }}
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
