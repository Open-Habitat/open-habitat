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
import { liveText } from "../i18n";
import { gitlabText } from "../text/gitlab";

const txt = liveText(gitlabText);

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

const apiText = (api: GitLabAPI): string => txt.api[api];

export function gitlabAPIText(api: GitLabAPI): string {
  return apiText(api);
}

/** What a GitLab card shows about its token, from the latest read. */
export type GitLabTokenView =
  | { state: "loading" }
  | { state: "failed"; api?: GitLabAPI }
  | { state: "ok"; token: GitLabToken };

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
      aria-label={`GitLab · ${name || txt.glabLogin}`}
    >
      <div className="ig-acc">
        <span className="ig-mark ig-tone-2" aria-hidden="true">
          GL
        </span>
        <div>
          <span className="ig-rn">GitLab</span>
          <span className="ig-meta ah-mono">{name || txt.glabLogin}</span>
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
              {txt.check}
            </ControlButton>
            <ControlButton
              data-testid="gitlab-replace"
              size="row"
              variant="quiet"
              isDisabled={busy}
              onPress={onReplace}
            >
              {txt.replace}
            </ControlButton>
            <ControlButton
              data-testid="gitlab-disconnect-open"
              size="row"
              variant="quiet"
              isDisabled={busy}
              onPress={onDisconnect}
            >
              {txt.disconnectOpen}
            </ControlButton>
          </>
        ) : null}
      </div>
      {!ok ? (
        <p className="ig-notice" role="status" data-testid="gitlab-unsupported">
          <Icon name="warning" />
          <span>
            {c.ambiguous
              ? txt.ambiguous
              : c.kind === "keyring"
                ? txt.keyring
                : c.kind === "oauth"
                  ? txt.oauth
                  : c.kind === "insecure"
                    ? txt.insecure
                    : txt.unsupported}
          </span>
        </p>
      ) : (
        <>
          <div className="ig-svc" data-testid="gitlab-git">
            <span className="ig-ic sm">
              <Icon name="branch" />
            </span>
            <div>
              <span className="ig-rn">{txt.repos}</span>
              <span className={`ig-meta${lapsed ? " ig-bad" : ""}`}>
                {lapsed
                  ? txt.lapsed
                  : !gitReady
                    ? c.git === "foreign"
                      ? txt.gitForeign
                      : txt.gitNotYet
                    : txt.push[known?.push ?? "unknown"]}
              </span>
              {!gitReady && c.git !== "foreign" ? (
                <ControlButton
                  data-testid="gitlab-repair"
                  size="row"
                  variant="secondary"
                  isDisabled={busy}
                  onPress={onRepair}
                >
                  {txt.repair}
                </ControlButton>
              ) : null}
            </div>
            <div className="ig-sv">
              {lapsed ? (
                <StatusMark label={txt.broken} kind="error" tone="danger" />
              ) : known?.push === "yes" ? (
                <StatusMark
                  data-testid="gitlab-push"
                  label={txt.pushWorks}
                  kind="success"
                  tone="success"
                />
              ) : known?.push === "no" ? (
                <StatusMark
                  data-testid="gitlab-push"
                  label={txt.readOnly}
                  tone="warning"
                />
              ) : known ? (
                <StatusMark
                  data-testid="gitlab-push"
                  label={txt.pushUnknown}
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
                  {apiText(check)}
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
              <span className="ig-rn">{txt.accessToken}</span>
              <span className="ig-meta">
                {token?.state === "loading" ? (
                  txt.reading
                ) : expired ? (
                  txt.rejected
                ) : token?.state === "failed" || !token ? (
                  txt.noDetails
                ) : !known?.scopes ? (
                  txt.noScopes
                ) : (
                  <>
                    <span className="ah-mono">
                      {known.fine
                        ? txt.fine
                        : known.scopes.join(", ") || txt.noRights}
                    </span>
                    {" · "}
                    {expires
                      ? lapsed
                        ? txt.expiredOn(fiDate(expires))
                        : txt.validUntil(fiDate(expires))
                      : txt.noExpiry}
                  </>
                )}
              </span>
              {soon && expires && !lapsed ? (
                <span className="ig-meta gl-soon">
                  {txt.renewBefore(fiDate(expires))}
                </span>
              ) : null}
              {known?.scopes?.includes("api") ? (
                <span className="ig-meta" data-testid="gitlab-api-note">
                  {txt.apiNote}
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
                  {txt.replace}
                </ControlButton>
              ) : null}
            </div>
            <div className="ig-sv">
              {lapsed ? (
                <StatusMark label={txt.expired} kind="error" tone="danger" />
              ) : soon && left !== undefined ? (
                <StatusMark label={txt.expiresIn(left)} tone="warning" />
              ) : known?.scopes ? (
                <StatusMark label={txt.valid} kind="success" tone="success" />
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
        text: txt.addressHint,
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
        text: txt.taken(server, same.user ?? ""),
      });
      return;
    }
    if (!token.trim()) {
      setLocal({ field: "token", text: txt.tokenMissing });
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
        ? txt.replaced
        : txt.connected
      : replace
        ? txt.replaceTitle
        : txt.connectTitle;
  let body: ReactNode;
  let foot: ReactNode;
  if (stage.stage === "uncertain") {
    body = (
      <p className="ig-result bad" role="alert" data-testid="gitlab-uncertain">
        <Icon name="warning" />
        <span>{txt.uncertain}</span>
      </p>
    );
    foot = (
      <ControlButton
        data-testid="dialog-close"
        size="page"
        variant="primary"
        onPress={onClose}
      >
        {txt.close}
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
          <dd>{txt.pushDone[t?.push ?? "unknown"]}</dd>
          <dt>{txt.token}</dt>
          <dd>
            {t?.expires_at
              ? txt.validUntilCap(fiDate(t.expires_at))
              : t?.scopes
                ? txt.noExpiryCap
                : txt.noValidity}
          </dd>
        </dl>
        {t?.push === "no" ? (
          <p
            className="ig-result bad"
            role="alert"
            data-testid="gitlab-readonly"
          >
            <Icon name="warning" />
            <span>{txt.cannotPush}</span>
          </p>
        ) : null}
        {t?.scopes?.includes("api") ? (
          <p className="ig-p" data-testid="gitlab-api-done">
            {txt.apiDone}
          </p>
        ) : null}
        {c.git === "registered" ? (
          stage.replaced ? null : (
            <p className="ig-p">{txt.projectsListed}</p>
          )
        ) : (
          <>
            <p className="ig-result bad" role="alert">
              <Icon name="warning" />
              <span>{txt.savedNotGit}</span>
            </p>
            {c.git !== "foreign" ? (
              <div className="ig-row start">
                <ControlButton
                  data-testid="gitlab-repair"
                  size="row"
                  variant="secondary"
                  onPress={() => onRepair(c)}
                >
                  {txt.repair}
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
            {txt.newWorkspace}
          </ControlButton>
        )}
        <ControlButton
          data-testid="gitlab-done"
          size="page"
          variant="primary"
          onPress={onClose}
        >
          {txt.done}
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
        {txt.createToken} <Icon name="external" width={13} height={13} />
      </ExternalLink>
    ) : (
      <span className="ig-meta" data-testid="gitlab-token-link-missing">
        {txt.addressFirst}
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
            {txt.replaceFor(
              <b className="ah-mono">{replace.user}</b>,
              <span className="ah-mono">
                {replace.base_url && host(replace.base_url)}
              </span>,
            )}
          </p>
        ) : (
          <label className="s-field" data-field="server">
            <span>{txt.address}</span>
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
          <span>{txt.personalToken}</span>
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
              aria-label={reveal ? txt.hideToken : txt.showToken}
              onPress={() => setReveal((r) => !r)}
            >
              {reveal ? txt.hide : txt.show}
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
          {txt.whereToken(help)}
        </ControlButton>
        {help ? (
          <div className="ig-p" data-testid="gitlab-token-instructions">
            <strong>{txt.inGitLab}</strong>
            <p>
              {txt.prefilled((text) => (
                <code>{text}</code>
              ))}
            </p>
            <p>
              {txt.scopesExplained((text) => (
                <code>{text}</code>
              ))}
            </p>
            <p>{txt.groupTokens}</p>
          </div>
        ) : null}
        <p className="ig-p" data-testid="gitlab-agent-note">
          {txt.agentNote}
        </p>
        <button type="submit" hidden>
          {txt.connect}
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
          {txt.cancel}
        </ControlButton>
        <ControlButton
          data-testid="gitlab-submit"
          size="page"
          variant="primary"
          isDisabled={busy}
          onPress={submit}
        >
          {busy
            ? txt.checking
            : replace
              ? txt.replaceToken
              : txt.connectAccount}
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
                aria-label={txt.close}
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
          aria-label={txt.disconnectTitle}
        >
          <div className="ig-dh">
            <Heading slot="title">{txt.disconnectTitle}</Heading>
          </div>
          <div className="ig-flow">
            <p>
              <b className="ah-mono">{c.user}</b>{" "}
              <span className="ah-mono">{c.base_url && host(c.base_url)}</span>
            </p>
            <p className="ig-p">{txt.disconnectEffect}</p>
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
                {txt.cancel}
              </ControlButton>
              <ControlButton
                data-testid="gitlab-disconnect-confirm"
                size="page"
                variant="primary"
                isDisabled={busy}
                onPress={onConfirm}
              >
                {txt.disconnect}
              </ControlButton>
            </div>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
