import { type ReactNode, useEffect, useState } from "react";
import {
  GitLabDialog,
  GitLabDisconnectDialog,
  type GitLabField,
  type GitLabStage,
  type GitLabTokenView,
} from "../components/GitLabConnection";
import type { GitLabIntent } from "../components/Integrations";
import { liveText } from "../i18n";
import { gitlabText } from "../text/gitlab";
import {
  connectGitLab,
  type GitLabAPI,
  type GitLabConnection,
  gitlabAction,
  gitlabTokens,
  replaceGitLabToken,
  usableGitLab,
} from "./gitlab";
import { type IntegrationList, Refused } from "./integrations";

const txt = liveText(gitlabText);

// The GitLab part of the integrations page: the connect dialog, the cards'
// actions and what GitLab says about each token now, for the page that
// shows the GitLab tile (Asetukset › Koodipalvelut). Kept beside the page
// rather than in it so the Gitea flow and this one stay readable apart.

/** A refused GitLab write wrote nothing; the field says where to look. */
const refusals = (): Record<string, [GitLabField, string]> => ({
  invalid_address: ["server", txt.addressHint],
  forbidden_destination: ["server", txt.e_forbidden],
  unreachable: ["server", txt.e_unreachable],
  tls_untrusted: ["server", txt.e_tls],
  redirect_refused: ["server", txt.e_redirect],
  not_gitlab: ["server", txt.e_notGitlab],
  invalid_token: ["token", txt.e_token],
  token_rejected: ["token", txt.e_rejected],
  token_expired: ["token", txt.e_expired],
  insufficient_scope: ["token", txt.e_scope],
  account_mismatch: ["token", txt.e_account],
  connection_exists: ["server", txt.e_exists],
  unsupported_entry: ["server", txt.e_insecure],
  native_conflict: ["form", txt.e_ambiguous],
  native_busy: ["form", txt.e_busyGlab],
  write_failed: ["form", txt.e_write],
  connection_changed: ["form", txt.e_changed],
  provider_unavailable: ["form", txt.e_unavailable],
});
const refusal = (code: string): { field: GitLabField; text: string } => {
  const [field, text] = refusals()[code] ?? ["form", txt.e_refused];
  return { field, text };
};
const actionRefusals = (): Record<string, string> => ({
  clone_running: txt.e_cloning,
  helper_conflict: txt.e_foreign,
  connection_changed: txt.e_changed,
  native_busy: txt.e_busy,
  unsupported_entry: txt.e_glabOnly,
});

export type GitLabSettings = {
  /** The overview's GitLab props. */
  overview: {
    onGitLab: (intent: GitLabIntent) => void;
    gitlabChecks: Record<string, GitLabAPI>;
    gitlabTokens: Record<string, GitLabTokenView>;
    gitlabBusy: boolean;
  };
  /** Opens the connect form. */
  connect: () => void;
  /** The dialogs to render beside the overview. */
  dialogs: ReactNode;
};

export function useGitLabSettings({
  csrf,
  list,
  current,
  alive,
  load,
  setNotice,
  onNewWorkspace,
}: {
  csrf?: string;
  /** The catalog the page shows; undefined while it is read. */
  list?: IntegrationList;
  /** The reply still belongs to the session that sent it. */
  current: (sent: string) => boolean;
  alive: { current: boolean };
  load: () => Promise<void> | void;
  setNotice: (text: string) => void;
  onNewWorkspace?: () => void;
}): GitLabSettings {
  const [dialog, setDialog] = useState<{
    replace?: GitLabConnection;
    stage: GitLabStage;
  }>();
  const [checks, setChecks] = useState<Record<string, GitLabAPI>>({});
  const [tokens, setTokens] = useState<Record<string, GitLabTokenView>>({});
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<{
    connection: GitLabConnection;
    busy?: boolean;
    error?: string;
  }>();
  // Another login replaced the session: the previous person's form, with
  // the token typed into it, is not the next person's to see.
  const [shownFor, setShownFor] = useState(csrf);
  if (shownFor !== csrf) {
    setShownFor(csrf);
    if (shownFor) {
      setDialog(undefined);
      setRemoving(undefined);
      setChecks({});
      setTokens({});
      setBusy(false);
    }
  }
  const connections = list?.gitlab?.connections ?? [];
  const usable = connections.filter(usableGitLab);
  const usableKey = usable.map((c) => c.id).join(" ");
  // What GitLab says about each token is read whenever the set of usable
  // connections changes; nothing keeps it beyond the page.
  useEffect(() => {
    if (!usableKey) return;
    const controller = new AbortController();
    const ids = usableKey.split(" ");
    setTokens((old) => {
      const next = { ...old };
      for (const id of ids) next[id] ??= { state: "loading" };
      return next;
    });
    void gitlabTokens(controller.signal)
      .then((states) => {
        if (controller.signal.aborted) return;
        setTokens(() => {
          const next: Record<string, GitLabTokenView> = {};
          for (const id of ids) next[id] = { state: "failed" };
          for (const s of states)
            next[s.connection_id] =
              s.api === "ok" && s.token
                ? { state: "ok", token: s.token }
                : {
                    state: "failed",
                    api: s.api === "native_unavailable" ? undefined : s.api,
                  };
          return next;
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setTokens(() => {
          const next: Record<string, GitLabTokenView> = {};
          for (const id of ids) next[id] = { state: "failed" };
          return next;
        });
      });
    return () => controller.abort();
  }, [usableKey]);

  const submit = async (address: string, token: string) => {
    const sent = csrf;
    const replace = dialog?.replace;
    if (!sent) return;
    setDialog((d) => d && { ...d, stage: { stage: "form", busy: true } });
    try {
      const change = replace
        ? await replaceGitLabToken(sent, replace.id, token)
        : await connectGitLab(sent, address, token);
      if (!current(sent)) return;
      const connection = change.connection;
      setDialog((d) =>
        d && connection
          ? {
              ...d,
              stage: {
                stage: "done",
                connection,
                token: change.token,
                replaced: !!replace,
              },
            }
          : d,
      );
      if (connection && change.api) {
        setChecks((c) => ({ ...c, [connection.id]: "ok" }));
        if (change.token) {
          const t = change.token;
          setTokens((old) => ({
            ...old,
            [connection.id]: { state: "ok", token: t },
          }));
        }
      }
      void load();
    } catch (e) {
      if (!current(sent)) return;
      if (e instanceof Refused) {
        setDialog(
          (d) =>
            d && { ...d, stage: { stage: "form", error: refusal(e.code) } },
        );
        if (e.code === "connection_changed") void load();
      } else {
        // Whether glab's file changed is unknown: read it, never resend.
        setDialog((d) => d && { ...d, stage: { stage: "uncertain" } });
        void load();
      }
    }
  };

  const act = async (intent: GitLabIntent) => {
    setNotice("");
    if (intent.kind === "replace") {
      setDialog({ replace: intent.connection, stage: { stage: "form" } });
      return;
    }
    if (intent.kind === "disconnect") {
      setRemoving({ connection: intent.connection });
      return;
    }
    const sent = csrf;
    if (!sent || busy) return;
    setBusy(true);
    try {
      const change = await gitlabAction(
        sent,
        intent.kind,
        intent.connection.id,
      );
      if (!current(sent)) return;
      const id = intent.connection.id;
      const api = change.api;
      if (api) {
        setChecks((c) => ({ ...c, [id]: api }));
        const t = change.token;
        setTokens((old) => ({
          ...old,
          [id]: t ? { state: "ok", token: t } : { state: "failed", api },
        }));
      }
      if (dialog?.stage.stage === "done" && change.connection) {
        const connection = change.connection;
        setDialog((d) =>
          d && d.stage.stage === "done"
            ? { ...d, stage: { ...d.stage, connection } }
            : d,
        );
      }
    } catch (e) {
      if (!current(sent)) return;
      setNotice(
        e instanceof Refused
          ? (actionRefusals()[e.code] ?? txt.e_refused)
          : txt.e_noReply,
      );
    } finally {
      if (alive.current) setBusy(false);
      void load();
    }
  };

  const confirmRemove = async () => {
    const sent = csrf;
    const target = removing?.connection;
    if (!sent || !target) return;
    setRemoving({ connection: target, busy: true });
    try {
      await gitlabAction(sent, "disconnect", target.id);
      if (!current(sent)) return;
      setRemoving(undefined);
      setNotice(
        `GitLab ${target.base_url?.replace(/^https:\/\//, "") ?? ""} irrotettu. Kloonatut työtilat jäivät; peru tunnus tarvittaessa myös GitLabissa.`,
      );
    } catch (e) {
      if (!current(sent)) return;
      if (e instanceof Refused)
        setRemoving({
          connection: target,
          error: actionRefusals()[e.code] ?? txt.e_refused,
        });
      else {
        setRemoving(undefined);
        setNotice(txt.e_noDisconnectReply);
      }
    } finally {
      void load();
    }
  };

  return {
    overview: {
      onGitLab: (intent) => void act(intent),
      gitlabChecks: checks,
      gitlabTokens: tokens,
      gitlabBusy: busy,
    },
    connect: () => setDialog({ stage: { stage: "form" } }),
    dialogs: (
      <>
        {dialog ? (
          <GitLabDialog
            replace={dialog.replace}
            stage={dialog.stage}
            taken={connections}
            onSubmit={(address, token) => void submit(address, token)}
            onRepair={(connection) => void act({ kind: "repair", connection })}
            onNewWorkspace={
              onNewWorkspace
                ? () => {
                    setDialog(undefined);
                    onNewWorkspace();
                  }
                : undefined
            }
            onClose={() => {
              if (dialog.stage.stage === "form" && dialog.stage.busy) return;
              setDialog(undefined);
            }}
          />
        ) : null}
        {removing ? (
          <GitLabDisconnectDialog
            connection={removing.connection}
            busy={removing.busy}
            error={removing.error}
            onConfirm={() => void confirmRemove()}
            onClose={() => setRemoving(undefined)}
          />
        ) : null}
      </>
    ),
  };
}
