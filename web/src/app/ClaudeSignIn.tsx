import Ajv from "ajv/dist/2020.js";
import { useEffect, useRef, useState } from "react";
import schema from "../../../contracts/v1/claude-login.schema.json";
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
const read = async (response: Response): Promise<Login> => {
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
}: {
  csrf?: string;
  onSignedIn?: () => void;
}) {
  const [login, setLogin] = useState<Login>();
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
        await fetch("/api/v1/pi/claude-login", {
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
  return (
    <section aria-label="Claude (Pi)" className="s-row">
      <div className="s-lbl">
        <strong>Claude (Pi)</strong>
        <span className="s-desc">
          Oma Claude-tilaus pi-claude-bridge-laajennuksella. Kirjautuminen
          tallentuu vain Claude Coden omaan hakemistoon (~/.claude).
        </span>
      </div>
      <div className="s-val">
        <p role="status">
          {login?.state === "completed"
            ? "Claude-tilaus on kirjautunut. Mallin käyttöoikeus selviää ensimmäisessä viestissä."
            : login?.state === "unavailable"
              ? "Claude-kirjautuminen ei ole käytettävissä. Tarkista palvelimen runtime ja oman ~/.claude-hakemiston oikeudet."
              : active
                ? "Claude-kirjautuminen kesken."
                : "Claude-kirjautumista ei ole vahvistettu."}
        </p>
        {login?.state === "code" && login.verification_uri ? (
          <>
            <a
              href={login.verification_uri}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
            >
              Avaa Claude-kirjautuminen
            </a>
            {!submitted ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void action("PUT");
                }}
              >
                <label>
                  Clauden palauttama koodi
                  <input
                    type="password"
                    autoComplete="off"
                    value={code}
                    maxLength={2048}
                    onChange={(event) => setCode(event.target.value)}
                  />
                </label>
                <button
                  type="submit"
                  disabled={
                    busy ||
                    !csrf ||
                    !/^[A-Za-z0-9_~.\-#]{8,2048}$/.test(code.trim())
                  }
                >
                  Vahvista Claude-koodi
                </button>
              </form>
            ) : (
              <p>
                Odotetaan Clauden vahvistusta. Koodia ei lähetetä uudelleen.
              </p>
            )}
          </>
        ) : null}
        {active ? (
          <button
            type="button"
            disabled={busy || !csrf}
            onClick={() => void action("DELETE")}
          >
            Keskeytä Claude-kirjautuminen
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || !csrf || !login || login.state === "unavailable"}
            onClick={() => void action("POST")}
          >
            {login?.state === "completed"
              ? "Kirjaudu Claudeen uudelleen"
              : "Kirjaudu Claudeen"}
          </button>
        )}
        {failed ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void action("GET")}
          >
            Tarkista Claude-kirjautuminen
          </button>
        ) : null}
        {failed ? (
          <p role="alert">
            Claude-yhteyden tarkistus epäonnistui. Tarkistetaan tila uudelleen;
            koodia ei toisteta.
          </p>
        ) : null}
      </div>
    </section>
  );
}
