import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import {
  type GiteaAPI,
  type GiteaCheck,
  type GiteaConnection,
  type GiteaPush,
  giteaAddress,
  gitReady,
  host,
  usable,
} from "../app/gitea";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import "./Integrations.css";

// Gitea in Asetukset › Koodipalvelut (ADR 0031). The connect form is the
// approved "Lomake" with its error at the top (connect-riff round 2): the
// error sits under the title, outside the scrolling body, and takes focus;
// https:// is added only on leaving the address field or connecting, and the
// address and token are drawn without programming ligatures. These
// components draw what the app hands them and return intents.

/** Which field a refusal is about; "form" for the connection as a whole. */
export type GiteaField = "server" | "token" | "form";

export type GiteaStage =
  | {
      stage: "form";
      error?: { field: GiteaField; text: string };
      busy?: boolean;
    }
  | {
      stage: "done";
      connection: GiteaConnection;
      replaced?: boolean;
      push?: GiteaPush;
    }
  | { stage: "uncertain" };

const apiText: Record<GiteaAPI, string> = {
  ok: "Tunnus toimii",
  token_rejected: "Gitea hylkäsi tunnuksen",
  insufficient_scope: "Tunnukselta puuttuu lukuoikeus",
  account_mismatch: "Tunnus kuuluu toiselle tilille",
  unreachable: "Palvelin ei vastaa",
  tls_untrusted: "Palvelimen varmennetta ei voitu tarkistaa",
  redirect_refused: "Palvelin ohjasi toiseen osoitteeseen",
  forbidden_destination: "Osoitteeseen ei voi yhdistää",
  not_gitea: "Osoitteesta ei vastannut Gitea",
};

export function giteaAPIText(api: GiteaAPI): string {
  return apiText[api];
}

/** What a read-only token means, wherever the page names one. */
const readOnlyText =
  "Vain luku: tunnukselta puuttuu repojen kirjoitusoikeus (write:repository), joten push ei onnistu. Vaihda tilalle tunnus, jolla se on.";

/** One tea login: a usable PAT connection with its Git readiness, or one
 * the connector shows but does not use. */
export function GiteaCard({
  connection: c,
  check,
  busy,
  onCheck,
  onReplace,
  onRepair,
  onDisconnect,
}: {
  connection: GiteaConnection;
  /** The latest check's answer for this connection. */
  check?: GiteaCheck;
  busy?: boolean;
  onCheck: () => void;
  onReplace: () => void;
  onRepair: () => void;
  onDisconnect: () => void;
}) {
  const ok = usable(c);
  const name = c.user && c.base_url ? `${c.user} · ${host(c.base_url)}` : "";
  return (
    <article
      data-testid="gitea-connection"
      data-connection={c.id}
      data-git={c.git}
      data-push={check?.api === "ok" ? check.push : undefined}
      className="ig-card"
      aria-label={`Gitea · ${name || "tea-kirjautuminen"}`}
    >
      <div className="ig-acc">
        <span className="ig-mark ig-tone-3" aria-hidden="true">
          Gt
        </span>
        <div>
          <span className="ig-rn">Gitea</span>
          <span className="ig-meta ah-mono">{name || "tea-kirjautuminen"}</span>
        </div>
        {ok ? (
          <>
            <ControlButton
              data-testid="gitea-check"
              size="row"
              variant="quiet"
              isDisabled={busy}
              onPress={onCheck}
            >
              <Icon name="refresh" />
              Tarkista
            </ControlButton>
            <ControlButton
              data-testid="gitea-replace"
              size="row"
              variant="quiet"
              isDisabled={busy}
              onPress={onReplace}
            >
              Vaihda tunnus…
            </ControlButton>
            <ControlButton
              data-testid="gitea-disconnect-open"
              size="row"
              variant="quiet"
              isDisabled={busy}
              onPress={onDisconnect}
            >
              Irrota…
            </ControlButton>
          </>
        ) : null}
      </div>
      {!ok ? (
        <p className="ig-notice" role="status" data-testid="gitea-unsupported">
          <Icon name="warning" />
          <span>
            {c.ambiguous
              ? "tea-asetuksissa on tälle tilille kaksi kirjautumista. Kumpaakaan ei käytetä ennen kuin poistat toisen tealla."
              : "Tämä tea-kirjautuminen ei käytä pääsytunnusta, joten Habitat ei käytä sitä. Se toimii edelleen tealla."}
          </span>
        </p>
      ) : (
        <div className="ig-svc" data-testid="gitea-git">
          <span className="ig-ic sm">
            <Icon name="branch" />
          </span>
          <div>
            <span className="ig-rn">Git-repot</span>
            <span className="ig-meta">
              {gitReady(c)
                ? check?.api === "ok" && check.push === "allowed"
                  ? "Kloonaus, haku ja push käyttävät tätä tunnusta. Myös agenttisi voivat käyttää sitä."
                  : "Kloonaus ja haku käyttävät tätä tunnusta. Myös agenttisi voivat käyttää sitä."
                : c.git === "foreign"
                  ? "Git-asetuksissasi on tälle palvelimelle toinen tunnusapuri, joten Habitat ei käytä tunnusta Gitissä."
                  : "Git ei vielä käytä tätä tunnusta. Kloonaus ei onnistu ennen kuin Git-asetus on kunnossa."}
            </span>
            {!gitReady(c) && c.git !== "foreign" ? (
              <ControlButton
                data-testid="gitea-repair"
                size="row"
                variant="secondary"
                isDisabled={busy}
                onPress={onRepair}
              >
                Korjaa Git-asetus
              </ControlButton>
            ) : null}
          </div>
          <div className="ig-sv">
            {check ? (
              <span
                data-testid="gitea-check-result"
                data-api={check.api}
                className={`ig-meta ${check.api === "ok" ? "" : "ig-bad"}`}
              >
                {apiText[check.api]}
              </span>
            ) : null}
          </div>
        </div>
      )}
      {ok && check?.api === "ok" && check.push === "read_only" ? (
        <p className="ig-notice" role="status" data-testid="gitea-push">
          <Icon name="warning" />
          <span>{readOnlyText}</span>
        </p>
      ) : null}
      {ok && check?.api === "ok" && check.push === "unknown" ? (
        <p className="ig-p" data-testid="gitea-push">
          Pushin toimivuutta ei voitu tarkistaa: tililtä ei löytynyt repoa,
          johon se saa pushata, tai Gitea ei vastannut.
        </p>
      ) : null}
    </article>
  );
}

function validAddress(value: string): boolean {
  if (!/^https:\/\//i.test(value) || /[\s\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !!url.hostname &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function GiteaDialog({
  replace,
  stage,
  onSubmit,
  onRepair,
  onClose,
}: {
  /** Replacing the token of this connection; otherwise a new connection. */
  replace?: GiteaConnection;
  stage: GiteaStage;
  /** The address as typed (or the connection's own) and the token. */
  onSubmit: (address: string, token: string) => void;
  onRepair: (connection: GiteaConnection) => void;
  onClose: () => void;
}) {
  const [address, setAddress] = useState("");
  const [token, setToken] = useState("");
  const [reveal, setReveal] = useState(false);
  const [help, setHelp] = useState(false);
  const [local, setLocal] = useState<{ field: GiteaField; text: string }>();
  const heading = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const errorId = useId();
  const busy = stage.stage === "form" && !!stage.busy;
  const error = local ?? (stage.stage === "form" ? stage.error : undefined);
  // The token leaves the form's memory once the write has an answer other
  // than a refusal the person can correct.
  useEffect(() => {
    if (stage.stage !== "form") setToken("");
  }, [stage.stage]);
  useEffect(() => {
    void stage.stage;
    heading.current?.focus();
  }, [stage.stage]);
  useEffect(() => {
    if (error) errorRef.current?.focus({ preventScroll: true });
  }, [error]);
  const submit = () => {
    if (busy) return;
    const normalized = replace ? "" : giteaAddress(address);
    if (!replace) setAddress(normalized);
    if (!replace && !validAddress(normalized)) {
      setLocal({
        field: "server",
        text: "Anna palvelimen HTTPS-osoite, esimerkiksi https://git.example.org.",
      });
      return;
    }
    if (!token.trim()) {
      setLocal({ field: "token", text: "Anna pääsytunnus." });
      return;
    }
    setLocal(undefined);
    onSubmit(replace?.base_url ?? normalized, token.trim());
  };
  const invalid = (field: GiteaField) =>
    error?.field === field
      ? { "aria-invalid": true as const, "aria-describedby": errorId }
      : {};
  const title =
    stage.stage === "done"
      ? stage.replaced
        ? "Tunnus vaihdettu"
        : "Tili yhdistetty"
      : replace
        ? "Vaihda Gitean pääsytunnus"
        : "Yhdistä Gitea";
  let body: ReactNode;
  let foot: ReactNode;
  if (stage.stage === "uncertain") {
    body = (
      <p className="ig-result bad" role="alert" data-testid="gitea-uncertain">
        <Icon name="warning" />
        <span>
          Yhteys palvelimeen katkesi, eikä tiedetä, tallentuiko muutos. Sivu
          lukee tilanteen uudelleen; tarkista se ennen kuin yrität uudelleen.
        </span>
      </p>
    );
    foot = (
      <ControlButton
        data-testid="dialog-close"
        size="page"
        variant="primary"
        onPress={onClose}
      >
        Sulje
      </ControlButton>
    );
  } else if (stage.stage === "done") {
    const c = stage.connection;
    body = (
      <>
        <p
          className="ig-result ok"
          role="status"
          data-testid="gitea-connected"
          data-git={c.git}
        >
          <Icon name="check" />
          <span>
            <b className="ah-mono">{c.user}</b>{" "}
            <span className="ah-mono">{c.base_url && host(c.base_url)}</span>
          </span>
        </p>
        {stage.push === "read_only" ? (
          <p
            className="ig-result bad"
            role="alert"
            data-testid="gitea-push"
            data-push="read_only"
          >
            <Icon name="warning" />
            <span>
              {readOnlyText} Kloonaus ja haku toimivat tälläkin tunnuksella.
            </span>
          </p>
        ) : null}
        {gitReady(c) ? (
          <p className="ig-p">
            Voit nyt valita Giteasta repon uudeksi työtilaksi.
            {stage.push === "allowed"
              ? " Push toimii samalla tunnuksella Gitillä."
              : ""}
          </p>
        ) : (
          <>
            <p className="ig-result bad" role="alert">
              <Icon name="warning" />
              <span>
                Tunnus tallentui, mutta Git ei vielä käytä sitä, joten repoja ei
                voi kloonata ennen kuin Git-asetus on kunnossa.
              </span>
            </p>
            {c.git !== "foreign" ? (
              <div className="ig-row start">
                <ControlButton
                  data-testid="gitea-repair"
                  size="row"
                  variant="secondary"
                  onPress={() => onRepair(c)}
                >
                  Korjaa Git-asetus
                </ControlButton>
              </div>
            ) : null}
          </>
        )}
      </>
    );
    foot = (
      <ControlButton
        data-testid="gitea-done"
        size="page"
        variant="primary"
        onPress={onClose}
      >
        Valmis
      </ControlButton>
    );
  } else {
    body = (
      <form
        className="ig-flow-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {replace ? (
          <p className="ig-p">
            Anna tilin <b className="ah-mono">{replace.user}</b> uusi tunnus
            palvelimelle{" "}
            <span className="ah-mono">
              {replace.base_url && host(replace.base_url)}
            </span>
            . Vanha jää voimaan, jos Gitea ei hyväksy uutta.
          </p>
        ) : (
          <label className="s-field" data-field="server">
            <span>Gitea-palvelimen osoite</span>
            <input
              data-testid="gitea-address"
              className="ah-mono"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://git.example.org"
              value={address}
              readOnly={busy}
              maxLength={2048}
              onChange={(e) => setAddress(e.target.value)}
              onBlur={() => setAddress((v) => giteaAddress(v))}
              {...invalid("server")}
            />
          </label>
        )}
        <label className="s-field" data-field="token">
          <span>Henkilökohtainen pääsytunnus</span>
          <span className="ig-gitea-line">
            <input
              data-testid="gitea-token"
              className="ah-mono"
              type={reveal ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder="Liitä Giteassa luotu tunnus"
              value={token}
              readOnly={busy}
              maxLength={1024}
              onChange={(e) => setToken(e.target.value)}
              {...invalid("token")}
            />
            <ControlButton
              size="row"
              variant="quiet"
              aria-label={reveal ? "Piilota tunnus" : "Näytä tunnus"}
              onPress={() => setReveal((r) => !r)}
            >
              {reveal ? "Piilota" : "Näytä"}
            </ControlButton>
          </span>
        </label>
        <ControlButton
          data-testid="gitea-token-help"
          size="inline"
          variant="quiet"
          aria-expanded={help}
          onPress={() => setHelp((h) => !h)}
        >
          Mistä saan tunnuksen? {help ? "−" : "+"}
        </ControlButton>
        {help ? (
          <div className="ig-p" data-testid="gitea-token-instructions">
            <strong>Giteassa: Asetukset → Sovellukset</strong>
            <p>
              Luo uusi pääsytunnus ja anna sille käyttäjätietojen lukuoikeus ja
              repojen kirjoitusoikeus (<code>read:user</code>,{" "}
              <code>write:repository</code>). Kirjoitusoikeudella sinä ja
              agenttisi voitte pushata Gitillä; suojatut haarat ja tilisi
              oikeudet rajaavat sitä Giteassa kuten ennenkin. Pelkällä
              lukuoikeudella (<code>read:repository</code>) kloonaus ja haku
              toimivat, mutta push ei.
            </p>
            <p>
              Kopioi tunnus tähän. Sen tarkat oikeusvalinnat riippuvat Gitean
              versiosta.
            </p>
          </div>
        ) : null}
        <p className="ig-p" data-testid="gitea-agent-note">
          Myös agenttisi voivat käyttää yhdistämääsi Gitea-tiliä.
        </p>
        <button type="submit" hidden>
          Yhdistä
        </button>
      </form>
    );
    foot = (
      <>
        <ControlButton
          size="page"
          variant="secondary"
          onPress={onClose}
          isDisabled={busy}
        >
          Peruuta
        </ControlButton>
        <ControlButton
          data-testid="gitea-submit"
          size="page"
          variant="primary"
          isDisabled={busy}
          onPress={submit}
        >
          {busy ? "Tarkistetaan…" : replace ? "Vaihda tunnus" : "Yhdistä tili"}
        </ControlButton>
      </>
    );
  }
  return (
    <ModalOverlay
      className="ah-overlay"
      isOpen
      isDismissable={!busy}
      isKeyboardDismissDisabled={busy}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal className="ah-modal ig-dlg ig-gitea-dlg">
        <AriaDialog
          data-testid="gitea-dialog"
          data-stage={stage.stage}
          className="ah-dialog"
          aria-label={title}
        >
          <div className="ig-gitea-head">
            <div className="ig-dh">
              <span className="ig-mark sm ig-tone-3" aria-hidden="true">
                Gt
              </span>
              <Heading slot="title" ref={heading} tabIndex={-1}>
                {title}
              </Heading>
              <ControlButton
                data-testid="dialog-close"
                size="row"
                variant="quiet"
                presentation="icon"
                aria-label="Sulje"
                isDisabled={busy}
                onPress={onClose}
              >
                <Icon name="cross" />
              </ControlButton>
            </div>
            {error && stage.stage === "form" ? (
              <div
                id={errorId}
                ref={errorRef}
                data-testid="gitea-error"
                data-field={error.field}
                className="ig-gitea-error"
                role="alert"
                tabIndex={-1}
              >
                <Icon name="warning" />
                <p>{error.text}</p>
              </div>
            ) : null}
          </div>
          <div className="ig-gitea-body">{body}</div>
          <div className="ig-gitea-foot ig-row">{foot}</div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Disconnect removes the local tea entry only; the token is revoked at
 * Gitea and the clones stay. */
export function GiteaDisconnectDialog({
  connection: c,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  connection: GiteaConnection;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ModalOverlay
      className="ah-overlay"
      isOpen
      isDismissable={!busy}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal className="ah-modal ig-dlg">
        <AriaDialog
          data-testid="gitea-disconnect-dialog"
          role="alertdialog"
          className="ah-dialog"
          aria-label="Irrota Gitea-tili"
        >
          <div className="ig-dh">
            <Heading slot="title">Irrota Gitea-tili</Heading>
          </div>
          <div className="ig-flow">
            <p>
              <b className="ah-mono">{c.user}</b>{" "}
              <span className="ah-mono">{c.base_url && host(c.base_url)}</span>
            </p>
            <p className="ig-p">
              Tunnus poistetaan tea-asetuksistasi tällä palvelimella. Kloonatut
              työtilat jäävät, mutta niiden haku ei enää käytä tätä tunnusta.
              Tunnus ei peruunnu Giteassa: poista se Gitean asetuksista, jos et
              enää tarvitse sitä. Agentti, joka jo ehti saada tunnuksen, voi
              käyttää sitä kunnes poistat sen Giteassa.
            </p>
            {error ? (
              <p className="ig-result bad" role="alert">
                <Icon name="warning" />
                <span>{error}</span>
              </p>
            ) : null}
            <div className="ig-row">
              <ControlButton
                size="page"
                variant="secondary"
                isDisabled={busy}
                onPress={onClose}
              >
                Peruuta
              </ControlButton>
              <ControlButton
                data-testid="gitea-disconnect-confirm"
                size="page"
                variant="primary"
                isDisabled={busy}
                onPress={onConfirm}
              >
                Irrota
              </ControlButton>
            </div>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
