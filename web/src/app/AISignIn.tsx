import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { ControlButton } from "../components/ControlElements";
import {
  PiDeviceSignIn,
  type PiDeviceSignInView,
} from "../components/PiDeviceSignIn";
import { WarningBanner } from "../components/WarningBanner";
import { liveText } from "../i18n";
import { aiSignInText } from "../text/aiSignIn";
import {
  type AIProvider,
  announceSignedIn,
  changes,
  clearWaiting,
  keyProvider,
  SignedIn,
  sendCommand,
  signedInLine,
  signIns,
  waitingFor,
  writeWaiting,
} from "./aiSignIn";
import { ClaudeSignIn } from "./ClaudeSignIn";
import { NotAdmitted, send } from "./conversations";
import { PiCredentials } from "./PiCredentials";
import { usePiModels } from "./PiModels";
import { type Attempt, piAttempt } from "./pi";
import "./AISignIn.css";

const txt = liveText(aiSignInText);

// The sign-in window and the app's side of a refused AI sign-in
// (proto-ai-sign-in-expired; aiSignIn.ts has the state). One window over
// whatever is open, from the warning above a composer or the bell; once the
// provider takes the person back, the messages waiting in this tab's other
// conversations go from here, and an open conversation sends its own.

type Context = {
  /** Providers refusing the person's sign-in now. */
  refused: AIProvider[];
  open: (provider: AIProvider) => void;
};
export const AISignInContext = createContext<Context>({
  refused: [],
  open: () => {},
});
export const useAISignIn = () => useContext(AISignInContext);

/** The conversations open in this tab send their own waiting messages. */
const openHere = new Map<string, number>();
export function useOpenConversation(id?: string) {
  useEffect(() => {
    if (!id) return;
    openHere.set(id, (openHere.get(id) ?? 0) + 1);
    return () => {
      const n = (openHere.get(id) ?? 1) - 1;
      if (n) openHere.set(id, n);
      else openHere.delete(id);
    };
  }, [id]);
}
/** Conversations whose waiting message went from elsewhere after a
 * sign-in: they say so above the field when opened. */
export const wentAfterSignIn = new Map<string, AIProvider>();

export function AISignInProvider({
  identity,
  csrf,
  reported,
  titles,
  onRefresh,
  children,
}: {
  identity: string;
  csrf?: string;
  /** The snapshot's auth.ai_refused. */
  reported?: { provider: AIProvider; since: string }[];
  /** Conversation titles for the window's list of waiting messages. */
  titles: (id: string) => string | undefined;
  onRefresh: () => void;
  children: ReactNode;
}) {
  // A refusal this tab saw ended by its own sign-in: ignored until the host
  // stops reporting it or reports a newer one.
  const [cleared, setCleared] = useState<Map<AIProvider, string>>(new Map());
  const refused = useMemo(
    () =>
      (reported ?? [])
        .filter((r) => cleared.get(r.provider) !== r.since)
        .map((r) => r.provider),
    [reported, cleared],
  );
  const [shown, setShown] = useState<AIProvider>();
  const latest = useRef({ identity, csrf, reported, onRefresh });
  latest.current = { identity, csrf, reported, onRefresh };
  // The host no longer reporting a refusal is the provider back: signed in
  // elsewhere, or answering again.
  const before = useRef<AIProvider[]>([]);
  const ownSignIn = useRef(new Set<AIProvider>());
  // Without a snapshot (signed out, the host unreachable) nothing is known.
  const known = reported !== undefined;
  useEffect(() => {
    if (!known) return;
    for (const p of before.current)
      if (!refused.includes(p) && !ownSignIn.current.delete(p))
        announceSignedIn(p);
    before.current = refused;
  }, [refused, known]);
  // Waiting messages of conversations not open here go from here.
  useEffect(() => {
    const sending = new Set<string>();
    const go = async (provider: AIProvider) => {
      const { identity, csrf } = latest.current;
      if (!csrf) return;
      for (const { id, waiting, draft } of waitingFor(identity, provider)) {
        if (openHere.has(id) || sending.has(id)) continue;
        if (!draft.trim()) {
          clearWaiting(identity, id);
          continue;
        }
        // The send leaves the records an opened view resumes it from, as
        // its own send would (useConversation): a later refusal gives the
        // text back into the field, an unknown outcome is shown as such.
        const key = (kind: string) => `nah:${identity}:${kind}:${id}`;
        if (sessionStorage.getItem(key("last-send"))) continue;
        sending.add(id);
        try {
          const command = await sendCommand(id, waiting, draft);
          sessionStorage.setItem(key("submitted"), draft);
          sessionStorage.setItem(key("last-send"), command);
          sessionStorage.setItem(key("uncertain"), command);
          sessionStorage.removeItem(key("draft"));
          clearWaiting(identity, id);
          try {
            await send(id, draft, command, csrf);
            sessionStorage.setItem(key("answered"), command);
            wentAfterSignIn.set(id, provider);
          } catch (error) {
            if (!(error instanceof NotAdmitted)) continue;
            // Nothing was written (the conversation is busy or gone): the
            // message waits in its field again.
            for (const kind of ["submitted", "last-send", "uncertain"])
              sessionStorage.removeItem(key(kind));
            if (!sessionStorage.getItem(key("draft")))
              sessionStorage.setItem(key("draft"), draft);
            writeWaiting(identity, id, waiting);
          }
        } finally {
          sending.delete(id);
        }
      }
    };
    const heard = (event: Event) => {
      if (event instanceof SignedIn) void go(event.provider);
    };
    signIns.addEventListener("signed-in", heard);
    return () => signIns.removeEventListener("signed-in", heard);
  }, []);
  const done = useCallback((provider: AIProvider) => {
    const since = latest.current.reported?.find(
      (r) => r.provider === provider,
    )?.since;
    if (since) {
      ownSignIn.current.add(provider);
      setCleared((old) => new Map(old).set(provider, since));
    }
    setShown(undefined);
    announceSignedIn(provider);
    latest.current.onRefresh();
  }, []);
  const value = useMemo(() => ({ refused, open: setShown }), [refused]);
  return (
    <AISignInContext.Provider value={value}>
      {children}
      <SignInWindow
        identity={identity}
        csrf={csrf}
        provider={shown}
        titles={titles}
        onClose={() => setShown(undefined)}
        onDone={done}
      />
    </AISignInContext.Provider>
  );
}

/** The warning above the composer: the GitHub warning's shape. */
export function AISignInWarning({
  provider,
  onFix,
}: {
  provider: AIProvider;
  onFix: () => void;
}) {
  const s = txt.services[provider];
  return (
    <WarningBanner
      data-testid="ai-sign-in-warning"
      data-state={provider}
      tone="danger"
      icon="warning"
      title={s.title}
      short={s.short}
      actions={
        <ControlButton
          data-testid="ai-sign-in-fix"
          size="row"
          variant="primary"
          onPress={onFix}
        >
          {s.fix}
        </ControlButton>
      }
    >
      {s.cause}
    </WarningBanner>
  );
}

/** The bell's item. */
export function aiBellItem(provider: AIProvider, onFix: () => void) {
  const s = txt.services[provider];
  return {
    key: `ai-sign-in-${provider}`,
    tone: "danger" as const,
    icon: "warning" as const,
    group: "own" as const,
    short: s.bell,
    title: s.title,
    meta: s.short,
    body: s.cause,
    data: { state: provider },
    actions: [
      {
        testId: "status-ai-fix",
        label: s.fix,
        primary: true,
        onPress: onFix,
      },
    ],
  };
}

function useWaitingList(identity: string, provider?: AIProvider) {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    changes.addEventListener("change", f);
    return () => changes.removeEventListener("change", f);
  }, []);
  return provider
    ? waitingFor(identity, provider).filter((w) => w.draft.trim())
    : [];
}

function SignInWindow({
  identity,
  csrf,
  provider,
  titles,
  onClose,
  onDone,
}: {
  identity: string;
  csrf?: string;
  provider?: AIProvider;
  titles: (id: string) => string | undefined;
  onClose: () => void;
  onDone: (provider: AIProvider) => void;
}) {
  const waiting = useWaitingList(identity, provider);
  const { refresh: refreshModels } = usePiModels();
  const s = provider ? txt.services[provider] : undefined;
  const finish = () => {
    if (!provider) return;
    refreshModels();
    onDone(provider);
  };
  return (
    <ModalOverlay
      className="ah-overlay"
      isOpen={!!provider}
      isDismissable
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal className="ah-modal ah-sign-in-modal">
        <Dialog
          className="ah-dialog"
          data-testid="sign-in-window"
          data-state={provider}
        >
          {provider && s ? (
            <>
              <Heading slot="title">{s.heading}</Heading>
              <div className="ah-sign-in-queue" data-testid="window-waiting">
                <p className="s-desc">
                  {waiting.length
                    ? keyProvider(provider)
                      ? txt.windowListKey
                      : txt.windowList
                    : txt.windowNone}
                </p>
                {waiting.length ? (
                  <ul>
                    {waiting.map((w) => (
                      <li key={w.id} data-conversation={w.id}>
                        <span className="ah-sign-in-queue-title">
                          {titles(w.id) || txt.untitled}
                          {w.draft !== w.waiting.text ? (
                            <span className="ah-sign-in-queue-edited">
                              {" "}
                              · {txt.edited}
                            </span>
                          ) : null}
                        </span>
                        <span className="ah-sign-in-queue-text">{w.draft}</span>
                        <span className="ah-sign-in-queue-fate">
                          {txt.goes}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {provider === "claude-bridge" ? (
                <ClaudeSignIn
                  csrf={csrf}
                  window={{ onCancel: onClose }}
                  onSignedIn={finish}
                />
              ) : provider === "openai-codex" ? (
                <DeviceSignIn csrf={csrf} onDone={finish} onCancel={onClose} />
              ) : (
                <div className="ah-sign-in-window-key">
                  <PiCredentials
                    csrf={csrf}
                    embedded
                    providers={[provider]}
                    onSaved={finish}
                  />
                  <div className="ah-sign-in-window-foot">
                    <span />
                    <ControlButton
                      data-testid="sign-in-cancel"
                      size="row"
                      variant="quiet"
                      onPress={onClose}
                    >
                      {txt.cancel}
                    </ControlButton>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function deviceView(attempt: Attempt): PiDeviceSignInView {
  if (
    attempt.state === "device_code" &&
    attempt.verification_uri &&
    attempt.user_code
  )
    return {
      phase: "pending",
      verificationUri: attempt.verification_uri,
      userCode: attempt.user_code,
    };
  if (attempt.state === "pending") return { phase: "waiting" };
  return { phase: "interrupted" };
}

/** ChatGPT's device sign-in, started at once: the person asked for it by
 * opening the window. Settings' full-page step keeps its own flow. */
function DeviceSignIn({
  csrf,
  onDone,
  onCancel,
}: {
  csrf?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [view, setView] = useState<PiDeviceSignInView>({ phase: "waiting" });
  const finish = useRef(onDone);
  finish.current = onDone;
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    void attempt;
    if (!csrf) return;
    let alive = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = (result: Awaited<ReturnType<typeof piAttempt>>) => {
      if (!alive) return false;
      if (typeof result === "string") {
        setView({ phase: result === "absent" ? "expired" : "interrupted" });
        return false;
      }
      if (result.state === "completed" && result.pi_state === "usable") {
        setView({ phase: "connected" });
        finish.current();
        return false;
      }
      setView(deviceView(result));
      return result.state === "pending" || result.state === "device_code";
    };
    const poll = async () => {
      try {
        if (apply(await piAttempt("GET", csrf, controller.signal)))
          timer = setTimeout(poll, 2000);
      } catch {
        if (alive) timer = setTimeout(poll, 2000);
      }
    };
    void (async () => {
      try {
        if (apply(await piAttempt("POST", csrf, controller.signal)))
          timer = setTimeout(poll, 2000);
      } catch {
        if (alive) setView({ phase: "interrupted" });
      }
    })();
    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [csrf, attempt]);
  return (
    <div className="ah-sign-in-window-device">
      <PiDeviceSignIn
        embedded
        view={view}
        onRetry={() => setAttempt((n) => n + 1)}
        onCancel={() => {
          if (csrf) void piAttempt("DELETE", csrf).catch(() => {});
          onCancel();
        }}
      />
    </div>
  );
}

/** Above the field once the provider took the person back. */
export function AISignedInNotice({
  provider,
  went,
}: {
  provider: AIProvider;
  went: boolean;
}) {
  return (
    <WarningBanner
      data-testid="ai-sign-in-ok"
      data-state={went ? "sent" : "signed-in"}
      tone="success"
    >
      {signedInLine(provider, went)}
    </WarningBanner>
  );
}
