import Ajv from "ajv/dist/2020.js";
import { useEffect, useRef, useState } from "react";
import schema from "../../../contracts/v1/claude-login.schema.json";
import { ControlButton, ExternalLink } from "../components/ControlElements";
import { LetterMark } from "../components/Integrations";
import { SignInStep, SignInSteps } from "../components/PiDeviceSignIn";
import { StatusMark } from "../components/Status";
import { hostRequest } from "./mutations";
import { modelsLine } from "./PiCredentials";
import { usePiModels } from "./PiModels";

const valid = new Ajv({ strict: false }).compile(schema);
type Login = {
  schema_version: 1;
  state:
    | "missing"
    | "unavailable"
    | "unknown"
    | "pending"
    | "code"
    | "completed";
  attempt_id?: string;
  verification_uri?: string;
};
export const read = async (response: Response): Promise<Login> => {
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw Error("unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw Error("invalid");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "",
    size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw Error("invalid");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  const value: unknown = JSON.parse(text);
  if (!valid(value)) throw Error("invalid");
  return value as Login;
};

export function ClaudeSignIn({
  csrf,
  onSignedIn,
  onboarding = false,
}: {
  csrf?: string;
  /** Stacked inside the onboarding AI step's Claude row, which owns the
   * heading: numbered steps like the ChatGPT sign-in. Settings keeps its row. */
  onboarding?: boolean;
  onSignedIn?: () => void;
}) {
  const [login, setLogin] = useState<Login>();
  const models = modelsLine(usePiModels().data?.models, "claude-bridge");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [failed, setFailed] = useState(false);
  const alive = useRef(false);
  const writing = useRef(false);
  const generation = useRef(0);
  const signedIn = useRef(onSignedIn);
  signedIn.current = onSignedIn;
  const ownAttempt = useRef<string | undefined>(undefined);
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      if (writing.current) {
        timer = setTimeout(check, 1500);
        return;
      }
      const g = generation.current;
      try {
        const result = await read(
          await fetch("/api/v1/pi/claude-login", {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          }),
        );
        if (
          !controller.signal.aborted &&
          alive.current &&
          g === generation.current
        ) {
          setLogin(result);
          setFailed(false);
        }
      } catch {
        if (
          !controller.signal.aborted &&
          alive.current &&
          g === generation.current
        )
          setFailed(true);
      }
      if (
        alive.current &&
        (login?.state === "pending" || login?.state === "code")
      )
        timer = setTimeout(check, 1500);
    };
    void check();
    return () => {
      alive.current = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [login?.state]);
  const action = async (method: "GET" | "POST" | "PUT" | "DELETE") => {
    if ((method !== "GET" && !csrf) || writing.current) return;
    writing.current = true;
    ++generation.current;
    setBusy(true);
    setFailed(false);
    const body =
      method === "POST" || method === "GET"
        ? undefined
        : JSON.stringify({
            attempt_id: login?.attempt_id,
            ...(method === "PUT" ? { code: code.trim() } : {}),
          });
    // Erase the returned code immediately, including on an uncertain outcome.
    setCode("");
    if (method === "PUT") setSubmitted(true);
    if (method === "POST") setSubmitted(false);
    try {
      const next = await read(
        await hostRequest("pi.claude_login", "/api/v1/pi/claude-login", {
          method,
          credentials: "same-origin",
          headers: {
            "X-Agent-Host-CSRF": csrf ?? "",
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body,
        }),
      );
      if (alive.current) {
        if (method === "POST" || method === "PUT")
          ownAttempt.current = next.attempt_id;
        setLogin(next);
      }
    } catch {
      if (alive.current) setFailed(true);
    } finally {
      writing.current = false;
      if (alive.current) setBusy(false);
    }
  };
  useEffect(() => {
    if (
      login?.state === "completed" &&
      login.attempt_id &&
      ownAttempt.current === login.attempt_id
    ) {
      ownAttempt.current = undefined;
      signedIn.current?.();
    }
  }, [login?.state, login?.attempt_id]);
  const active = login?.state === "pending" || login?.state === "code";
  const codeValid = /^[A-Za-z0-9_~.\-#]{8,2048}$/.test(code.trim());
  if (onboarding)
    return (
      <section
        data-testid="claude-sign-in"
        aria-label="Claude-kirjautuminen"
        className="ah-claude-onboarding"
      >
        <div
          role="status"
          data-testid="claude-login-state"
          data-state={login?.state}
        >
          {login?.state === "completed" ? (
            <StatusMark label="Claude-tilaus yhdistetty" tone="success" />
          ) : login?.state === "unavailable" ? (
            <StatusMark
              label="Claude-kirjautuminen ei ole käytettävissä"
              tone="danger"
            />
          ) : login?.state === "pending" ? (
            <StatusMark
              label="Valmistellaan kirjautumista"
              tone="info"
              animated="running"
            />
          ) : null}
        </div>
        {login?.state === "completed" ? (
          <p>Mallin käyttöoikeus selviää ensimmäisessä viestissä.</p>
        ) : login?.state === "unavailable" ? (
          <p>
            Tällä palvelimella ei voi nyt kirjautua Claudeen. Valitse toinen
            tapa tai pyydä ylläpitäjää tarkistamaan palvelin.
          </p>
        ) : null}
        {login?.state === "code" && login.verification_uri ? (
          <SignInSteps>
            <SignInStep number={1} title="Kirjaudu Clauden sivulla">
              <ExternalLink
                data-testid="claude-sign-in-link"
                href={login.verification_uri}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                Avaa Claude-kirjautuminen (uusi välilehti)
              </ExternalLink>
            </SignInStep>
            {!submitted ? (
              <SignInStep number={2} title="Liitä Clauden palauttama koodi">
                <form
                  className="ah-inline-field"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void action("PUT");
                  }}
                >
                  <input
                    type="password"
                    data-testid="claude-code-input"
                    aria-label="Clauden palauttama koodi"
                    autoComplete="off"
                    value={code}
                    maxLength={2048}
                    onChange={(event) => setCode(event.target.value)}
                  />
                  <ControlButton
                    data-testid="claude-code-confirm"
                    size="row"
                    variant="primary"
                    type="submit"
                    isDisabled={busy || !csrf || !codeValid}
                  >
                    Vahvista koodi
                  </ControlButton>
                </form>
              </SignInStep>
            ) : (
              <SignInStep number={2} title="Odota vahvistusta" status>
                <StatusMark
                  label="Odotetaan Clauden vahvistusta"
                  tone="info"
                  animated="running"
                />
                <p>Koodia ei lähetetä uudelleen.</p>
              </SignInStep>
            )}
          </SignInSteps>
        ) : null}
        <div className="ah-sign-in-actions">
          {active ? (
            <ControlButton
              size="row"
              variant="quiet"
              type="button"
              isDisabled={busy || !csrf}
              onPress={() => void action("DELETE")}
            >
              Peruuta kirjautumisyritys
            </ControlButton>
          ) : login?.state !== "unavailable" ? (
            <ControlButton
              size="page"
              variant={login?.state === "completed" ? "secondary" : "primary"}
              type="button"
              isDisabled={busy || !csrf || !login}
              data-testid="claude-sign-in-start"
              onPress={() => void action("POST")}
            >
              {login?.state === "completed"
                ? "Kirjaudu Claudeen uudelleen"
                : "Aloita kirjautuminen"}
            </ControlButton>
          ) : null}
          {failed ? (
            <ControlButton
              size="row"
              type="button"
              isDisabled={busy}
              onPress={() => void action("GET")}
            >
              Tarkista tila
            </ControlButton>
          ) : null}
        </div>
        {failed ? (
          <p role="alert">
            Claude-yhteyden tarkistus epäonnistui. Tarkistetaan tila uudelleen;
            koodia ei toisteta.
          </p>
        ) : null}
        {active ? null : (
          <p className="ah-sign-in-hint">
            Kirjautuminen tehdään Clauden omalla sivulla. Salasanaa ei syötetä
            tänne.
          </p>
        )}
      </section>
    );
  return (
    <section
      data-testid="claude-sign-in"
      aria-label="Claude-tilaus"
      className="s-row s-marked"
      data-settings-row="claude"
      // A return from a Claude sign-in opened in Settings focuses this row.
      tabIndex={-1}
    >
      <LetterMark mark="Cl" tone={2} />
      <div className="s-lbl">
        <strong>Claude-tilaus</strong>
        <span
          className="s-desc"
          role="status"
          data-testid="claude-login-state"
          data-state={login?.state}
        >
          {login?.state === "completed"
            ? `Kirjautunut. ${models ? `${models} ` : ""}Mallin käyttöoikeus selviää ensimmäisessä viestissä.`
            : login?.state === "unavailable"
              ? "Claude-kirjautuminen ei ole käytettävissä. Tarkista palvelimen runtime ja oman ~/.claude-hakemiston oikeudet."
              : active
                ? "Claude-kirjautuminen kesken."
                : "Kirjaudu Claude-tilauksella, niin sen mallit tulevat mallivalitsimeen. Kirjautuminen tallentuu vain omalle käyttäjällesi tällä palvelimella."}
        </span>
      </div>
      <div className="s-val">
        {login?.state === "completed" ? (
          <StatusMark kind="success" tone="success" label="Kirjautunut" />
        ) : login?.state === "unavailable" ? (
          <StatusMark kind="error" tone="danger" label="Ei käytettävissä" />
        ) : null}
        {active ? (
          <ControlButton
            size="row"
            type="button"
            isDisabled={busy || !csrf}
            onPress={() => void action("DELETE")}
          >
            Keskeytä Claude-kirjautuminen
          </ControlButton>
        ) : (
          <ControlButton
            size="row"
            type="button"
            isDisabled={
              busy || !csrf || !login || login.state === "unavailable"
            }
            data-testid="claude-sign-in-start"
            onPress={() => void action("POST")}
          >
            {login?.state === "completed"
              ? "Kirjaudu uudelleen"
              : "Kirjaudu Claudeen"}
          </ControlButton>
        )}
        {failed ? (
          <ControlButton
            size="row"
            type="button"
            isDisabled={busy}
            onPress={() => void action("GET")}
          >
            Tarkista Claude-kirjautuminen
          </ControlButton>
        ) : null}
      </div>
      {login?.state === "code" && login.verification_uri ? (
        <div className="s-editor">
          <p>
            1. Avaa Clauden sivu ja kirjaudu sisään. Salasanaa ei syötetä tänne.
          </p>
          <a
            data-testid="claude-sign-in-link"
            href={login.verification_uri}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            Avaa Claude-kirjautuminen
          </a>
          {!submitted ? (
            <form
              className="s-editor"
              onSubmit={(event) => {
                event.preventDefault();
                void action("PUT");
              }}
            >
              <label className="s-field">
                2. Clauden palauttama koodi
                <input
                  type="password"
                  data-testid="claude-code-input"
                  autoComplete="off"
                  value={code}
                  maxLength={2048}
                  onChange={(event) => setCode(event.target.value)}
                />
              </label>
              <div className="s-actions">
                <ControlButton
                  data-testid="claude-code-confirm"
                  size="row"
                  type="submit"
                  isDisabled={busy || !csrf || !codeValid}
                >
                  Vahvista Claude-koodi
                </ControlButton>
              </div>
            </form>
          ) : (
            <p>Odotetaan Clauden vahvistusta. Koodia ei lähetetä uudelleen.</p>
          )}
        </div>
      ) : null}
      {failed ? (
        <p className="s-editor" role="alert">
          Claude-yhteyden tarkistus epäonnistui. Tarkistetaan tila uudelleen;
          koodia ei toisteta.
        </p>
      ) : null}
    </section>
  );
}
