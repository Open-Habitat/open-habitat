# components/ServerAccess.tsx

Generated from web/src/components/ServerAccess.tsx; do not edit.

```tsx
import { useRef, useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import {
  type AccessEntry,
  type AccessView,
  accessRefusal,
  type GitHubAccount,
  type LookupResult,
  loginShape,
  type OnboardingReceipt,
  splitLogins,
} from "../app/serverAccess";
import { ControlButton, Segmented } from "./ControlElements";
import { Icon } from "./Icon";
import { StatusMark } from "./Status";
import "./ServerAccess.css";
import { formatDate, liveText } from "../i18n";
import { serverAccessText } from "../text/serverAccess";

const txt = liveText(serverAccessText);

// Asetukset › Käyttäjät ja pääsy (proto-admin-server-onboarding round 6, Yksi
// lista): one row per GitHub account whose state is its stage. The broker
// decides; a change shows as waiting until its reply, and as uncertain when
// no definite reply came.

/** A change the browser sent and the host has not settled. login and name
 * come from the lookup, for a row the list does not have yet. */
export type PendingChange = {
  kind: "add" | "restore" | "remove" | "grant" | "revoke" | "uncertain";
  login?: string;
  name?: string;
};

type Row = AccessEntry & { pending?: PendingChange; name?: string };
type Filter = "all" | "joined" | "allowed" | "withdrawn";

const day = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear() === new Date().getFullYear();
  return formatDate(d, {
    day: "numeric",
    month: "numeric",
    ...(year ? {} : { year: "numeric" }),
  });
};

/** Withdrawn, a deny with no admission behind it, or a designation whose
 * admission is gone: the person cannot sign in and the row is no longer an
 * open admission. */
const closed = (e: AccessEntry) =>
  e.state === "withdrawn" || e.state === "denied" || e.state === "unlisted";
/** A deny on a row that still admits means a withdrawal was not confirmed. */
const unfinished = (e: AccessEntry) => e.denied && !closed(e);

const stage = (e: AccessEntry): Exclude<Filter, "all"> =>
  closed(e) ? "withdrawn" : e.state === "joined" ? "joined" : "allowed";

/** The person as one phrase, for a dialog or an action's name. */
const who = (r: Row) =>
  r.login_hint ? `@${r.login_hint}` : txt.githubId(r.id);

// The login names the person. The numeric id only tells two rows apart:
// a tooltip on a named row, and a fact beside an unnamed one (a login the
// gateway could not resolve from GitHub just now).
function Who({ r }: { r: Row }) {
  return r.login_hint ? (
    <span
      className="sa-login"
      data-testid={`access-login-${r.id}`}
      title={txt.githubId(r.id)}
    >
      @{r.login_hint}
    </span>
  ) : (
    <span
      className="sa-login"
      data-testid={`access-login-${r.id}`}
      data-unnamed=""
    >
      {txt.noLogin}
    </span>
  );
}

function StateMark({ r }: { r: Row }) {
  const id = `access-state-${r.id}`;
  if (r.pending?.kind === "uncertain")
    return <StatusMark data-testid={id} tone="warning" label={txt.uncertain} />;
  if (r.pending)
    return (
      <StatusMark
        data-testid={id}
        tone="info"
        animated="running"
        label={txt.pending[r.pending.kind]}
      />
    );
  if (unfinished(r))
    return <StatusMark data-testid={id} tone="warning" label={txt.removing} />;
  if (r.state === "unlisted")
    return <StatusMark data-testid={id} tone="warning" label={txt.noAccess} />;
  if (closed(r))
    return <StatusMark data-testid={id} tone="warning" label={txt.removed} />;
  if (r.state === "allowed")
    return (
      <StatusMark
        data-testid={id}
        tone="neutral"
        label={r.administrator_role ? txt.adminFromFirst : txt.notSignedIn}
      />
    );
  return (
    <StatusMark
      data-testid={id}
      tone="success"
      label={r.administrator ? txt.admin : txt.user}
    />
  );
}

function Facts({ r }: { r: Row }) {
  const items = [];
  if (!r.login_hint) items.push(<span key="i">{txt.githubId(r.id)}</span>);
  if (r.username)
    items.push(
      <span key="u">
        {txt.unix} <code>{r.username}</code>
      </span>,
    );
  if (r.state === "allowed" && r.at)
    items.push(<span key="a">{txt.allowedOn(day(r.at))}</span>);
  if (r.last_seen)
    items.push(<span key="s">{txt.lastSeen(day(r.last_seen))}</span>);
  const role = r.administrator_role;
  if (role?.source === "operator")
    items.push(<span key="r">{txt.adminFromServer}</span>);
  else if (role)
    items.push(
      <span key="r">
        {role.state === "pending" ? txt.named : txt.admin}
        {role.at && ` ${day(role.at)}`}
      </span>,
    );
  if (r.state === "withdrawn" && r.at)
    items.push(<span key="w">{txt.removedOn(day(r.at))}</span>);
  return items.length ? <span className="sa-facts">{items}</span> : null;
}

// The sign-in receipt (ADR 0030), short: how many defaults went to the
// person's daemon, and by name only those that did not. A clone was handed
// over, not finished, so the words never say fetched.
const left = (): [
  OnboardingReceipt["defaults"][number]["outcome"],
  string,
][] => [
  ["no_access", txt.left.no_access],
  ["check_failed", txt.left.check_failed],
  ["unknown", txt.left.unknown],
];
const aiKey = new Proxy(
  {} as Partial<Record<OnboardingReceipt["ai_key"], string>>,
  { get: (_target, key: string) => txt.aiKey[key] },
);

function Receipt({ id, r }: { id: string; r: OnboardingReceipt }) {
  const parts = [];
  const total = r.defaults.length;
  if (total) {
    const preselected = r.mode === "preselected";
    const done = r.defaults.filter((d) =>
      preselected
        ? d.outcome === "preselected"
        : d.outcome === "queued" || d.outcome === "already_present",
    ).length;
    parts.push(<span key="n">{txt.defaults(done, total, preselected)}</span>);
  }
  for (const [outcome, words] of left()) {
    const names = r.defaults.filter((d) => d.outcome === outcome);
    if (names.length)
      parts.push(
        <span key={outcome} data-outcome={outcome}>
          {words}:{" "}
          {names.map((d, i) => (
            <span key={d.repository}>
              {i > 0 && ", "}
              <code>{d.repository}</code>
            </span>
          ))}
        </span>,
      );
  }
  const ai = aiKey[r.ai_key];
  if (ai)
    parts.push(
      <span key="ai" data-outcome={`ai_${r.ai_key}`}>
        {ai}
      </span>,
    );
  return (
    <span className="sa-receipt" data-testid={`access-onboarding-${id}`}>
      {txt.onboarding(day(r.at))}
      {parts.length > 0 && ": "}
      {parts.map((p, i) => (
        <span key={p.key}>
          {i > 0 && " · "}
          {p}
        </span>
      ))}
    </span>
  );
}

function RowAction({
  r,
  locked,
  addLocked,
  onRemove,
  onRestore,
  onRefresh,
}: {
  r: Row;
  locked: boolean;
  addLocked: boolean;
  onRemove: (r: Row) => void;
  onRestore: (r: Row) => void;
  onRefresh: () => void;
}) {
  if (r.pending?.kind === "uncertain")
    return (
      <ControlButton
        data-testid={`access-refresh-${r.id}`}
        size="row"
        variant="secondary"
        onPress={onRefresh}
      >
        <Icon name="refresh" />
        {txt.refresh}
      </ControlButton>
    );
  if (r.source === "operator")
    return <span className="sa-note">{txt.fromServer}</span>;
  if (r.state === "withdrawn")
    return (
      <ControlButton
        data-testid={`access-restore-${r.id}`}
        size="row"
        variant="secondary"
        isDisabled={!!r.pending || locked || addLocked}
        onPress={() => onRestore(r)}
      >
        {txt.restore}
      </ControlButton>
    );
  // A deny with no admission row: there is nothing here to remove or restore.
  if (r.source === "none") return null;
  return (
    <ControlButton
      data-testid={`access-remove-${r.id}`}
      size="row"
      variant="quiet"
      isDisabled={!!r.pending || locked}
      aria-label={txt.removeNamed(who(r))}
      onPress={() => onRemove(r)}
    >
      <Icon name="cross" />
      {r.state === "joined" ? txt.removeAccess : txt.remove}
    </ControlButton>
  );
}

// The role control: an administrator names an admitted person, signed in or
// not, and revokes only a role named here. site.json's roles have none.
function RoleAction({
  r,
  locked,
  onGrant,
  onRevoke,
}: {
  r: Row;
  locked: boolean;
  onGrant: (r: Row) => void;
  onRevoke: (r: Row) => void;
}) {
  if (r.pending) return null;
  const role = r.administrator_role;
  if (role?.source === "site_admin")
    return (
      <ControlButton
        data-testid={`access-role-${r.id}`}
        size="row"
        variant="quiet"
        isDisabled={locked}
        aria-label={txt.revokeNamed(who(r))}
        onPress={() => onRevoke(r)}
      >
        {txt.revoke}
      </ControlButton>
    );
  // Naming needs an open admission; revoking only subtracts, so it is
  // offered whatever the row's state.
  if (
    role ||
    r.administrator ||
    r.denied ||
    (r.state !== "allowed" && r.state !== "joined")
  )
    return null;
  return (
    <ControlButton
      data-testid={`access-role-${r.id}`}
      size="row"
      variant="quiet"
      isDisabled={locked}
      aria-label={txt.grantNamed(who(r))}
      onPress={() => onGrant(r)}
    >
      {txt.grant}
    </ControlButton>
  );
}

type Check =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "invalid"; text: string }
  | { kind: "problem"; text: string }
  | {
      kind: "found" | "restore" | "duplicate";
      user: GitHubAccount;
      text?: string;
    }
  | { kind: "batch"; items: BatchItem[]; sending: boolean };

/** What the host settled for one sent addition, in the administrator's words
 * when it was refused. */
export type AddOutcome =
  | { kind: "changed" }
  | { kind: "refused"; text: string }
  | { kind: "uncertain" };

/** One name of a several-name addition and where it stands. */
type BatchItem = { login: string } & (
  | { kind: "checking" | "invalid" }
  | { kind: "problem"; text: string }
  | {
      kind:
        | "found"
        | "restore"
        | "duplicate"
        | "sending"
        | "added"
        | "restored"
        | "refused"
        | "uncertain";
      user: GitHubAccount;
      text?: string;
    }
);

// Each name is looked up and sent on its own, one at a time, so a long
// paste is bounded by what one administrator could reasonably mean.
const maxBatch = 100;

const shapeHint = () => txt.shapeHint;
const lookupProblem = (result: Exclude<LookupResult, { kind: "found" }>) =>
  result.kind === "refused"
    ? accessRefusal(result.code)
    : txt.githubUnreachable;

function BatchLine({ item }: { item: BatchItem }) {
  const user = "user" in item ? item.user : undefined;
  const words = txt.batch;
  const bad =
    item.kind === "invalid" ||
    item.kind === "problem" ||
    item.kind === "refused" ||
    item.kind === "uncertain";
  return (
    <li
      className="sa-batch-item"
      data-testid="access-batch-item"
      data-login={item.login}
      data-kind={item.kind}
    >
      <span>
        <strong>@{user?.login || item.login}</strong>
        {user && (
          <span className="sa-muted">
            {" "}
            {user.name && `${user.name} · `}
            {txt.githubId(user.id)}
          </span>
        )}
      </span>
      <span
        className={
          bad ? "sa-bad" : item.kind === "duplicate" ? "sa-dup" : "sa-muted"
        }
      >
        {bad && <Icon name="warning" />}
        {item.kind === "duplicate" && <Icon name="info" />}
        {("text" in item && item.text) || words[item.kind]}
      </span>
    </li>
  );
}

function AddLogin({
  rows,
  disabled,
  reason,
  lookup,
  onAdd,
}: {
  rows: Row[];
  disabled: boolean;
  reason?: string;
  lookup: (login: string) => Promise<LookupResult>;
  onAdd: (user: GitHubAccount, restore: boolean) => Promise<AddOutcome>;
}) {
  const [raw, setRaw] = useState("");
  const [check, setCheck] = useState<Check>({ kind: "idle" });
  // Each lookup's number; an answer to an older one is dropped.
  const asked = useRef(0);
  const logins = splitLogins(raw);
  const login = logins.length === 1 ? logins[0] : "";
  const existing = (id: string) => rows.find((r) => r.id === id);
  const judge = (user: GitHubAccount): Check => {
    const r = existing(user.id);
    if (!r) return { kind: "found", user };
    if (r.pending)
      return { kind: "duplicate", user, text: txt.previousPending };
    if (r.state === "withdrawn") return { kind: "restore", user };
    if (r.state === "joined")
      return {
        kind: "duplicate",
        user,
        text: r.username ? txt.alreadyUserUnix(r.username) : txt.alreadyUser,
      };
    if (r.state === "allowed")
      return { kind: "duplicate", user, text: txt.alreadyAllowed };
    return { kind: "duplicate", user, text: txt.closedOnServer };
  };
  const batchReady =
    check.kind === "batch" &&
    !check.sending &&
    check.items.every((i) => i.kind !== "checking") &&
    check.items.some((i) => i.kind === "found" || i.kind === "restore");
  // Several names: each is checked on its own with the single-name rules,
  // then every one that can be allowed is sent, one at a time, and its
  // outcome shown beside its name.
  const checkMany = async () => {
    if (logins.length > maxBatch) {
      setCheck({
        kind: "invalid",
        text: txt.maxBatch(maxBatch),
      });
      return;
    }
    const n = ++asked.current;
    const items: BatchItem[] = logins.map((login) =>
      loginShape.test(login)
        ? { login, kind: "checking" }
        : { login, kind: "invalid" },
    );
    setCheck({ kind: "batch", items: [...items], sending: false });
    for (const [i, item] of items.entries()) {
      if (item.kind !== "checking") continue;
      const result = await lookup(item.login);
      if (n !== asked.current) return;
      if (result.kind !== "found")
        items[i] = {
          login: item.login,
          kind: "problem",
          text: lookupProblem(result),
        };
      else {
        const earlier = items.find(
          (x, j) => j < i && "user" in x && x.user.id === result.user.id,
        );
        const judged = judge(result.user);
        items[i] = earlier
          ? {
              login: item.login,
              kind: "duplicate",
              user: result.user,
              text: txt.sameAccount(earlier.login),
            }
          : judged.kind === "found" ||
              judged.kind === "restore" ||
              judged.kind === "duplicate"
            ? { login: item.login, ...judged }
            : items[i];
      }
      setCheck({ kind: "batch", items: [...items], sending: false });
    }
  };
  const sendMany = async (items: BatchItem[]) => {
    const n = ++asked.current;
    const next = [...items];
    setCheck({ kind: "batch", items: [...next], sending: true });
    for (const [i, item] of next.entries()) {
      if (item.kind !== "found" && item.kind !== "restore") continue;
      const restore = item.kind === "restore";
      next[i] = { ...item, kind: "sending" };
      setCheck({ kind: "batch", items: [...next], sending: true });
      const outcome = await onAdd(item.user, restore);
      next[i] =
        outcome.kind === "changed"
          ? { ...item, kind: restore ? "restored" : "added" }
          : outcome.kind === "refused"
            ? { ...item, kind: "refused", text: outcome.text }
            : { ...item, kind: "uncertain" };
      setCheck({ kind: "batch", items: [...next], sending: true });
    }
    if (n !== asked.current) return;
    setRaw("");
    setCheck({ kind: "batch", items: next, sending: false });
  };
  const submit = async () => {
    if (disabled) return;
    if (check.kind === "batch") {
      if (batchReady) await sendMany(check.items);
      return;
    }
    if (check.kind === "found" || check.kind === "restore") {
      void onAdd(check.user, check.kind === "restore");
      setRaw("");
      setCheck({ kind: "idle" });
      return;
    }
    if (logins.length > 1) return checkMany();
    if (!loginShape.test(login)) {
      setCheck({ kind: "invalid", text: shapeHint() });
      return;
    }
    const n = ++asked.current;
    setCheck({ kind: "checking" });
    const result = await lookup(login);
    if (n !== asked.current) return;
    setCheck(
      result.kind === "found"
        ? judge(result.user)
        : { kind: "problem", text: lookupProblem(result) },
    );
  };
  const ready =
    check.kind === "found" || check.kind === "restore" || batchReady;
  const sending = check.kind === "batch" && check.sending;
  const allowable =
    check.kind === "batch"
      ? check.items.filter((i) => i.kind === "found" || i.kind === "restore")
          .length
      : 0;
  return (
    <form
      className="sa-add"
      data-testid="access-add-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label className="sa-field">
        <strong>{txt.allowTitle}</strong>
        <span className="sa-inline">
          <textarea
            data-testid="access-login-input"
            value={raw}
            rows={Math.min(6, Math.max(1, raw.split("\n").length))}
            disabled={disabled || sending}
            autoComplete="off"
            spellCheck={false}
            placeholder={txt.placeholder}
            aria-describedby="access-check access-hint"
            onKeyDown={(e) => {
              // Enter checks and allows as in a one-line field; Shift+Enter
              // starts a new line for another name.
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            onChange={(e) => {
              setRaw(e.target.value);
              asked.current++;
              setCheck({ kind: "idle" });
            }}
          />
          <ControlButton
            data-testid="access-add"
            size="row"
            type="submit"
            variant={ready ? "primary" : "secondary"}
            isDisabled={
              disabled ||
              sending ||
              (check.kind === "batch" ? !batchReady : !logins.length) ||
              check.kind === "checking" ||
              check.kind === "duplicate"
            }
          >
            {check.kind === "restore"
              ? txt.restore
              : check.kind === "batch" && allowable
                ? txt.allowN(allowable)
                : ready
                  ? txt.allow
                  : txt.check}
          </ControlButton>
        </span>
        <span id="access-hint" className="sa-muted">
          {txt.separators}
        </span>
      </label>
      <div
        id="access-check"
        className="sa-check"
        data-testid="access-check"
        data-kind={disabled ? "disabled" : check.kind}
        aria-live="polite"
      >
        {disabled ? (
          reason && <span className="sa-muted">{reason}</span>
        ) : check.kind === "batch" ? (
          <ul className="sa-batch" data-testid="access-batch">
            {check.items.map((item) => (
              <BatchLine key={item.login} item={item} />
            ))}
          </ul>
        ) : check.kind === "checking" ? (
          <span className="sa-muted">{txt.checkingGithub}</span>
        ) : check.kind === "invalid" || check.kind === "problem" ? (
          <span className="sa-bad">
            <Icon name="warning" />
            {check.text}
          </span>
        ) : check.kind === "idle" ? null : (
          <span className="sa-found">
            <span>
              <strong>{check.user.name || `@${check.user.login}`}</strong>{" "}
              <span className="sa-muted">
                @{check.user.login} · {txt.githubId(check.user.id)}
              </span>
            </span>
            {check.kind === "duplicate" ? (
              <span className="sa-dup">
                <Icon name="info" />
                {check.text}
              </span>
            ) : check.kind === "restore" ? (
              <span className="sa-muted">{txt.sameUnix}</span>
            ) : null}
          </span>
        )}
      </div>
    </form>
  );
}

function RemoveDialog({
  r,
  onConfirm,
  onClose,
}: {
  r: Row;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const joined = r.state === "joined";
  return (
    <ModalOverlay
      className="ah-overlay"
      isOpen
      isDismissable
      onOpenChange={(open) => !open && onClose()}
    >
      <Modal className="ah-modal">
        <Dialog
          className="ah-dialog sa-dialog"
          data-testid="access-remove-dialog"
        >
          <Heading slot="title">
            {joined
              ? txt.removeAccessQuestion(who(r))
              : txt.removeQuestion(who(r))}
          </Heading>
          <ul className="sa-consequences">
            <li>
              <Icon name="cross" />
              <span>
                {txt.cannotSignIn}
                {joined && txt.sessionsEnd}
              </span>
            </li>
            {joined && (
              <li>
                <Icon name="terminal" />
                <span>
                  {txt.unixStays(
                    r.username && (
                      <>
                        {" "}
                        <code>{r.username}</code>
                      </>
                    ),
                  )}
                </span>
              </li>
            )}
          </ul>
          <div className="ah-dialog-actions">
            <ControlButton size="page" variant="secondary" onPress={onClose}>
              {txt.cancel}
            </ControlButton>
            <ControlButton
              data-testid="access-remove-confirm"
              size="page"
              variant="danger"
              onPress={() => {
                onConfirm();
                onClose();
              }}
            >
              {joined ? txt.removeAccess : txt.remove}
            </ControlButton>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function GrantDialog({
  r,
  onConfirm,
  onClose,
}: {
  r: Row;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const waiting = r.state === "allowed";
  return (
    <ModalOverlay
      className="ah-overlay"
      isOpen
      isDismissable
      onOpenChange={(open) => !open && onClose()}
    >
      <Modal className="ah-modal">
        <Dialog
          className="ah-dialog sa-dialog"
          data-testid="access-grant-dialog"
        >
          <Heading slot="title">{txt.grantQuestion(who(r))}</Heading>
          <ul className="sa-consequences">
            <li>
              <Icon name="shield" />
              <span>{txt.grantEffect}</span>
            </li>
            {waiting && (
              <li>
                <Icon name="info" />
                <span>{txt.grantWaiting(r.id)}</span>
              </li>
            )}
          </ul>
          <div className="ah-dialog-actions">
            <ControlButton size="page" variant="secondary" onPress={onClose}>
              {txt.cancel}
            </ControlButton>
            <ControlButton
              data-testid="access-grant-confirm"
              size="page"
              variant="primary"
              onPress={() => {
                onConfirm();
                onClose();
              }}
            >
              {txt.grant}
            </ControlButton>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

export function ServerAccess({
  view,
  pending = {},
  problem,
  canWrite = true,
  lookup,
  onAdd,
  onRemove,
  onRole,
  onRefresh,
}: {
  view: AccessView;
  pending?: Record<string, PendingChange>;
  /** A definite refusal of the last change, shown on its row. */
  problem?: { id: string; text: string };
  canWrite?: boolean;
  lookup: (login: string) => Promise<LookupResult>;
  onAdd: (user: GitHubAccount, restore: boolean) => Promise<AddOutcome>;
  onRemove: (entry: AccessEntry) => void;
  /** Designate the person as administrator, or revoke that designation. */
  onRole?: (entry: AccessEntry, administrator: boolean) => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [removing, setRemoving] = useState<Row>();
  const [granting, setGranting] = useState<Row>();
  const open = view.mode === "any";
  const rows: Row[] = view.entries.map((e) => ({
    ...e,
    pending: pending[e.id],
    name: pending[e.id]?.name,
  }));
  // A new id has no row until the broker confirms it; show what was asked.
  for (const [id, p] of Object.entries(pending))
    if (!rows.some((r) => r.id === id) && p.kind !== "remove")
      rows.push({
        id,
        source: "site_admin",
        state: "allowed",
        login_hint: p.login,
        name: p.name,
        administrator: false,
        denied: false,
        pending: p,
      });
  const count = (f: Filter) => rows.filter((r) => stage(r) === f).length;
  // A change in flight stays on screen whatever the filter, so its waiting
  // mark and an uncertain row's Päivitä are never hidden.
  const shown = rows.filter(
    (r) => r.pending || filter === "all" || stage(r) === filter,
  );
  const addReason = open
    ? undefined
    : !view.runtime_admission
      ? txt.addDisabled
      : undefined;
  return (
    <div className="sa" data-testid="server-access" data-mode={view.mode}>
      {open ? (
        <p
          className="s-row sa-open"
          data-testid="access-open"
          data-settings-row="access-add"
          tabIndex={-1}
        >
          <Icon name="info" />
          {txt.open}
        </p>
      ) : (
        <div className="s-row" data-settings-row="access-add" tabIndex={-1}>
          <AddLogin
            rows={rows}
            disabled={!canWrite || !view.runtime_admission}
            reason={addReason}
            lookup={lookup}
            onAdd={onAdd}
          />
        </div>
      )}
      <div
        className="s-row sa-head"
        data-settings-row="access-people"
        tabIndex={-1}
      >
        <strong>
          {txt.people} <span className="sa-muted">{rows.length}</span>
        </strong>
        <Segmented
          data-testid="access-filter"
          label={txt.show}
          size="row"
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: txt.all },
            { id: "joined", label: txt.joined(count("joined")) },
            { id: "allowed", label: txt.allowed(count("allowed")) },
            { id: "withdrawn", label: txt.withdrawn(count("withdrawn")) },
          ]}
        />
      </div>
      <ul className="sa-list" data-testid="access-list">
        {shown.map((r) => (
          <li
            key={r.id}
            className="sa-row"
            data-testid={`access-row-${r.id}`}
            data-state={unfinished(r) ? "unfinished" : stage(r)}
            data-pending={r.pending?.kind}
            data-admin={r.administrator_role?.state}
          >
            <span className="sa-main">
              <span className="sa-who">
                <Who r={r} />
                {r.name && <span className="sa-muted">{r.name}</span>}
                <StateMark r={r} />
              </span>
              <Facts r={r} />
              {r.onboarding && <Receipt id={r.id} r={r.onboarding} />}
              {r.site_key_copy && (
                <span
                  className="sa-receipt"
                  data-testid={`access-ai-given-${r.id}`}
                >
                  {txt.aiGiven(day(r.site_key_copy.at))}
                  {!r.site_key_copy.current && txt.earlierKey}
                </span>
              )}
              {r.state === "withdrawn" && r.username && !r.pending && (
                <span className="sa-muted">
                  {txt.unixRemains(<code>{r.username}</code>)}
                </span>
              )}
              {problem?.id === r.id && !r.pending && (
                <span className="sa-bad" role="alert">
                  <Icon name="warning" />
                  {problem.text}
                </span>
              )}
            </span>
            <span className="sa-act">
              {onRole && (
                <RoleAction
                  r={r}
                  locked={!canWrite}
                  onGrant={setGranting}
                  onRevoke={(x) => onRole(x, false)}
                />
              )}
              <RowAction
                r={r}
                locked={open || !canWrite}
                addLocked={!view.runtime_admission}
                onRemove={setRemoving}
                onRestore={(x) =>
                  void onAdd(
                    { id: x.id, login: x.login_hint ?? "", name: x.name ?? "" },
                    true,
                  )
                }
                onRefresh={onRefresh}
              />
            </span>
          </li>
        ))}
        {!shown.length && <li className="sa-row sa-muted">{txt.nobody}</li>}
      </ul>
      {problem && !rows.some((r) => r.id === problem.id) && (
        <p className="s-row sa-bad" role="alert" data-testid="access-problem">
          <Icon name="warning" />
          {problem.text}
        </p>
      )}
      {removing && (
        <RemoveDialog
          r={removing}
          onConfirm={() => onRemove(removing)}
          onClose={() => setRemoving(undefined)}
        />
      )}
      {granting && onRole && (
        <GrantDialog
          r={granting}
          onConfirm={() => onRole(granting, true)}
          onClose={() => setGranting(undefined)}
        />
      )}
    </div>
  );
}

```
