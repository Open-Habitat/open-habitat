import React, { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import "../../../../web/src/components/components.css";
import "../../../../web/src/components/Settings.css";
import type { OwnMachines as Data } from "../../../../web/src/app/ownMachines";
import { shownSettingsSections } from "../../../../web/src/app/settingsIndex";
import { ControlButton } from "../../../../web/src/components/ControlElements";
import { Icon, type IconName } from "../../../../web/src/components/Icon";
import { OwnMachinesPage } from "../../../../web/src/components/OwnMachines";
import { Badge } from "../../../../web/src/components/Status";
import type { Tone } from "../../../../web/src/components/types";
import { setPersonalLanguage } from "../../../../web/src/i18n";
import "./round.css";

// own-machines-import-ssh-config (Jari 22.11.2026). Settings › Omat koneet
// lists only machines Habitat set up itself (Tailscale, pinned host key,
// ~/.ssh/config.d/habitat-<name>.conf). A person who already has working
// hosts in ~/.ssh/config sees none of them. The content is the same in every
// direction: five concrete hosts read from the config (one through an
// Include), the skipped entries (a Git service, Host *, a wildcard, a Match
// block), and the same facts per host (HostName, User, Port, IdentityFile and
// whether it exists, ProxyJump, a Tailscale name, the file and line). What
// differs is where the found hosts stand on the page:
//   1 Oma ryhmä  — a separate "Löytyi ~/.ssh/config:sta" group under the
//                  machines; each host is adopted or hidden one by one;
//   2 Yksi lista — every config host is already a machine on the page, with
//                  a source badge; the person only hides;
//   3 Läpikäynti — one line at the top; a dialog goes through the hosts and
//                  the chosen ones become machines.
// Built on production pieces: the Settings frame, OwnMachinesPage with a
// synthetic daemon view, Badge, ControlButton and Icon. The round adds the
// config hosts and inserts adopted ones into production's machine list.

setPersonalLanguage("fi");
const directions = ["1 Oma ryhmä", "2 Yksi lista", "3 Läpikäynti"];
const LINES = [
  "1 Oma ryhmä: löydetyt yhteydet omana ryhmänään koneiden alla; jokainen otetaan omaksi koneeksi tai piilotetaan erikseen.",
  "2 Yksi lista: jokainen ~/.ssh/config-yhteys on heti kone tällä sivulla lähdemerkinnällä; vain piilotus.",
  "3 Läpikäynti: sivun alussa yksi rivi; dialogi käy yhteydet läpi ja valitut näkyvät koneina.",
];
const RECOMMEND =
  "Suositus: 1 Oma ryhmä. Se näyttää heti, mitä löytyi, mutta pitää erillään koneet, joiden pääsyn Habitat on itse rakentanut, ja ne, joiden avaimen, reitin ja known_hostsin ihminen on tehnyt itse.";
const params = new URLSearchParams(location.search);
let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";

// ---------- The synthetic world ----------

type CheckResult = "ok" | "offline" | "unresolved" | "hostkey_unknown" | "key_rejected";
type Host = {
  alias: string;
  hostName: string;
  user: string;
  port?: number;
  /** As written, ~ kept; undefined means ssh's default keys. */
  identity?: string;
  identityMissing?: boolean;
  jump?: string;
  tailscale?: boolean;
  where: string;
  /** What a check gives in this synthetic world. */
  result: CheckResult;
};

const HOSTS: Host[] = [
  { alias: "nas", hostName: "nas.home.arpa", user: "admin", identity: "~/.ssh/id_ed25519", where: "~/.ssh/config:4", result: "ok" },
  { alias: "rakennus", hostName: "10.20.0.5", user: "build", jump: "nas", where: "~/.ssh/config:10", result: "offline" },
  { alias: "tyokone", hostName: "tyokone.tail0a1b.ts.net", user: "maija", tailscale: true, where: "~/.ssh/config:15", result: "unresolved" },
  { alias: "pilvi", hostName: "203.0.113.10", user: "deploy", port: 2222, identity: "~/.ssh/pilvi_ed25519", identityMissing: true, where: "~/.ssh/config:19", result: "key_rejected" },
  { alias: "vanha", hostName: "old.example.net", user: "root", where: "~/.ssh/config.d/vanhat.conf:2", result: "hostkey_unknown" },
];
/** Read but not listed: why each is left out. */
const SKIPPED = [
  { what: "github.com", why: "Git-palvelu, ei kone" },
  { what: "Host *", why: "oletukset kaikille" },
  { what: "Host *.lan", why: "kuvio, ei yksi kone" },
  { what: "Match host 10.20.*", why: "Match-lohkoja ei tulkita" },
];

type Source = "found" | "empty" | "unreadable";
type World = {
  habitat: boolean;
  source: Source;
  adopted: string[];
  hidden: string[];
  checks: Record<string, CheckResult | "checking">;
};
const START: World = {
  habitat: params.get("habitat") === "1",
  source: (params.get("config") as Source) || "found",
  adopted: [],
  hidden: [],
  checks: {},
};

const NOW = "2026-11-22";
function daemonView(habitat: boolean): Data {
  const base = {
    schema_version: 1 as const,
    web_identity_id: "web-maija",
    peers: [],
    ssh_include: true,
    remove_command: "sed -i '/habitat:maija@koti.example/d' ~/.ssh/authorized_keys",
    windows_remove_command: "",
    windows_admin_remove_command: "",
    account_key: { file: "~/.ssh/id_ed25519", fingerprint: "SHA256:k3Yq0b6pQe2v1mTq7cXo8Jr5Nn4uLwA9sDfGhJkLmNo" },
  };
  if (!habitat) return { ...base, tailscale: { state: "off" }, machines: [] };
  return {
    ...base,
    tailscale: {
      state: "on",
      node: { name: "habitat-maija", address: "100.101.7.3", tailnet: "maija.example", login: "maija@example.org", shields_up: true },
    },
    machines: [
      {
        name: "kirjasto-mac",
        user: "maija",
        address: "100.101.7.20",
        expires: "",
        expired: false,
        in_tailnet: true,
        online: true,
        last_seen: NOW,
        os: "macOS",
        host_key: "SHA256:9fQx2LwT1oPzR8nVb3cY5uM7eK0aS4dJ6hG2iF8tWqE",
        connection_open: false,
      },
    ],
  };
}

// ---------- Words ----------

const resultWord: Record<CheckResult, { label: string; tone: Tone }> = {
  ok: { label: "Vastaa", tone: "success" },
  offline: { label: "Ei vastaa", tone: "neutral" },
  unresolved: { label: "Nimi ei ratkea", tone: "warning" },
  hostkey_unknown: { label: "Isäntäavain hyväksymättä", tone: "warning" },
  key_rejected: { label: "Kirjautuminen ei onnistu", tone: "danger" },
};
function resultNote(h: Host, r: CheckResult): ReactNode {
  switch (r) {
    case "ok":
      return <>Yhteys toimi ilman salasanaa. Agentti käyttää konetta komennolla <code>ssh {h.alias}</code>.</>;
    case "offline":
      return h.jump ? (
        <>Ei vastannut 10 sekunnissa <code>{h.jump}</code>:n kautta. Kone voi olla sammuksissa, tai {h.jump} ei pääse siihen.</>
      ) : (
        <>Ei vastannut 10 sekunnissa. Kone voi olla sammuksissa tai toisessa verkossa.</>
      );
    case "unresolved":
      return h.tailscale ? (
        <>
          <code>{h.hostName}</code> on Tailscale-nimi, eikä palvelin ole siinä Tailscale-verkossa. Habitatin oma Tailscale-laite pääsee koneeseen: lisää se
          kohdasta <b>Lisää kone</b>. Tämä rivi ~/.ssh/config:ssa jää ennalleen.
        </>
      ) : (
        <>Palvelin ei löydä nimeä <code>{h.hostName}</code>.</>
      );
    case "hostkey_unknown":
      return (
        <>
          Koneen isäntäavain ei ole known_hostsissa, joten agentti ei voi yhdistää kysymättä. Habitat ei hyväksy avainta puolestasi. Avaa kerran
          päätteessä <code>ssh {h.alias}</code> ja vertaa sormenjälkeä koneen omaan.
        </>
      );
    case "key_rejected":
      return h.identityMissing ? (
        <>Kone ei hyväksynyt kirjautumista. Avaintiedostoa <code>{h.identity}</code> ei ole palvelimella, joten ssh kokeili vain muita avaimia.</>
      ) : (
        <>Kone ei hyväksynyt kirjautumista ilman salasanaa tai avaimen tunnuslausetta. Agentti ei voi kirjoittaa salasanaa.</>
      );
  }
}

/** Facts known without connecting: shown before any check. */
function staticTags(h: Host): { label: string; tone: Tone; icon: IconName }[] {
  const out: { label: string; tone: Tone; icon: IconName }[] = [];
  if (h.identityMissing) out.push({ label: "Avaintiedosto puuttuu", tone: "warning", icon: "warning" });
  if (h.jump) out.push({ label: `${h.jump}:n kautta`, tone: "neutral", icon: "link" });
  if (h.tailscale) out.push({ label: "Tailscale-nimi", tone: "info", icon: "plug" });
  return out;
}
const address = (h: Host) => `${h.user}@${h.hostName}${h.port ? `:${h.port}` : ""}`;

// ---------- Pieces ----------

type Act = {
  adopt: (alias: string) => void;
  unadopt: (alias: string) => void;
  hide: (alias: string) => void;
  unhide: (alias: string) => void;
  check: (alias: string) => void;
};

function Tags({ h }: { h: Host }) {
  const tags = staticTags(h);
  if (!tags.length) return null;
  return (
    <span className="sc-tags">
      {tags.map((t) => (
        <span key={t.label} className="sc-tag" data-tone={t.tone}>
          <Icon name={t.icon} />
          {t.label}
        </span>
      ))}
    </span>
  );
}

function Facts({ h }: { h: Host }) {
  return (
    <dl className="om-facts">
      <dt>Osoite</dt>
      <dd className="om-mono om-wrap">{h.hostName}{h.port ? `:${h.port}` : ""}</dd>
      <dt>Käyttäjä koneella</dt>
      <dd className="om-mono">{h.user}</dd>
      <dt>Avain</dt>
      <dd>
        {h.identity ? <span className="om-mono">{h.identity}</span> : <span className="om-muted">ssh:n oletusavaimet</span>}
        {h.identityMissing && <span className="sc-err"> · ei palvelimella</span>}
      </dd>
      {h.jump && (
        <>
          <dt>Reitti</dt>
          <dd><span className="om-mono">ProxyJump {h.jump}</span></dd>
        </>
      )}
      <dt>Määritelty</dt>
      <dd className="om-mono om-wrap">{h.where}</dd>
      <dt>Agentille</dt>
      <dd className="om-mono">ssh {h.alias}</dd>
    </dl>
  );
}

/** A config host as a machine on the page: not Habitat's, checked on request. */
function ConfigMachine({ h, w, act, removeLabel, onRemove }: { h: Host; w: World; act: Act; removeLabel: string; onRemove: () => void }) {
  const c = w.checks[h.alias];
  const r = c && c !== "checking" ? c : undefined;
  return (
    <div className="s-card om-card om-machine sc-machine" data-testid="config-machine" data-machine={h.alias} data-state={r ?? "unchecked"}>
      <div className="om-head">
        <span className="om-mark"><Icon name="terminal" /></span>
        <span className="om-name">
          <span className="om-mono om-strong">{h.alias}</span>
          <span className="s-desc om-wrap">{address(h)}</span>
        </span>
        <span className="sc-source" data-testid="config-source"><Badge label="~/.ssh/config" tone="neutral" /></span>
        <span data-testid="config-machine-state">
          {r ? <Badge label={resultWord[r].label} tone={resultWord[r].tone} /> : <Badge label="Ei tarkistettu" tone="neutral" />}
        </span>
      </div>
      <div className="om-blk">
        <Tags h={h} />
        {r && (
          <p className={`om-note ${r === "ok" ? "om-ok" : r === "offline" ? "" : "om-err"}`} role="status" data-testid="config-check-result" data-result={r}>
            {resultNote(h, r)}
          </p>
        )}
        <Facts h={h} />
        <details className="om-more">
          <summary>Mitä Habitat tästä tietää</summary>
          <p className="s-desc">
            Rivi on omasta <code>~/.ssh/config</code>:stasi. Habitat lukee sen, mutta ei muuta sitä, ei hyväksy isäntäavaimia eikä siirrä avaimia. Agentti
            käytti tätä konetta jo ennen kuin se näkyi täällä; sivu vain näyttää sen ja tarkistaa yhteyden pyydettäessä.
          </p>
        </details>
      </div>
      <div className="om-blk om-btns">
        <ControlButton data-testid="config-check" size="row" variant="secondary" isPending={c === "checking"} onPress={() => act.check(h.alias)}>
          <Icon name="refresh" />
          Tarkista yhteys
        </ControlButton>
        <ControlButton data-testid="config-remove" size="row" variant="quiet" onPress={onRemove}>
          {removeLabel}
        </ControlButton>
      </div>
    </div>
  );
}

/** Direction 1: a found host as one row, before it is adopted. */
function FoundRow({ h, act }: { h: Host; act: Act }) {
  return (
    <li className="sc-row" data-testid="found-host" data-host={h.alias}>
      <span className="om-mark"><Icon name="terminal" /></span>
      <span className="sc-row-t">
        <span className="om-mono om-strong">{h.alias}</span>
        <span className="s-desc om-wrap">{address(h)}</span>
        <Tags h={h} />
      </span>
      <span className="sc-row-a">
        <ControlButton data-testid="found-adopt" size="row" variant="secondary" onPress={() => act.adopt(h.alias)}>
          <Icon name="plus" />
          Näytä omana koneena
        </ControlButton>
        <ControlButton data-testid="found-hide" size="row" variant="quiet" onPress={() => act.hide(h.alias)}>
          Piilota
        </ControlButton>
      </span>
    </li>
  );
}

function Skipped() {
  return (
    <details className="om-more sc-skipped" data-testid="config-skipped">
      <summary>Ohitettiin {SKIPPED.length}</summary>
      <ul>
        {SKIPPED.map((s) => (
          <li key={s.what}>
            <span className="om-mono">{s.what}</span> <span className="om-muted">· {s.why}</span>
          </li>
        ))}
      </ul>
      <p className="s-desc">Tiedostot: <span className="om-mono">~/.ssh/config</span>, <span className="om-mono">~/.ssh/config.d/vanhat.conf</span> (Include).</p>
    </details>
  );
}

function Hidden({ hosts, act }: { hosts: Host[]; act: Act }) {
  if (!hosts.length) return null;
  return (
    <details className="om-more sc-hidden" data-testid="config-hidden">
      <summary>Piilotetut {hosts.length}</summary>
      <ul>
        {hosts.map((h) => (
          <li key={h.alias}>
            <span className="om-mono">{h.alias}</span> <span className="om-muted">{address(h)}</span>
            <ControlButton size="row" variant="quiet" data-testid="config-unhide" onPress={() => act.unhide(h.alias)}>
              Näytä taas
            </ControlButton>
          </li>
        ))}
      </ul>
      <p className="s-desc">Piilotus koskee vain tätä sivua. Agentti voi yhä käyttää yhteyttä, koska se on ~/.ssh/config:ssa.</p>
    </details>
  );
}

function SourceProblem({ source }: { source: Source }) {
  if (source === "unreadable")
    return (
      <p className="om-note om-err" data-testid="config-unreadable">
        <code>~/.ssh/config</code>:ia ei voitu lukea: tiedosto on yli 1 Mt. Sivu ei näytä sen yhteyksiä; agentin ssh lukee sen silti tavalliseen tapaan.
      </p>
    );
  return (
    <p className="s-desc sc-empty" data-testid="config-empty">
      <code>~/.ssh/config</code>:ssa ei ole muita koneita. Kun lisäät sinne <code>Host</code>-rivin, se näkyy tässä.
    </p>
  );
}

// ---------- Directions ----------

/** Puts children into production's machine list, before its add card. */
function IntoMachineList({ children, at = "list" }: { children: ReactNode; at?: "list" | "top" }) {
  const [el, setEl] = useState<HTMLElement>();
  useLayoutEffect(() => {
    const host = document.createElement("div");
    host.className = "s-stack sc-inserted";
    if (at === "top") {
      const intro = document.querySelector('[data-testid="own-machines"] > .s-intro');
      intro?.after(host);
    } else {
      const list = document.querySelector('[data-settings-row="own-machines"]');
      list?.insertBefore(host, list.lastElementChild);
    }
    setEl(host);
    return () => host.remove();
  }, [at]);
  return el ? createPortal(children, el) : null;
}

function Page({ d }: { d: number }) {
  const [w, setW] = useState<World>(START);
  const [reviewing, setReviewing] = useState(false);
  const data = daemonView(w.habitat);
  const hosts = w.source === "found" ? HOSTS : [];
  const byAlias = (a: string) => hosts.find((h) => h.alias === a)!;
  const act: Act = {
    adopt: (a) => setW((c) => ({ ...c, adopted: [...c.adopted.filter((x) => x !== a), a], hidden: c.hidden.filter((x) => x !== a) })),
    unadopt: (a) => setW((c) => ({ ...c, adopted: c.adopted.filter((x) => x !== a) })),
    hide: (a) => setW((c) => ({ ...c, hidden: [...c.hidden.filter((x) => x !== a), a], adopted: c.adopted.filter((x) => x !== a) })),
    unhide: (a) => setW((c) => ({ ...c, hidden: c.hidden.filter((x) => x !== a) })),
    check: (a) => {
      setW((c) => ({ ...c, checks: { ...c.checks, [a]: "checking" } }));
      setTimeout(() => setW((c) => ({ ...c, checks: { ...c.checks, [a]: byAlias(a).result } })), 600);
    },
  };
  // Direction 2 shows every config host unless hidden; 1 and 3 only adopted ones.
  const shown = d === 1 ? hosts.filter((h) => !w.hidden.includes(h.alias)) : w.adopted.map(byAlias).filter(Boolean);
  const found = hosts.filter((h) => !w.adopted.includes(h.alias) && !w.hidden.includes(h.alias));
  const hidden = w.hidden.map(byAlias).filter(Boolean);
  const own = shownSettingsSections("fi").filter((s) => !s.admin);
  const actions = {
    connect: () => {},
    disconnect: () => {},
    addMachine: () => {},
    renew: () => {},
    recheck: () => {},
    remove: () => {},
    copy: async () => true,
  };
  return (
    <>
      <div className="pr-tools" data-testid="review-tools">
        <span className="ra-hint">Synteettinen tili maija. Aineisto:</span>
        <label>
          Habitatin koneet{" "}
          <select data-testid="world-habitat" value={w.habitat ? "1" : "0"} onChange={(e) => setW((c) => ({ ...c, habitat: e.target.value === "1" }))}>
            <option value="0">ei yhtään (Tailscale pois)</option>
            <option value="1">yksi (kirjasto-mac)</option>
          </select>
        </label>
        <label>
          ~/.ssh/config{" "}
          <select data-testid="world-config" value={w.source} onChange={(e) => setW((c) => ({ ...c, source: e.target.value as Source, adopted: [], hidden: [], checks: {} }))}>
            <option value="found">5 konetta, 4 ohitettua</option>
            <option value="empty">ei koneita</option>
            <option value="unreadable">ei luettavissa</option>
          </select>
        </label>
        <button type="button" className="ra-event" data-testid="event-reset" onClick={() => { setW(START); setReviewing(false); }}>Alusta</button>
      </div>
      <section className={`ah-account-settings s-page detail${shown.length ? " sc-has" : ""}`} data-testid="settings-page">
        <nav data-testid="settings-navigation" className="s-nav" aria-label="Asetukset">
          <h1 data-testid="settings-title">Asetukset</h1>
          {own.map((s) => (
            <button type="button" key={s.id} className="s-nav-i" aria-current={s.id === "omatkoneet" ? "page" : undefined} aria-disabled={s.id === "omatkoneet" ? undefined : "true"}>
              <Icon name={s.icon} />
              {s.label}
            </button>
          ))}
        </nav>
        <div className="s-main" data-settings-page="omatkoneet">
          <ControlButton className="s-back" variant="quiet" size="row" presentation="back" onPress={() => {}}>
            Asetukset
          </ControlButton>
          <h2 data-testid="settings-section-omatkoneet">Omat koneet</h2>
          <OwnMachinesPage data={data} checks={{}} actions={actions} />
          {shown.length > 0 && (
            <IntoMachineList>
              {shown.map((h) => (
                <ConfigMachine
                  key={h.alias}
                  h={h}
                  w={w}
                  act={act}
                  removeLabel={d === 1 ? "Piilota sivulta" : "Poista sivulta"}
                  onRemove={() => (d === 1 ? act.hide(h.alias) : act.unadopt(h.alias))}
                />
              ))}
            </IntoMachineList>
          )}
          {d === 0 && (
            <div className="sc-group" data-testid="found-group">
              <div className="s-sub om-sub">Löytyi ~/.ssh/config:sta</div>
              {w.source !== "found" ? (
                <SourceProblem source={w.source} />
              ) : (
                <div className="s-card om-card">
                  <p className="om-blk s-desc">
                    Agentti voi jo käyttää näitä yhteyksiä komennolla <code>ssh &lt;nimi&gt;</code>. Näytä kone täällä, niin se on sivulla ja agentin
                    tiedoissa omana koneenasi. Habitat ei muuta <code>~/.ssh/config</code>:ia.
                  </p>
                  {found.length ? (
                    <ul className="sc-rows">
                      {found.map((h) => <FoundRow key={h.alias} h={h} act={act} />)}
                    </ul>
                  ) : (
                    <p className="om-blk om-muted" data-testid="found-none">Kaikki löydetyt on käyty läpi.</p>
                  )}
                  <div className="om-blk">
                    <Skipped />
                    <Hidden hosts={hidden} act={act} />
                  </div>
                </div>
              )}
            </div>
          )}
          {d === 1 && (
            <div className="sc-group" data-testid="list-foot">
              {w.source !== "found" ? (
                <SourceProblem source={w.source} />
              ) : (
                <div className="sc-foot">
                  <p className="s-desc">
                    Koneet, joissa on merkki <span className="om-mono">~/.ssh/config</span>, ovat omasta SSH-asetuksestasi. Habitat lukee ne, mutta ei muuta niitä.
                  </p>
                  <Skipped />
                  <Hidden hosts={hidden} act={act} />
                </div>
              )}
            </div>
          )}
          {d === 2 && (
            <IntoMachineList at="top">
              {w.source === "found" ? (
                found.length > 0 || hidden.length > 0 ? (
                  <div className="s-card om-card sc-banner" data-testid="review-banner">
                    <div className="om-blk om-btns">
                      <Icon name="terminal" />
                      <span className="sc-banner-t">
                        {found.length === hosts.length
                          ? <><code>~/.ssh/config</code>:ssa on {hosts.length} konetta, joita tällä sivulla ei ole.</>
                          : <>{found.length + hidden.length} konetta <code>~/.ssh/config</code>:sta jäi sivulta pois.</>}
                      </span>
                      <ControlButton data-testid="review-open" size="row" variant={w.adopted.length ? "quiet" : "primary"} onPress={() => setReviewing(true)}>
                        {w.adopted.length ? "Käy läpi uudelleen" : "Käy läpi"}
                      </ControlButton>
                    </div>
                  </div>
                ) : null
              ) : w.source === "unreadable" ? (
                <SourceProblem source={w.source} />
              ) : null}
            </IntoMachineList>
          )}
        </div>
      </section>
      {reviewing && (
        <ReviewDialog
          hosts={hosts}
          initial={w.adopted}
          onClose={() => setReviewing(false)}
          onDone={(picked) => {
            setW((c) => ({ ...c, adopted: picked, hidden: hosts.map((h) => h.alias).filter((a) => !picked.includes(a)) }));
            setReviewing(false);
          }}
        />
      )}
    </>
  );
}

/** Direction 3: one pass over the found hosts. */
function ReviewDialog({ hosts, initial, onClose, onDone }: { hosts: Host[]; initial: string[]; onClose: () => void; onDone: (picked: string[]) => void }) {
  const [picked, setPicked] = useState<string[]>(initial);
  return (
    <ModalOverlay className="ah-overlay" isOpen isDismissable onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal className="ah-modal sc-modal">
        <Dialog className="ah-dialog" aria-label="Koneet ~/.ssh/config:sta" data-testid="review-dialog">
          <Heading slot="title">Koneet ~/.ssh/config:sta</Heading>
          <p className="s-desc">
            Agentti voi jo käyttää näitä komennolla <code>ssh &lt;nimi&gt;</code>. Valitut näkyvät sivulla ja agentin tiedoissa omina koneinasi. Habitat ei
            muuta <code>~/.ssh/config</code>:ia.
          </p>
          <fieldset className="om-choices sc-choices">
            <legend className="om-legend">Näytä omina koneina</legend>
            {hosts.map((h) => (
              <label key={h.alias} className="om-choice sc-choice">
                <input
                  type="checkbox"
                  data-testid={`review-pick-${h.alias}`}
                  checked={picked.includes(h.alias)}
                  onChange={(e) => setPicked((p) => (e.target.checked ? [...p, h.alias] : p.filter((x) => x !== h.alias)))}
                />
                <span className="om-choice-t">
                  <span className="om-mono">{h.alias}</span>
                  <small className="om-wrap">{address(h)}</small>
                  <Tags h={h} />
                </span>
              </label>
            ))}
          </fieldset>
          <Skipped />
          <div className="ah-dialog-actions">
            <ControlButton size="row" variant="quiet" onPress={onClose}>Peru</ControlButton>
            <ControlButton data-testid="review-done" size="row" variant="primary" onPress={() => onDone(picked)}>
              {picked.length ? `Näytä ${picked.length} konetta` : "Älä näytä yhtään"}
            </ControlButton>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [run, setRun] = useState(0);
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--review-h", `${el.getBoundingClientRect().height}px`);
    set();
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <div className="ra-review" data-direction={direction}>
      <header className="ra-bar" ref={bar}>
        <div className="ra-controls">
          <strong>Omat koneet ja ~/.ssh/config</strong>
          <label>
            Teema{" "}
            <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value as typeof reviewTheme; setTheme(reviewTheme); setRun((r) => r); }}>
              <option value="light">Päivä</option>
              <option value="dark">Yö</option>
              <option value="contrast">Korkea kontrasti</option>
            </select>
          </label>
        </div>
        <ol className="ra-lines" data-testid="direction-lines">
          {LINES.map((l, i) => (
            <li key={i} aria-current={i === direction ? "true" : undefined}>{l}</li>
          ))}
        </ol>
        <p className="ra-recommend" data-testid="recommendation">{RECOMMEND}</p>
      </header>
      <div className="ra-stage pr-stage">
        <Page key={`${direction}-${run}`} d={direction} />
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {
  set innerHTML(view: ReactNode) {
    flushSync(() => root.render(view === "" ? null : view));
  },
};
const variants = directions.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement("nav");
picker.className = "proto-picker";
picker.setAttribute("aria-label", "Prototype variants");
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
  const button = document.createElement("button");
  button.className = "proto-picker-item";
  button.textContent = n;
  if (i === 0) {
    button.setAttribute("data-active", "");
    button.setAttribute("aria-current", "true");
  }
  picker.append(button);
});
document.body.append(picker);
// The production dialog makes everything outside it inert; the review's
// picker stays usable so the directions compare with the dialog open.
new MutationObserver(() => {
  if (picker.inert) picker.inert = false;
}).observe(picker, { attributes: true, attributeFilter: ["inert"] });
for (const type of ["pointerdown", "pointerup", "mousedown", "touchstart", "touchend"])
  window.addEventListener(type, (e) => {
    if (picker.contains(e.target as Node)) e.stopPropagation();
  }, true);
new Function("stage", "variants", pickerSource)(stageSink, variants);

export type { React };
