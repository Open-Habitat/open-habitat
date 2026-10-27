import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { giteaAddress, host } from "../app/gitea";
import {
  daysLeft,
  defaultGitLab,
  expirySoonDays,
  fiDate,
  type GitLabAPI,
  type GitLabConnection,
  type GitLabToken,
  tokenPage,
  usableGitLab,
} from "../app/gitlab";
import { ControlButton, ExternalLink } from "./ControlElements";
import { Icon } from "./Icon";
import { StatusMark } from "./Status";
import "./Integrations.css";

// GitLab in Asetukset › Koodipalvelut, as the proto-gitlab-connect round
// specifies it: the Gitea card's structure with GitLab's facts (whether push
// works and when the token expires, read from GitLab now), and the Gitea
// form with gitlab.com as the starting address and a link to GitLab's own
// token page filled in with the two scopes. These components draw what the
// app hands them and return intents.

export type GitLabField = "server" | "token" | "form";

export type GitLabStage =
  | {
      stage: "form";
      error?: { field: GitLabField; text: string };
      busy?: boolean;
    }
  | {
      stage: "done";
      connection: GitLabConnection;
      token?: GitLabToken;
      replaced?: boolean;
    }
  | { stage: "uncertain" };

const apiText: Record<GitLabAPI, string> = {
  ok: "Tunnus toimii",
  token_rejected: "GitLab hylkäsi tunnuksen",
  token_expired: "Tunnus on vanhentunut",
  insufficient_scope: "Tunnukselta puuttuu read_api",
  account_mismatch: "Tunnus kuuluu toiselle tilille",
  unreachable: "Palvelin ei vastaa",
  tls_untrusted: "Palvelimen varmennetta ei voitu tarkistaa",
  redirect_refused: "Palvelin ohjasi toiseen osoitteeseen",
  forbidden_destination: "Osoitteeseen ei voi yhdistää",
  not_gitlab: "Osoitteesta ei vastannut GitLab",
};

export function gitlabAPIText(api: GitLabAPI): string {
  return apiText[api];
}

/** What a GitLab card shows about its token, from the latest read. */
export type GitLabTokenView =
  | { state: "loading" }
  | { state: "failed"; api?: GitLabAPI }
  | { state: "ok"; token: GitLabToken };

const pushText = {
  yes: "Kloonaus, pull ja push käyttävät tätä tunnusta. Myös agenttisi voivat käyttää sitä.",
  no: "Kloonaus ja pull käyttävät tätä tunnusta. Push ei onnistu: tunnukselta puuttuu write_repository.",
  unknown:
    "Kloonaus ja pull käyttävät tätä tunnusta. GitLab ei kerro, saako tällä tunnuksella pushata; se selviää ensimmäisellä pushilla.",
};

/** One of glab's host logins: a usable token connection with its Git
 * readiness and what GitLab says about its token, or one the connector
 * shows but does not use. */
export function GitLabCard({
  connection: c,
  token,
  check,
  busy,
  now,
  onCheck,
  onReplace,
  onRepair,
  onDisconnect,
}: {
  connection: GitLabConnection;
  token?: GitLabTokenView;
  /** The latest explicit check's answer for this connection. */
  check?: GitLabAPI;
  busy?: boolean;
  now: number;
  onCheck: () => void;
  onReplace: () => void;
  onRepair: () => void;
  onDisconnect: () => void;
}) {
  const ok = usableGitLab(c);
  const server = c.base_url ? host(c.base_url) : "";
  const name = c.user && server ? `${c.user} · ${server}` : "";
  const expired =
    check === "token_expired" ||
    (token?.state === "failed" && token.api === "token_expired");
  const known = token?.state === "ok" ? token.token : undefined;
  const expires = known?.expires_at ?? undefined;
  const left = expires ? daysLeft(expires, now) : undefined;
  const soon = !expired && left !== undefined && left <= expirySoonDays;
  const lapsed = expired || (left !== undefined && left <= 0);
  const gitReady = c.git === "registered";
  return (
    <article
      data-testid="gitlab-connection"
      data-connection={c.id}
      data-git={c.git}
      data-state={lapsed ? "expired" : "ok"}
      data-push={known?.push}
      className="ig-card"
      aria-label={`GitLab · ${name || "glab-kirjautuminen"}`}
    >
      <div className="ig-acc">
        <span className="ig-mark ig-tone-2" aria-hidden="true">
          GL
        </span>
        <div>
          <span className="ig-rn">GitLab</span>
          <span className="ig-meta ah-mono">
            {name || "glab-kirjautuminen"}
          </span>
        </div>
        {ok ? (
          <>
            <ControlButton
              data-testid="gitlab-check"
              size="row"
              variant="quiet"
              isDisabled={busy}
              onPress={onCheck}
            >
              <Icon name="refresh" />
              Tarkista
            </ControlButton>
            <ControlButton
              data-testid="gitlab-replace"
              size="row"
              variant="quiet"
              isDisabled={busy}
              onPress={onReplace}
            >
              Vaihda tunnus…
            </ControlButton>
            <ControlButton
              data-testid="gitlab-disconnect-open"
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
        <p className="ig-notice" role="status" data-testid="gitlab-unsupported">
          <Icon name="warning" />
          <span>
            {c.ambiguous
              ? "glab-asetuksissa on tälle palvelimelle kaksi merkintää. Kumpaakaan ei käytetä ennen kuin poistat toisen."
              : c.kind === "keyring"
                ? "glab säilyttää tämän palvelimen tunnuksen käyttöjärjestelmän avainnipussa, jota Habitat ei lue. Se toimii edelleen glabilla."
                : c.kind === "oauth"
                  ? "Tämä glab-kirjautuminen on tehty selaimella (OAuth), joten Habitat ei käytä sitä. Se toimii edelleen glabilla."
                  : c.kind === "insecure"
                    ? "glab on asetettu ohittamaan tämän palvelimen varmenteen tarkistus tai käyttämään välityspalvelinta, joten Habitat ei käytä tätä kirjautumista."
                    : "Habitat ei osaa käyttää tätä glab-kirjautumista. Se toimii edelleen glabilla."}
          </span>
        </p>
      ) : (
        <>
          <div className="ig-svc" data-testid="gitlab-git">
            <span className="ig-ic sm">
              <Icon name="branch" />
            </span>
            <div>
              <span className="ig-rn">Git-repot</span>
              <span className={`ig-meta${lapsed ? " ig-bad" : ""}`}>
                {lapsed
                  ? "GitLab ei enää hyväksy tunnusta, joten pull ja push eivät onnistu ennen kuin vaihdat sen. Paikallinen työ jatkuu."
                  : !gitReady
                    ? c.git === "foreign"
                      ? "Git-asetuksissasi on tälle palvelimelle toinen tunnusapuri, joten Habitat ei käytä tunnusta Gitissä."
                      : "Git ei vielä käytä tätä tunnusta. Kloonaus ei onnistu ennen kuin Git-asetus on kunnossa."
                    : pushText[known?.push ?? "unknown"]}
              </span>
              {!gitReady && c.git !== "foreign" ? (
                <ControlButton
                  data-testid="gitlab-repair"
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
              {lapsed ? (
                <StatusMark label="Ei toimi" kind="error" tone="danger" />
              ) : known?.push === "yes" ? (
                <StatusMark
                  data-testid="gitlab-push"
                  label="Push toimii"
                  kind="success"
                  tone="success"
                />
              ) : known?.push === "no" ? (
                <StatusMark
                  data-testid="gitlab-push"
                  label="Vain luku"
                  tone="warning"
                />
              ) : known ? (
                <StatusMark
                  data-testid="gitlab-push"
                  label="Push ei tiedossa"
                  kind="unknown"
                  tone="warning"
                />
              ) : null}
              {check ? (
                <span
                  data-testid="gitlab-check-result"
                  data-api={check}
                  className={`ig-meta ${check === "ok" ? "" : "ig-bad"}`}
                >
                  {apiText[check]}
                </span>
              ) : null}
            </div>
          </div>
          <div
            className="ig-svc"
            data-testid="gitlab-token"
            data-soon={soon ? "" : undefined}
          >
            <span className="ig-ic sm">
              <Icon name="key" />
            </span>
            <div>
              <span className="ig-rn">Pääsytunnus</span>
              <span className="ig-meta">
                {token?.state === "loading" ? (
                  "Luetaan GitLabista…"
                ) : expired ? (
                  "GitLab ei enää hyväksy tunnusta."
                ) : token?.state === "failed" || !token ? (
                  "Tunnuksen tietoja ei saatu juuri nyt."
                ) : !known?.scopes ? (
                  "GitLab ei kerro tämän tunnuksen oikeuksia eikä voimassaoloa."
                ) : (
                  <>
                    <span className="ah-mono">
                      {known.fine
                        ? "Hienojakoinen tunnus"
                        : known.scopes.join(", ") || "ei oikeuksia"}
                    </span>
                    {" · "}
                    {expires
                      ? lapsed
                        ? `vanheni ${fiDate(expires)}`
                        : `voimassa ${fiDate(expires)} asti`
                      : "ei vanhenemispäivää"}
                  </>
                )}
              </span>
              {soon && expires && !lapsed ? (
                <span className="ig-meta gl-soon">
                  Luo GitLabissa uusi tunnus ja vaihda se tähän ennen{" "}
                  {fiDate(expires)}, niin kloonit eivät lakkaa toimimasta.
                </span>
              ) : null}
              {known?.scopes?.includes("api") ? (
                <span className="ig-meta" data-testid="gitlab-api-note">
                  Tunnuksella on api-oikeus: agenttisi voivat glabilla myös
                  muuttaa GitLabissa merge requesteja, issueita ja asetuksia
                  sinun nimissäsi.
                </span>
              ) : null}
              {soon || lapsed ? (
                <ControlButton
                  data-testid="gitlab-renew"
                  size="row"
                  variant="secondary"
                  isDisabled={busy}
                  onPress={onReplace}
                >
                  Vaihda tunnus…
                </ControlButton>
              ) : null}
            </div>
            <div className="ig-sv">
              {lapsed ? (
                <StatusMark label="Vanhentunut" kind="error" tone="danger" />
              ) : soon && left !== undefined ? (
                <StatusMark
                  label={`Vanhenee ${left} pv:n päästä`}
                  tone="warning"
                />
              ) : known?.scopes ? (
                <StatusMark label="Voimassa" kind="success" tone="success" />
              ) : null}
            </div>
          </div>
        </>
      )}
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

const pushDone = {
  yes: "Toimii",
  no: "Ei toimi: tunnukselta puuttuu write_repository",
  unknown: "Ei tiedossa: selviää ensimmäisellä pushilla",
};

export function GitLabDialog({
  replace,
  stage,
  taken = [],
  onSubmit,
  onRepair,
  onNewWorkspace,
  onClose,
}: {
  /** Replacing the token of this connection; otherwise a new connection. */
  replace?: GitLabConnection;
  stage: GitLabStage;
  /** The connections glab holds: one account per server. */
  taken?: GitLabConnection[];
  /** The address as typed (or the connection's own) and the token. */
  onSubmit: (address: string, token: string) => void;
  onRepair: (connection: GitLabConnection) => void;
  onNewWorkspace?: () => void;
  onClose: () => void;
}) {
  const [address, setAddress] = useState(defaultGitLab);
  const [token, setToken] = useState("");
  const [reveal, setReveal] = useState(false);
  const [help, setHelp] = useState(false);
  const [local, setLocal] = useState<{ field: GitLabField; text: string }>();
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
  const base = replace?.base_url ?? giteaAddress(address).replace(/\/$/, "");
  const submit = () => {
    if (busy) return;
    if (!replace) setAddress(base);
    if (!replace && !validAddress(base)) {
      setLocal({
        field: "server",
        text: "Anna GitLabin HTTPS-osoite, esimerkiksi https://gitlab.com tai https://gitlab.yritys.fi.",
      });
      return;
    }
    const server = host(base).split("/")[0].toLowerCase();
    const same =
      !replace &&
      taken.find(
        (c) => c.base_url && host(c.base_url).split("/")[0] === server,
      );
    if (same) {
      setLocal({
        field: "server",
        text: `Palvelimella ${server} on jo yhdistetty tili ${same.user ?? ""}. glab pitää yhden tilin palvelinta kohden: vaihda sen tunnus tai irrota se ensin.`,
      });
      return;
    }
    if (!token.trim()) {
      setLocal({ field: "token", text: "Anna pääsytunnus." });
      return;
    }
    setLocal(undefined);
    onSubmit(base, token.trim());
  };
  const invalid = (field: GitLabField) =>
    error?.field === field
      ? { "aria-invalid": true as const, "aria-describedby": errorId }
      : {};
  const title =
    stage.stage === "done"
      ? stage.replaced
        ? "Tunnus vaihdettu"
        : "Tili yhdistetty"
      : replace
        ? "Vaihda GitLabin pääsytunnus"
        : "Yhdistä GitLab";
  let body: ReactNode;
  let foot: ReactNode;
  if (stage.stage === "uncertain") {
    body = (
      <p className="ig-result bad" role="alert" data-testid="gitlab-uncertain">
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
    const t = stage.token;
    body = (
      <>
        <p
          className="ig-result ok"
          role="status"
          data-testid="gitlab-connected"
          data-git={c.git}
          data-push={t?.push}
        >
          <Icon name="check" />
          <span>
            <b className="ah-mono">{c.user}</b>{" "}
            <span className="ah-mono">{c.base_url && host(c.base_url)}</span>
          </span>
        </p>
        <dl className="gl-done" data-testid="gitlab-done-facts">
          <dt>Push</dt>
          <dd>{pushDone[t?.push ?? "unknown"]}</dd>
          <dt>Tunnus</dt>
          <dd>
            {t?.expires_at
              ? `Voimassa ${fiDate(t.expires_at)} asti`
              : t?.scopes
                ? "Ei vanhenemispäivää"
                : "GitLab ei kertonut voimassaoloa"}
          </dd>
        </dl>
        {t?.push === "no" ? (
          <p
            className="ig-result bad"
            role="alert"
            data-testid="gitlab-readonly"
          >
            <Icon name="warning" />
            <span>
              Voit kloonata ja hakea muutoksia, mutta agentit eivät voi pushata.
              Jos haluat pushata, luo tunnus oikeuksilla read_api ja
              write_repository ja vaihda se.
            </span>
          </p>
        ) : null}
        {t?.scopes?.includes("api") ? (
          <p className="ig-p" data-testid="gitlab-api-done">
            Tunnuksella on api-oikeus. Se toimii, mutta antaa agenteillesi
            oikeuden muuttaa GitLabissa kaikkea, mitä sinä voit. Suppeampi
            tunnus riittää kloonaukseen ja pushiin.
          </p>
        ) : null}
        {c.git === "registered" ? (
          stage.replaced ? null : (
            <p className="ig-p">
              GitLabin projektit näkyvät nyt Uusi työtila -sivun listassa.
            </p>
          )
        ) : (
          <>
            <p className="ig-result bad" role="alert">
              <Icon name="warning" />
              <span>
                Tunnus tallentui, mutta Git ei vielä käytä sitä, joten
                projekteja ei voi kloonata ennen kuin Git-asetus on kunnossa.
              </span>
            </p>
            {c.git !== "foreign" ? (
              <div className="ig-row start">
                <ControlButton
                  data-testid="gitlab-repair"
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
      <>
        {stage.replaced || !onNewWorkspace ? null : (
          <ControlButton
            data-testid="gitlab-to-new"
            size="page"
            variant="secondary"
            onPress={onNewWorkspace}
          >
            Uusi työtila…
          </ControlButton>
        )}
        <ControlButton
          data-testid="gitlab-done"
          size="page"
          variant="primary"
          onPress={onClose}
        >
          Valmis
        </ControlButton>
      </>
    );
  } else {
    const link = validAddress(base) ? (
      <ExternalLink
        data-testid="gitlab-token-link"
        href={tokenPage(base)}
        target="_blank"
        rel="noreferrer"
      >
        Luo tunnus GitLabissa <Icon name="external" width={13} height={13} />
      </ExternalLink>
    ) : (
      <span className="ig-meta" data-testid="gitlab-token-link-missing">
        Anna ensin osoite, niin linkki avaa sen GitLabin tunnussivun.
      </span>
    );
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
            . Vanha jää voimaan, jos GitLab ei hyväksy uutta.
          </p>
        ) : (
          <label className="s-field" data-field="server">
            <span>GitLab-palvelimen osoite</span>
            <input
              data-testid="gitlab-address"
              className="ah-mono"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder={defaultGitLab}
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
              data-testid="gitlab-token-input"
              className="ah-mono"
              type={reveal ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder="glpat-…"
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
        <p className="gl-link">{link}</p>
        <ControlButton
          data-testid="gitlab-token-help"
          size="inline"
          variant="quiet"
          aria-expanded={help}
          onPress={() => setHelp((h) => !h)}
        >
          Mistä saan tunnuksen? {help ? "−" : "+"}
        </ControlButton>
        {help ? (
          <div className="ig-p" data-testid="gitlab-token-instructions">
            <strong>GitLabissa: Edit profile → Access tokens</strong>
            <p>
              Linkki avaa sivun valmiiksi täytettynä: nimi Open Habitat ja
              oikeudet <code>read_api</code> ja <code>write_repository</code>.
              Valitse vanhenemispäivä (GitLab sallii yleensä enintään vuoden) ja
              luo tunnus.
            </p>
            <p>
              <code>read_api</code> näyttää projektisi,{" "}
              <code>write_repository</code> sallii kloonauksen ja pushin. Myös{" "}
              <code>api</code> kelpaa, mutta sillä agentit voivat muuttaa
              GitLabissa kaikkea, mitä sinä voit.
            </p>
            <p>
              Ryhmän tai projektin tunnus ja hienojakoinen tunnus käyvät samaan
              kenttään.
            </p>
          </div>
        ) : null}
        <p className="ig-p" data-testid="gitlab-agent-note">
          Myös agenttisi voivat käyttää yhdistämääsi GitLab-tiliä.
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
          data-testid="gitlab-submit"
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
          data-testid="gitlab-dialog"
          data-stage={stage.stage}
          className="ah-dialog"
          aria-label={title}
        >
          <div className="ig-gitea-head">
            <div className="ig-dh">
              <span className="ig-mark sm ig-tone-2" aria-hidden="true">
                GL
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
                data-testid="gitlab-error"
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

/** Disconnect logs glab's entry out; the token is revoked at GitLab and
 * the clones stay. */
export function GitLabDisconnectDialog({
  connection: c,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  connection: GitLabConnection;
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
          data-testid="gitlab-disconnect-dialog"
          role="alertdialog"
          className="ah-dialog"
          aria-label="Irrota GitLab-tili"
        >
          <div className="ig-dh">
            <Heading slot="title">Irrota GitLab-tili</Heading>
          </div>
          <div className="ig-flow">
            <p>
              <b className="ah-mono">{c.user}</b>{" "}
              <span className="ah-mono">{c.base_url && host(c.base_url)}</span>
            </p>
            <p className="ig-p">
              Tunnus poistetaan glab-asetuksistasi tällä palvelimella. Kloonatut
              työtilat jäävät, mutta niiden pull ja push eivät enää käytä tätä
              tunnusta. Tunnus ei peruunnu GitLabissa: peru se GitLabin Access
              tokens -sivulla, jos et enää tarvitse sitä. Agentti, joka jo ehti
              saada tunnuksen, voi käyttää sitä, kunnes perut sen.
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
                data-testid="gitlab-disconnect-confirm"
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
