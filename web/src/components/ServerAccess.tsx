import { useRef, useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import {
  type AccessEntry,
  type AccessView,
  accessRefusal,
  type GitHubAccount,
  type LookupResult,
  loginShape,
  normalizeLogin,
} from "../app/serverAccess";
import { ControlButton, Segmented } from "./ControlElements";
import { Icon } from "./Icon";
import { StatusMark } from "./Status";
import "./ServerAccess.css";

// Asetukset › Käyttäjät ja pääsy (proto-admin-server-onboarding round 6, Yksi
// lista): one row per GitHub account whose state is its stage. The broker
// decides; a change shows as waiting until its reply, and as uncertain when
// no definite reply came.

/** A change the browser sent and the host has not settled. login and name
 * come from the lookup, for a row the list does not have yet. */
export type PendingChange = {
  kind: "add" | "restore" | "remove" | "uncertain";
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
  return `${d.getDate()}.${d.getMonth() + 1}.${year ? "" : d.getFullYear()}`;
};

/** Withdrawn, or a deny with no admission behind it: either way the person
 * cannot sign in and the row is no longer an open admission. */
const closed = (e: AccessEntry) =>
  e.state === "withdrawn" || e.state === "denied";
/** A deny on a row that still admits means a withdrawal was not confirmed. */
const unfinished = (e: AccessEntry) => e.denied && !closed(e);

const stage = (e: AccessEntry): Exclude<Filter, "all"> =>
  closed(e) ? "withdrawn" : e.state === "joined" ? "joined" : "allowed";

const who = (r: Row) =>
  r.login_hint ? `@${r.login_hint}` : `GitHub-id ${r.id}`;

function StateMark({ r }: { r: Row }) {
  const id = `access-state-${r.id}`;
  if (r.pending?.kind === "uncertain")
    return <StatusMark data-testid={id} tone="warning" label="Tila epävarma" />;
  if (r.pending)
    return (
      <StatusMark
        data-testid={id}
        tone="info"
        animated="running"
        label={
          r.pending.kind === "remove"
            ? "Poistetaan · odottaa palvelinta"
            : r.pending.kind === "restore"
              ? "Palautetaan · odottaa palvelinta"
              : "Lisätään · odottaa palvelinta"
        }
      />
    );
  if (unfinished(r))
    return <StatusMark data-testid={id} tone="warning" label="Poisto kesken" />;
  if (closed(r))
    return (
      <StatusMark data-testid={id} tone="warning" label="Pääsy poistettu" />
    );
  if (r.state === "allowed")
    return (
      <StatusMark
        data-testid={id}
        tone="neutral"
        label="Ei vielä kirjautunut"
      />
    );
  return (
    <StatusMark
      data-testid={id}
      tone="success"
      label={r.administrator ? "Ylläpitäjä" : "Käyttäjä"}
    />
  );
}

function Facts({ r }: { r: Row }) {
  const items = [];
  if (r.username)
    items.push(
      <span key="u">
        Unix: <code>{r.username}</code>
      </span>,
    );
  if (r.state === "allowed" && r.at)
    items.push(<span key="a">Sallittu {day(r.at)}</span>);
  if (r.last_seen) items.push(<span key="s">Viimeksi {day(r.last_seen)}</span>);
  if (r.state === "withdrawn" && r.at)
    items.push(<span key="w">Poistettu {day(r.at)}</span>);
  return items.length ? <span className="sa-facts">{items}</span> : null;
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
        Päivitä
      </ControlButton>
    );
  if (r.source === "operator")
    return <span className="sa-note">Palvelimen asetuksista</span>;
  if (r.state === "withdrawn")
    return (
      <ControlButton
        data-testid={`access-restore-${r.id}`}
        size="row"
        variant="secondary"
        isDisabled={!!r.pending || locked || addLocked}
        onPress={() => onRestore(r)}
      >
        Palauta pääsy
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
      aria-label={`Poista ${who(r)}`}
      onPress={() => onRemove(r)}
    >
      <Icon name="cross" />
      {r.state === "joined" ? "Poista pääsy" : "Poista"}
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
    };

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
  onAdd: (user: GitHubAccount, restore: boolean) => void;
}) {
  const [raw, setRaw] = useState("");
  const [check, setCheck] = useState<Check>({ kind: "idle" });
  // Each lookup's number; an answer to an older one is dropped.
  const asked = useRef(0);
  const login = normalizeLogin(raw);
  const existing = (id: string) => rows.find((r) => r.id === id);
  const judge = (user: GitHubAccount): Check => {
    const r = existing(user.id);
    if (!r) return { kind: "found", user };
    if (r.pending)
      return { kind: "duplicate", user, text: "Edellinen muutos on kesken." };
    if (r.state === "withdrawn") return { kind: "restore", user };
    if (r.state === "joined")
      return {
        kind: "duplicate",
        user,
        text: r.username
          ? `On jo käyttäjä (Unix: ${r.username}).`
          : "On jo käyttäjä.",
      };
    if (r.state === "allowed")
      return { kind: "duplicate", user, text: "On jo sallittu." };
    return { kind: "duplicate", user, text: "Pääsy on suljettu palvelimella." };
  };
  const submit = async () => {
    if (disabled) return;
    if (check.kind === "found" || check.kind === "restore") {
      onAdd(check.user, check.kind === "restore");
      setRaw("");
      setCheck({ kind: "idle" });
      return;
    }
    if (!loginShape.test(login)) {
      setCheck({
        kind: "invalid",
        text: "Kirjaimia, numeroita ja yksittäisiä yhdysmerkkejä, enintään 39.",
      });
      return;
    }
    const n = ++asked.current;
    setCheck({ kind: "checking" });
    const result = await lookup(login);
    if (n !== asked.current) return;
    setCheck(
      result.kind === "found"
        ? judge(result.user)
        : {
            kind: "problem",
            text:
              result.kind === "refused"
                ? accessRefusal(result.code)
                : "GitHubiin ei saatu yhteyttä.",
          },
    );
  };
  const ready = check.kind === "found" || check.kind === "restore";
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
        <strong>Salli GitHub-tunnus</strong>
        <span className="sa-inline">
          <input
            data-testid="access-login-input"
            value={raw}
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
            placeholder="github-tunnus"
            aria-describedby="access-check"
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
              !login ||
              check.kind === "checking" ||
              check.kind === "duplicate"
            }
          >
            {check.kind === "restore"
              ? "Palauta pääsy"
              : ready
                ? "Salli"
                : "Tarkista"}
          </ControlButton>
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
        ) : check.kind === "checking" ? (
          <span className="sa-muted">Tarkistetaan GitHubista…</span>
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
                @{check.user.login} · GitHub-id {check.user.id}
              </span>
            </span>
            {check.kind === "duplicate" ? (
              <span className="sa-dup">
                <Icon name="info" />
                {check.text}
              </span>
            ) : check.kind === "restore" ? (
              <span className="sa-muted">Palaa samalle Unix-tilille.</span>
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
            {joined ? `Poista ${who(r)} pääsy?` : `Poista ${who(r)}?`}
          </Heading>
          <ul className="sa-consequences">
            <li>
              <Icon name="cross" />
              <span>
                Ei voi enää kirjautua.
                {joined && " Avoimet istunnot päättyvät."}
              </span>
            </li>
            {joined && (
              <li>
                <Icon name="terminal" />
                <span>
                  Unix-tili
                  {r.username && (
                    <>
                      {" "}
                      <code>{r.username}</code>
                    </>
                  )}{" "}
                  ja tiedostot jäävät. Tilin voi poistaa komentorivillä.
                </span>
              </li>
            )}
          </ul>
          <div className="ah-dialog-actions">
            <ControlButton size="page" variant="secondary" onPress={onClose}>
              Peruuta
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
              {joined ? "Poista pääsy" : "Poista"}
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
  onRefresh,
}: {
  view: AccessView;
  pending?: Record<string, PendingChange>;
  /** A definite refusal of the last change, shown on its row. */
  problem?: { id: string; text: string };
  canWrite?: boolean;
  lookup: (login: string) => Promise<LookupResult>;
  onAdd: (user: GitHubAccount, restore: boolean) => void;
  onRemove: (entry: AccessEntry) => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [removing, setRemoving] = useState<Row>();
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
      ? "Lisäys selaimesta on poissa käytöstä palvelimen asetuksissa."
      : undefined;
  return (
    <div className="sa" data-testid="server-access" data-mode={view.mode}>
      {open ? (
        <p className="s-row sa-open" data-testid="access-open">
          <Icon name="info" />
          Pääsy on avoin: kuka tahansa GitHub-käyttäjä voi kirjautua.
        </p>
      ) : (
        <div className="s-row">
          <AddLogin
            rows={rows}
            disabled={!canWrite || !view.runtime_admission}
            reason={addReason}
            lookup={lookup}
            onAdd={onAdd}
          />
        </div>
      )}
      <div className="s-row sa-head">
        <strong>
          Henkilöt <span className="sa-muted">{rows.length}</span>
        </strong>
        <Segmented
          data-testid="access-filter"
          label="Näytä"
          size="row"
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: "Kaikki" },
            { id: "joined", label: `Liittyneet ${count("joined")}` },
            { id: "allowed", label: `Ei kirjautuneet ${count("allowed")}` },
            { id: "withdrawn", label: `Poistetut ${count("withdrawn")}` },
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
          >
            <span className="sa-main">
              <span className="sa-who">
                <span className="sa-login">{who(r)}</span>
                {r.name && <span className="sa-muted">{r.name}</span>}
                <StateMark r={r} />
              </span>
              <Facts r={r} />
              {r.state === "withdrawn" && r.username && !r.pending && (
                <span className="sa-muted">
                  Unix-tili <code>{r.username}</code> jää palvelimelle.
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
              <RowAction
                r={r}
                locked={open || !canWrite}
                addLocked={!view.runtime_admission}
                onRemove={setRemoving}
                onRestore={(x) =>
                  onAdd(
                    { id: x.id, login: x.login_hint ?? "", name: x.name ?? "" },
                    true,
                  )
                }
                onRefresh={onRefresh}
              />
            </span>
          </li>
        ))}
        {!shown.length && <li className="sa-row sa-muted">Ei henkilöitä.</li>}
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
    </div>
  );
}
