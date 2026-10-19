import { useState } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  TextField,
} from "react-aria-components";
import {
  type BlockerText,
  blockerText,
  bytes,
  conversationsKept,
  deletedAt,
  gitChips,
  onlyHere,
  type Segment,
} from "../app/trashText";
import type {
  DeletionBlocker,
  DeletionCheck,
  DeletionFacts,
  TrashEntry,
} from "../app/workspaceTrash";
import { ControlButton, LinkRow } from "./ControlElements";
import { Icon } from "./Icon";
import { relativeRecapAge } from "./RecapCard";
import "./WorkspaceTrash.css";

// Workspace deletion and the Trash, direction Tallennustila of the
// 2026-10-17 round with Jari's decisions: one confirmation that checks
// first, the Trash under Asetukset › Tallennustila, no "move to Trash anyway"
// for a clean clone, and emptying the Trash behind a confirmation.

export const trashPlace = "Asetukset › Tallennustila";
export const trashHref = "/settings#tallennustila";

function Segments({ parts }: { parts: Segment[] }) {
  return (
    <>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are a fixed sentence.
          <span key={i}>{p}</span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are a fixed sentence.
          <code key={i}>{p.code}</code>
        ),
      )}
    </>
  );
}

function CopyCommand({ command }: { command: string }) {
  const [done, setDone] = useState(false);
  return (
    <span className="ah-trash-cmd">
      <code>{command}</code>
      <ControlButton
        variant="quiet"
        presentation="icon"
        size="row"
        aria-label="Kopioi komento"
        title={done ? "Kopioitu" : "Kopioi komento"}
        isDisabled={!navigator.clipboard}
        onPress={() => {
          void navigator.clipboard.writeText(command).then(() => {
            setDone(true);
            window.setTimeout(() => setDone(false), 1200);
          });
        }}
      >
        <Icon name={done ? "check" : "copy"} />
      </ControlButton>
    </span>
  );
}

export function BlockerList<B extends { agent_id?: string } = DeletionBlocker>({
  blockers,
  conversation,
  describe = blockerText as unknown as (b: B) => BlockerText,
}: {
  blockers: B[];
  conversation?: (
    agentId: string,
  ) => { href: string; title?: string } | undefined;
  /** The sentence for one blocker; the workspace deletion's by default. */
  describe?: (b: B) => BlockerText;
}) {
  return (
    <ul className="ah-trash-blocks">
      {blockers.map((b, i) => {
        const text: BlockerText = describe(b);
        const link = b.agent_id ? conversation?.(b.agent_id) : undefined;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: blockers have no identity of their own; the list is replaced whole.
          <li key={i}>
            <Icon name="warning" />
            <div>
              <span>
                <Segments parts={text.what} />
              </span>
              <span className="ah-trash-how">{text.how}</span>
              {text.command ? <CopyCommand command={text.command} /> : null}
              {link ? (
                <LinkRow href={link.href} kind="inline">
                  {link.title ? `Avaa ${link.title}` : "Avaa keskustelu"}
                </LinkRow>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function Facts({
  items,
  tone,
}: {
  items: string[];
  tone: "warn" | "ok";
}) {
  return (
    <ul className="ah-trash-facts">
      {items.map((t) => (
        <li key={t} className={tone}>
          <Icon name={tone === "ok" ? "check" : "warning"} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function TrashModal({
  label,
  isOpen,
  onClose,
  dismissable = true,
  children,
}: {
  label: string;
  isOpen: boolean;
  onClose: () => void;
  dismissable?: boolean;
  children: React.ReactNode;
}) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className="ah-overlay"
      isDismissable={dismissable}
      isKeyboardDismissDisabled={!dismissable}
    >
      <Modal className="ah-modal ah-trash-modal">
        <AriaDialog className="ah-dialog" aria-label={label}>
          {children}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

export type DeletionView =
  | { state: "checking" }
  | { state: "checked"; check: DeletionCheck; problem?: string }
  | {
      state: "working";
      check: DeletionCheck;
      disposal: "trash" | "permanent";
    }
  | { state: "failed"; problem: string };

/** The one confirmation: it checks first, then shows blocked, Trash or permanent. */
export function WorkspaceDeleteDialog({
  name,
  remote,
  view,
  isOpen,
  onClose,
  onRecheck,
  onConfirm,
  conversation,
  now = Date.now(),
}: {
  name: string;
  /** owner/repo when the origin is on GitHub, for the permanent case. */
  remote?: string;
  view: DeletionView;
  isOpen: boolean;
  onClose: () => void;
  onRecheck: () => void;
  onConfirm: (disposal: "trash" | "permanent") => void;
  conversation?: (
    agentId: string,
  ) => { href: string; title?: string } | undefined;
  now?: number;
}) {
  const working = view.state === "working";
  const label =
    view.state === "checked" || view.state === "working"
      ? view.check.outcome === "blocked"
        ? `Työtilaa ${name} ei voi poistaa nyt`
        : view.check.outcome === "permanent"
          ? `Poistetaanko ${name}?`
          : `Siirretäänkö ${name} roskakoriin?`
      : `Poista ${name}`;
  return (
    <TrashModal
      label={label}
      isOpen={isOpen}
      onClose={onClose}
      dismissable={!working}
    >
      {view.state === "checking" ? (
        <p className="ah-trash-checking" role="status">
          <span className="ah-trash-spin" aria-hidden="true" />
          <span>
            Tarkistetaan, käyttääkö jokin työtilaa <code>{name}</code>…
          </span>
        </p>
      ) : view.state === "failed" ? (
        <>
          <Heading slot="title">
            Työtilaa <code>{name}</code> ei voitu tarkistaa
          </Heading>
          <p role="alert">{view.problem}</p>
          <div className="ah-dialog-actions">
            <ControlButton size="page" variant="secondary" onPress={onClose}>
              Sulje
            </ControlButton>
            <ControlButton size="page" variant="primary" onPress={onRecheck}>
              Tarkista uudelleen
            </ControlButton>
          </div>
        </>
      ) : (
        <DeletionBody
          name={name}
          remote={remote}
          check={view.check}
          problem={view.state === "checked" ? view.problem : undefined}
          working={working ? view.disposal : undefined}
          onClose={onClose}
          onRecheck={onRecheck}
          onConfirm={onConfirm}
          conversation={conversation}
          now={now}
        />
      )}
    </TrashModal>
  );
}

function DeletionBody({
  name,
  remote,
  check,
  problem,
  working,
  onClose,
  onRecheck,
  onConfirm,
  conversation,
  now,
}: {
  name: string;
  remote?: string;
  check: DeletionCheck;
  problem?: string;
  working?: "trash" | "permanent";
  onClose: () => void;
  onRecheck: () => void;
  onConfirm: (disposal: "trash" | "permanent") => void;
  conversation?: (
    agentId: string,
  ) => { href: string; title?: string } | undefined;
  now: number;
}) {
  const facts = check.facts;
  const git = facts.git;
  const conversations = facts.conversations ? (
    <p className="ah-trash-note">
      <Icon name="agent" />
      <span>{conversationsKept(facts.conversations)}</span>
    </p>
  ) : null;
  const alert = problem ? <p role="alert">{problem}</p> : null;
  const recheck = (
    <div className="ah-dialog-actions">
      <ControlButton size="page" variant="secondary" onPress={onClose}>
        Sulje
      </ControlButton>
      <ControlButton size="page" variant="primary" onPress={onRecheck}>
        Tarkista uudelleen
      </ControlButton>
    </div>
  );
  if (check.outcome === "blocked")
    return (
      <>
        <Heading slot="title">
          Työtilaa <code>{name}</code> ei voi poistaa nyt
        </Heading>
        <p>Nämä käyttävät työtilaa. Mitään ei ole siirretty.</p>
        <BlockerList blockers={check.blockers} conversation={conversation} />
        <p className="ah-trash-sub">
          Keskustelut ja Gitin muutokset eivät estä poistoa.
        </p>
        {alert}
        {recheck}
      </>
    );
  if (check.outcome === "permanent" && git) {
    const ignored = git.ignored_paths.slice(0, 4);
    const more = git.ignored - ignored.length;
    return (
      <>
        <Heading slot="title">
          Poistetaanko <code>{name}</code>?
        </Heading>
        <p>
          Kaikki on tallessa etärepossa
          {remote ? (
            <>
              {" "}
              <code>{remote}</code>
            </>
          ) : null}
          , joten työtila poistetaan pysyvästi. Sen saa takaisin kloonaamalla.
        </p>
        <Facts
          tone="ok"
          items={[
            "Ei muutoksia eikä uusia tiedostoja",
            `Kaikki commitit ovat etärepossa${git.fetched_at ? ` (haettu ${relativeRecapAge(git.fetched_at * 1000, now)})` : ""}`,
            "Ei stash-merkintöjä",
          ]}
        />
        <p className="ah-trash-note">
          <Icon name="refresh" />
          <span>
            Etärepo haetaan vielä ennen poistoa. Jos jotain puuttuu, työtila
            menee roskakoriin.
          </span>
        </p>
        {git.ignored ? (
          <p className="ah-trash-note warn">
            <Icon name="warning" />
            <span>
              Gitin ohittamat tiedostot häviävät:{" "}
              {ignored.map((p, i) => (
                <span key={p}>
                  {i ? ", " : ""}
                  <code>{p}</code>
                </span>
              ))}
              {more > 0 ? ` ja ${more} muuta` : ""}.
            </span>
          </p>
        ) : null}
        {conversations}
        {alert}
        {problem ? (
          recheck
        ) : (
          <div className="ah-dialog-actions">
            <ControlButton
              size="page"
              variant="secondary"
              onPress={onClose}
              isDisabled={!!working}
              autoFocus
            >
              Peruuta
            </ControlButton>
            <ControlButton
              size="page"
              variant="danger"
              isPending={working === "permanent"}
              isDisabled={!!working}
              onPress={() => onConfirm("permanent")}
            >
              Poista pysyvästi
            </ControlButton>
          </div>
        )}
      </>
    );
  }
  const only =
    facts.kind === "git"
      ? onlyHere(git)
      : ["Hakemisto ei ole Git-repo, joten sen sisältö on vain täällä."];
  return (
    <>
      <Heading slot="title">
        Siirretäänkö <code>{name}</code> roskakoriin?
      </Heading>
      <p>
        Sen voi palauttaa kohdasta {trashPlace}
        {facts.size_bytes
          ? ` (${facts.size_complete ? "" : "yli "}${bytes(facts.size_bytes)})`
          : ""}
        .
      </p>
      {only.length ? (
        <>
          <p className="ah-trash-lead">
            Roskakoriin eikä suoraan pois, koska tämä on vain täällä:
          </p>
          <Facts tone="warn" items={only} />
        </>
      ) : null}
      {conversations}
      {alert}
      {problem ? (
        recheck
      ) : (
        <div className="ah-dialog-actions">
          <ControlButton
            size="page"
            variant="secondary"
            onPress={onClose}
            isDisabled={!!working}
            autoFocus
          >
            Peruuta
          </ControlButton>
          <ControlButton
            size="page"
            variant="primary"
            isPending={working === "trash"}
            isDisabled={!!working}
            onPress={() => onConfirm("trash")}
          >
            Siirrä roskakoriin
          </ControlButton>
        </div>
      )}
    </>
  );
}

export type TrashRow = TrashEntry & { facts?: DeletionFacts };

const rowName = (e: TrashEntry) => e.name ?? e.entry;

/** Asetukset › Tallennustila: use with the Trash's share, then the Trash itself. */
export function StorageUsage({
  usage,
  limit,
  trash,
}: {
  usage: number;
  limit: number;
  /** Bytes in the Trash; undefined while unknown. */
  trash?: number;
}) {
  const pct = (n: number) =>
    `${limit ? Math.min(100, (100 * n) / limit).toFixed(2) : 0}%`;
  const inTrash = Math.min(trash ?? 0, usage);
  return (
    <div className="ah-trash-usage">
      <span>
        <strong>{bytes(usage)}</strong> / {bytes(limit)}
      </span>
      <span
        className="ah-trash-bar"
        role="img"
        aria-label={`Käytössä ${bytes(usage)} / ${bytes(limit)}${trash !== undefined ? `, roskakorissa ${bytes(inTrash)}` : ""}`}
      >
        <span className="other" style={{ width: pct(usage - inTrash) }} />
        <span className="trash" style={{ width: pct(inTrash) }} />
      </span>
      <ul className="ah-trash-legend">
        <li>
          <span className="ah-trash-swatch other" />
          <span>Työtilat, Pi:n historia ja välimuistit</span>
          <code>{bytes(usage - inTrash)}</code>
        </li>
        {trash !== undefined ? (
          <li>
            <span className="ah-trash-swatch trash" />
            <span>Roskakori</span>
            <code>{bytes(inTrash)}</code>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

export function TrashList({
  rows,
  busy,
  onRestore,
  onPurge,
  now = new Date(),
}: {
  rows: TrashRow[];
  /** Entry being restored or removed. */
  busy?: string;
  onRestore: (row: TrashRow) => void;
  onPurge: (row: TrashRow) => void;
  now?: Date;
}) {
  if (!rows.length)
    return (
      <p className="ah-trash-empty">
        <Icon name="trash" />
        <span>Roskakori on tyhjä.</span>
      </p>
    );
  return (
    <ul className="ah-trash-list" aria-label="Roskakori">
      {rows.map((row) => {
        const name = rowName(row);
        const why =
          row.restore === "name_taken"
            ? `~/src/${name} on jo käytössä. Nimeä tai poista se ensin.`
            : row.restore === "unavailable"
              ? row.kind === "unlabelled"
                ? "Alkuperäistä paikkaa ei tiedetä, joten tämän voi vain poistaa."
                : "Palautusta ei voitu tarkistaa juuri nyt."
              : "";
        const meta = [
          row.deleted_at ? `Poistettu ${deletedAt(row.deleted_at, now)}` : "",
          row.size_bytes !== undefined
            ? `${row.size_complete ? "" : "yli "}${bytes(row.size_bytes)}`
            : "",
          row.conversations
            ? `${row.conversations} ${row.conversations === 1 ? "keskustelu" : "keskustelua"}`
            : "",
        ].filter(Boolean);
        return (
          <li key={row.entry} className="ah-trash-row">
            <span className="ah-trash-icon" aria-hidden="true">
              <Icon name="archive" />
            </span>
            <div className="ah-trash-main">
              <code className="ah-trash-name">{name}</code>
              {meta.length ? (
                <span className="ah-trash-meta">{meta.join(" · ")}</span>
              ) : null}
              {row.facts ? (
                <span className="ah-trash-chips">
                  {(row.facts.git
                    ? gitChips(row.facts.git)
                    : [{ text: "vain täällä", tone: "warn" as const }]
                  ).map((c) => (
                    <span key={c.text} className={`ah-trash-chip ${c.tone}`}>
                      {c.text}
                    </span>
                  ))}
                </span>
              ) : null}
              {why ? <span className="ah-trash-why">{why}</span> : null}
            </div>
            <span className="ah-trash-actions">
              <ControlButton
                variant="secondary"
                size="row"
                isDisabled={row.restore !== "available" || !!busy}
                isPending={busy === row.entry}
                aria-label={`Palauta ${name}`}
                onPress={() => onRestore(row)}
              >
                Palauta
              </ControlButton>
              <ControlButton
                variant="danger-subtle"
                size="row"
                isDisabled={!!busy}
                aria-label={`Poista ${name} pysyvästi…`}
                onPress={() => onPurge(row)}
              >
                Poista pysyvästi…
              </ControlButton>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Permanent deletion of one entry: the person types its name. */
export function TrashPurgeDialog({
  row,
  remote,
  busy,
  problem,
  onConfirm,
  onClose,
}: {
  row?: TrashRow;
  remote?: string;
  busy: boolean;
  problem?: string;
  onConfirm: (typed: string) => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const name = row ? rowName(row) : "";
  const facts = row?.facts;
  const only =
    facts?.kind === "git"
      ? onlyHere(facts.git)
      : facts
        ? ["Hakemisto ei ole Git-repo, joten sen sisältö on vain täällä."]
        : [];
  const size = facts?.size_bytes ?? row?.size_bytes;
  return (
    <TrashModal
      label={`Poistetaanko ${name} pysyvästi?`}
      isOpen={!!row}
      onClose={() => {
        setTyped("");
        onClose();
      }}
      dismissable={!busy}
    >
      <Heading slot="title">
        Poistetaanko <code>{name}</code> pysyvästi?
      </Heading>
      <p>
        Tätä ei voi perua.
        {size ? ` ${bytes(size)} vapautuu.` : ""}
      </p>
      {!facts ? (
        <p className="ah-trash-sub">Luetaan, mitä siinä on…</p>
      ) : only.length ? (
        <>
          <p className="ah-trash-lead">
            Häviää lopullisesti, koska se on vain täällä:
          </p>
          <Facts tone="warn" items={only} />
        </>
      ) : (
        <p className="ah-trash-note">
          <Icon name="check" />
          <span>
            Kaikki on etärepossa
            {remote ? (
              <>
                {" "}
                <code>{remote}</code>
              </>
            ) : null}
            .
          </span>
        </p>
      )}
      {row?.conversations ? (
        <p className="ah-trash-note">
          <Icon name="agent" />
          <span>{conversationsKept(row.conversations)}</span>
        </p>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (typed === name && !busy) onConfirm(typed);
        }}
      >
        <TextField
          className="ah-trash-type"
          value={typed}
          onChange={setTyped}
          autoFocus
        >
          <Label>
            Kirjoita <code>{name}</code> vahvistukseksi
          </Label>
          <Input autoComplete="off" spellCheck={false} />
        </TextField>
        {problem ? <p role="alert">{problem}</p> : null}
        <div className="ah-dialog-actions">
          <ControlButton
            size="page"
            variant="secondary"
            isDisabled={busy}
            onPress={() => {
              setTyped("");
              onClose();
            }}
          >
            Peruuta
          </ControlButton>
          <ControlButton
            size="page"
            type="submit"
            variant="danger"
            isPending={busy}
            isDisabled={typed !== name || busy}
          >
            Poista pysyvästi
          </ControlButton>
        </div>
      </form>
    </TrashModal>
  );
}

/** Emptying removes exactly the entries shown; the host refuses a changed Trash. */
export function TrashEmptyDialog({
  isOpen,
  count,
  size,
  busy,
  problem,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  count: number;
  size?: number;
  busy: boolean;
  problem?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <TrashModal
      label="Tyhjennetäänkö roskakori?"
      isOpen={isOpen}
      onClose={onClose}
      dismissable={!busy}
    >
      <Heading slot="title">Tyhjennetäänkö roskakori?</Heading>
      <p>
        {count === 1 ? "1 työtila" : `${count} työtilaa`} poistetaan pysyvästi
        {size ? `, ja ${bytes(size)} vapautuu` : ""}. Tätä ei voi perua.
      </p>
      {problem ? <p role="alert">{problem}</p> : null}
      <div className="ah-dialog-actions">
        <ControlButton
          size="page"
          variant="secondary"
          isDisabled={busy}
          onPress={onClose}
          autoFocus
        >
          Peruuta
        </ControlButton>
        <ControlButton
          size="page"
          variant="danger"
          isPending={busy}
          isDisabled={busy}
          onPress={onConfirm}
        >
          Tyhjennä roskakori
        </ControlButton>
      </div>
    </TrashModal>
  );
}
