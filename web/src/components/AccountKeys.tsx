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
import { ControlButton, IconButton } from "./ControlElements";
import { Icon } from "./Icon";
import { Badge } from "./Status";

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
    title: "SSH-avain",
    short: "SSH",
    mark: "terminal",
    give: "Anna tämä rivi ylläpitäjälle, kun tarvitset pääsyn organisaation palvelimille. Rivi on avaimen julkinen osa, ja sen saa jakaa.",
    create: "Luo SSH-avain",
    makes: (
      <>
        Tekee tiedoston <code>~/.ssh/id_ed25519</code> (ed25519) komennolla{" "}
        <code>ssh-keygen</code>.
      </>
    ),
    tool: "ssh-keygen",
  },
  age: {
    title: "age-avain (SOPS)",
    short: "age",
    mark: "lock",
    give: "Anna tämä ylläpitäjälle, kun hänen pitää lisätä tili salaisuuksien vastaanottajaksi. Sen jälkeen agenttisi voi avata ne salaisuudet, joihin sinulla on oikeus.",
    create: "Luo age-avain",
    makes: (
      <>
        Tekee tiedoston <code>~/.config/sops/age/keys.txt</code> komennolla{" "}
        <code>age-keygen</code>. SOPS löytää sen ilman lisäasetuksia.
      </>
    ),
    tool: "age-keygen",
  },
};

function AdminCheck({ entry }: { entry: AccountKey }) {
  return (
    <div className="ak-admin">
      <h4>Ylläpitäjälle</h4>
      {entry.kind === "ssh" ? (
        <>
          <p>
            Kun hän on saanut rivin, <code>ssh-keygen -lf</code> näyttää sille
            sormenjäljen <code className="ak-fp">{entry.fingerprint}</code>. Sen
            pitää olla sama kuin tässä.
          </p>
          <p>
            Lue sormenjälki hänelle eri kanavaa pitkin kuin lähetit avaimen,
            esimerkiksi puhelimessa.
          </p>
        </>
      ) : (
        <>
          <p>
            age-avaimella ei ole erillistä sormenjälkeä. Ylläpitäjä vertaa
            tiedostoon <code>.sops.yaml</code> lisäämäänsä riviä tähän, neljän
            merkin ryhmissä:
          </p>
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
            <dt>Sormenjälki</dt>
            <dd className="ak-fp">{entry.fingerprint}</dd>
            <dt>Laji</dt>
            <dd className="ak-mono">{entry.algorithm}</dd>
            {entry.comment && (
              <>
                <dt>Kommentti</dt>
                <dd className="ak-mono">{entry.comment}</dd>
              </>
            )}
          </dl>
        )}
        <p className="ak-note">{kinds[entry.kind].give}</p>
        <p className="ak-note">
          <Icon name="lock" /> Yksityinen osa on tilillä tiedostossa{" "}
          <code>{entry.file}</code>. Sitä ei näytetä eikä ladata, eikä se lähde
          tililtä.
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
        Tämän tilin julkiset avaimet. Organisaatiosi ylläpitäjä tarvitsee niitä,
        kun hän antaa agentillesi pääsyn palvelimille tai salaisuuksiin.{" "}
        <strong>Kopioi avain tältä sivulta, älä agentin vastauksesta:</strong>{" "}
        sivu lukee sen suoraan tilin tiedostosta.
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
            <span>Avain</span>
            <span>Sormenjälki · muutettu</span>
            <span />
          </div>
        )}
        {keys.length > 0 ? (
          <ul className="ak-list" aria-label="Tilin julkiset avaimet">
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
                    <span className="ak-mark">
                      <Icon name={kinds[entry.kind].mark} />
                    </span>
                    <div className="s-lbl ak-name">
                      <strong>
                        {kinds[entry.kind].short}
                        {unseen.has(id) ? (
                          <span data-testid="account-key-unseen-mark">
                            <Badge label="Uusi, et ole nähnyt" tone="info" />
                          </span>
                        ) : created.has(id) ? (
                          <Badge label="Luotu juuri" tone="success" />
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
                        {done && copied?.ok ? "Kopioitu" : "Kopioi"}
                      </ControlButton>
                      <IconButton
                        data-testid="account-key-toggle"
                        size="row"
                        variant="quiet"
                        className="ak-chev"
                        aria-label={`${kinds[entry.kind].title} ${entry.file}: ${expanded ? "sulje" : "näytä koko avain"}`}
                        aria-expanded={expanded}
                        aria-controls={expanded ? detailId : undefined}
                        onPress={() => toggle(id)}
                      >
                        <Icon name="forward" />
                      </IconButton>
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
                          ? "Lähetä se ylläpitäjälle, ja kerro sormenjälki erikseen."
                          : "Lähetä se ylläpitäjälle, ja vertailkaa rivi yhdessä."
                        : "Kopiointi ei onnistunut. Avaa rivi ja valitse avain käsin."}
                    </p>
                  )}
                  {unseen.has(id) && (
                    <div className="ak-unseen" data-testid="account-key-unseen">
                      <Icon name="info" />
                      <p>
                        Tämä avain ilmestyi tilille {keyDate(entry.modified_at)}
                        , eikä sitä luotu tällä sivulla. Jos pyysit agenttia
                        tekemään sen, kaikki on kunnossa. Jos et pyytänyt, älä
                        anna sitä kenellekään ja kysy agentilta, mihin se
                        tarvitsee sitä.
                      </p>
                      <ControlButton
                        data-testid="account-key-seen"
                        size="row"
                        variant="secondary"
                        onPress={() => onSeen(id)}
                      >
                        <Icon name="check" />
                        Tunnistan tämän
                      </ControlButton>
                    </div>
                  )}
                  {expanded && <Detail entry={entry} id={detailId} />}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="ak-empty">Tilillä ei ole vielä julkisia avaimia.</p>
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
              <strong>{kinds[m.kind].title} puuttuu</strong>
              <span className="s-desc">
                {m.can_create ? (
                  <>
                    {kinds[m.kind].makes} Yksityinen osa jää tilille, eikä sitä
                    näytetä. Olemassa olevaa avainta ei koskaan korvata.
                  </>
                ) : (
                  <>
                    Tällä palvelimella ei ole ohjelmaa{" "}
                    <code>{kinds[m.kind].tool}</code>, joten avainta ei voi
                    luoda täältä. Kerro asiasta palvelimen ylläpitäjälle.
                  </>
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
                {creating === m.kind ? "Luodaan…" : kinds[m.kind].create}
              </ControlButton>
            )}
          </div>
        ))}
      </div>
      {keys.length > 0 && (
        <p className="s-desc">
          Avaa rivi nähdäksesi koko avaimen ja miten ylläpitäjä tarkistaa sen.
        </p>
      )}
    </div>
  );
}
