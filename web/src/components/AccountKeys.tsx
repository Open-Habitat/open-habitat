import { type ReactNode, useEffect, useState } from "react";
import {
  type AccountKey,
  type KeyKind,
  keyDate,
  keyId,
  type MissingKey,
  recipientGroups,
  shortKey,
} from "../app/accountKeys";
import "./AccountKeys.css";
import { liveText } from "../i18n";
import { accountKeysText } from "../text/accountKeys";
import { ControlButton, IconButton } from "./ControlElements";
import { Icon } from "./Icon";
import { Badge } from "./Status";

const txt = liveText(accountKeysText);

const kinds: Record<
  KeyKind,
  {
    title: string;
    short: string;
    mark: "terminal" | "lock";
    give: string;
    create: string;
    makes: ReactNode;
    tool: string;
  }
> = {
  ssh: {
    get title() {
      return txt.sshTitle;
    },
    short: "SSH",
    mark: "terminal",
    get give() {
      return txt.sshGive;
    },
    get create() {
      return txt.sshCreate;
    },
    get makes() {
      return txt.sshMakes(
        <code>~/.ssh/id_ed25519</code>,
        <code>ssh-keygen</code>,
      );
    },
    tool: "ssh-keygen",
  },
  age: {
    get title() {
      return txt.ageTitle;
    },
    short: "age",
    mark: "lock",
    get give() {
      return txt.ageGive;
    },
    get create() {
      return txt.ageCreate;
    },
    get makes() {
      return txt.ageMakes(
        <code>~/.config/sops/age/keys.txt</code>,
        <code>age-keygen</code>,
      );
    },
    tool: "age-keygen",
  },
};

function AdminCheck({ entry }: { entry: AccountKey }) {
  return (
    <div className="ak-admin">
      <h4>{txt.forAdmin}</h4>
      {entry.kind === "ssh" ? (
        <>
          <p>
            {txt.sshCheck(
              <code>ssh-keygen -lf</code>,
              <code className="ak-fp">{entry.fingerprint}</code>,
            )}
          </p>
          <p>{txt.sshChannel}</p>
        </>
      ) : (
        <>
          <p>{txt.ageCheck(<code>.sops.yaml</code>)}</p>
          <p className="ak-groups">{recipientGroups(entry.public_key)}</p>
        </>
      )}
    </div>
  );
}

function Detail({ entry, id }: { entry: AccountKey; id: string }) {
  return (
    <div className="ak-detail" id={id} data-testid="account-key-detail">
      <div className="ak-body">
        <pre className="ak-line" data-testid="account-key-line">
          {entry.public_key}
        </pre>
        {entry.kind === "ssh" && (
          <dl className="ak-facts">
            <dt>{txt.fingerprint}</dt>
            <dd className="ak-fp">{entry.fingerprint}</dd>
            <dt>{txt.algorithm}</dt>
            <dd className="ak-mono">{entry.algorithm}</dd>
            {entry.comment && (
              <>
                <dt>{txt.comment}</dt>
                <dd className="ak-mono">{entry.comment}</dd>
              </>
            )}
          </dl>
        )}
        <p className="ak-note">{kinds[entry.kind].give}</p>
        <p className="ak-note">
          <Icon name="lock" /> {txt.privatePart(<code>{entry.file}</code>)}
        </p>
      </div>
      <AdminCheck entry={entry} />
    </div>
  );
}

/** Settings › Avaimet (direction Taulukko): every public key on the account
 * in one list, a row opening to the whole key and the administrator's
 * check, and a creation row for each missing default key. */
export function AccountKeysTable({
  keys,
  missing,
  unseen,
  created,
  creating,
  notice,
  onCopy,
  onCreate,
  onSeen,
}: {
  keys: AccountKey[];
  missing: MissingKey[];
  /** Keys by `keyId` that appeared without being seen on this page. */
  unseen: ReadonlySet<string>;
  /** Keys by `keyId` this page made during this visit. */
  created: ReadonlySet<string>;
  creating?: KeyKind;
  notice?: string;
  /** Writes the public line to the clipboard; false when the browser refused. */
  onCopy: (entry: AccountKey) => Promise<boolean>;
  onCreate: (kind: KeyKind) => void;
  onSeen: (id: string) => void;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [copied, setCopied] = useState<{ id: string; ok: boolean }>();
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(undefined), 6000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const toggle = (id: string) =>
    setOpen((now) => {
      const next = new Set(now);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const copy = async (entry: AccountKey) => {
    const ok = await onCopy(entry);
    setCopied({ id: keyId(entry), ok });
  };
  return (
    <div className="s-stack ak" data-testid="account-keys">
      <p className="s-intro">
        {txt.intro((text) => (
          <strong>{text}</strong>
        ))}
      </p>
      {notice && (
        <p
          className="ak-notice"
          role="status"
          data-testid="account-keys-notice"
        >
          {notice}
        </p>
      )}
      <div
        className="s-card ak-card"
        data-settings-row="account-keys"
        tabIndex={-1}
      >
        {keys.length > 0 && (
          <div className="ak-head" aria-hidden="true">
            <span>{txt.key}</span>
            <span>{txt.fingerprintChanged}</span>
            <span />
          </div>
        )}
        {keys.length > 0 ? (
          <ul className="ak-list" aria-label={txt.accountKeys}>
            {keys.map((entry) => {
              const id = keyId(entry);
              const expanded = open.has(id);
              const detailId = `account-key-${id.replace(/[^A-Za-z0-9]/g, "")}`;
              const done = copied?.id === id;
              return (
                <li
                  key={id}
                  className="ak-item"
                  data-testid="account-key"
                  data-kind={entry.kind}
                  data-file={entry.file}
                  data-unseen={unseen.has(id) || undefined}
                >
                  <div className="ak-row">
                    <IconButton
                      data-testid="account-key-toggle"
                      size="row"
                      variant="quiet"
                      className="ak-chev"
                      aria-label={txt.toggle(
                        kinds[entry.kind].title,
                        entry.file,
                        expanded,
                      )}
                      aria-expanded={expanded}
                      aria-controls={expanded ? detailId : undefined}
                      onPress={() => toggle(id)}
                    >
                      <Icon name="forward" />
                    </IconButton>
                    <span className="ak-mark">
                      <Icon name={kinds[entry.kind].mark} />
                    </span>
                    <div className="s-lbl ak-name">
                      <strong>
                        {kinds[entry.kind].short}
                        {unseen.has(id) ? (
                          <span data-testid="account-key-unseen-mark">
                            <Badge label={txt.unseenBadge} tone="info" />
                          </span>
                        ) : created.has(id) ? (
                          <Badge label={txt.createdBadge} tone="success" />
                        ) : null}
                      </strong>
                      <span className="ak-path">{entry.file}</span>
                    </div>
                    <span className="ak-meta">
                      <span
                        className="ak-fp ak-short"
                        title={
                          entry.kind === "ssh"
                            ? entry.fingerprint
                            : entry.public_key
                        }
                      >
                        {shortKey(entry)}
                      </span>
                      <span className="ak-when">
                        {keyDate(entry.modified_at)}
                      </span>
                    </span>
                    <span className="ak-act">
                      <ControlButton
                        data-testid="account-key-copy"
                        size="row"
                        variant="secondary"
                        className={done && copied?.ok ? "ak-copied" : ""}
                        onPress={() => void copy(entry)}
                      >
                        <Icon name={done && copied?.ok ? "check" : "copy"} />
                        {done && copied?.ok ? txt.copied : txt.copy}
                      </ControlButton>
                    </span>
                  </div>
                  {done && (
                    <p
                      className={copied?.ok ? "ak-after" : "ak-after ak-bad"}
                      role="status"
                      data-testid="account-key-copied"
                    >
                      {copied?.ok
                        ? entry.kind === "ssh"
                          ? txt.sendSsh
                          : txt.sendAge
                        : txt.copyFailed}
                    </p>
                  )}
                  {unseen.has(id) && (
                    <div className="ak-unseen" data-testid="account-key-unseen">
                      <Icon name="info" />
                      <p>{txt.unseen(keyDate(entry.modified_at))}</p>
                      <ControlButton
                        data-testid="account-key-seen"
                        size="row"
                        variant="secondary"
                        onPress={() => onSeen(id)}
                      >
                        <Icon name="check" />
                        {txt.recognize}
                      </ControlButton>
                    </div>
                  )}
                  {expanded && <Detail entry={entry} id={detailId} />}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="ak-empty">{txt.none}</p>
        )}
        {missing.map((m) => (
          <div
            key={m.kind}
            className="ak-create"
            data-testid="account-key-missing"
            data-kind={m.kind}
          >
            <span className="ak-mark">
              <Icon name={kinds[m.kind].mark} />
            </span>
            <div className="s-lbl">
              <strong>{txt.missing(kinds[m.kind].title)}</strong>
              <span className="s-desc">
                {m.can_create ? (
                  <>
                    {kinds[m.kind].makes} {txt.privateStays}
                  </>
                ) : (
                  txt.noTool(<code>{kinds[m.kind].tool}</code>)
                )}
              </span>
            </div>
            {m.can_create && (
              <ControlButton
                data-testid="account-key-create"
                size="row"
                variant="secondary"
                isPending={creating === m.kind}
                isDisabled={creating !== undefined && creating !== m.kind}
                onPress={() => onCreate(m.kind)}
              >
                <Icon name="plus" />
                {creating === m.kind ? txt.creating : kinds[m.kind].create}
              </ControlButton>
            )}
          </div>
        ))}
      </div>
      {keys.length > 0 && <p className="s-desc">{txt.openHint}</p>}
    </div>
  );
}
