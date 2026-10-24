import { useEffect, useRef, useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import type { SiteKey } from "../app/onboardingConfig";
import {
  type CopyCheck,
  type GiveOutcome,
  type JoinedPerson,
  type SiteKeyCopies,
  writable,
} from "../app/siteKeyCopies";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { Checkbox } from "./Primitives";
import { keyNames } from "./SiteKeySettings";
import { StatusMark } from "./Status";
import "./ServerAccess.css";
import "./SiteKeySettings.css";

// Palvelimen ylläpito › AI-avain › Jo liittyneet (proto-admin-ai-key-seed,
// "AI-avain-sivulla"; Jari 24.10.2026): the site's own record of the copies
// it gave, and the dialog that gives the key to people who joined earlier.
// The dialog asks each person's own daemon first; the administrator sees one
// word per person and never what kind of credential they have. Only absent
// or an earlier site copy can be written, and the write is decided again
// under the person's Pi lock.

const prefix = (k: SiteKey) =>
  k.provider === "anthropic" ? "sk-ant-…" : "sk-…";
export const at = (p: JoinedPerson) =>
  p.login_hint ? `@${p.login_hint}` : `GitHub ${p.id}`;
export const day = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getDate()}.${d.getMonth() + 1}.`;
};
export const list = (xs: string[]) =>
  xs.length < 2
    ? xs.join("")
    : `${xs.slice(0, -1).join(", ")} ja ${xs[xs.length - 1]}`;

/** People whose recorded copy is of an earlier key. */
export const earlierHolders = (c: SiteKeyCopies) =>
  c.people.filter((p) => p.copy && !p.copy.current);

function checkText(c: CopyCheck, key: SiteKey) {
  const name = keyNames[key.provider];
  return {
    absent: {
      label: `Ei ${name}-tunnusta`,
      tone: "info",
      effect: "Saa avaimen",
    },
    earlier: {
      label: "Sivuston aiempi avain",
      tone: "info",
      effect: "Kopio vaihtuu uuteen",
    },
    current: {
      label: "On jo tämä avain",
      tone: "success",
      effect: "Ei muutosta",
    },
    own: {
      label: `Oma ${name}-tunnus`,
      tone: "neutral",
      effect: "Ei koskaan korvata",
    },
    unknown: {
      label: "Ei vastausta",
      tone: "warning",
      effect: "Ei tarkistettu",
    },
  }[c] as {
    label: string;
    tone: "neutral" | "info" | "success" | "warning";
    effect: string;
  };
}
export const outcomeText: Record<GiveOutcome, string> = {
  seeded: "Avain kirjoitettu",
  replaced: "Kopio vaihdettu uuteen",
  already_current: "Oli jo tämä avain",
  kept: "Oma tunnus, ei muutettu",
  not_reached: "Ei tavoitettu, ei kirjoitettu",
  unknown: "Ei vastausta, tulos ei varmistunut",
};
const outcomeTone = (o: GiveOutcome) =>
  o === "seeded" || o === "replaced"
    ? "success"
    : o === "not_reached" || o === "unknown"
      ? "warning"
      : "neutral";

/** Jo liittyneet: what the site has given whom, and the giving act. */
export function JoinedCard({
  copies,
  disabled,
  onGive,
}: {
  copies: SiteKeyCopies;
  disabled: boolean;
  onGive: (targets: JoinedPerson[]) => void;
}) {
  const key = copies.site_key;
  return (
    <div className="s-card sk-joined" data-testid="joined-card">
      <div className="s-row">
        <div className="s-lbl">
          <strong>Jo liittyneet</strong>
          <span className="s-desc">
            Henkilöt, jotka liittyivät ennen avainta tai saivat aiemman avaimen.
            Lista kertoo, mitä sivusto on antanut. Mitä heidän Pi:llään nyt on,
            tarkistetaan vasta antaessa.
          </span>
        </div>
        <div className="s-val">
          <ControlButton
            data-testid="give-all"
            size="row"
            variant="primary"
            isDisabled={disabled || !key || copies.people.length === 0}
            onPress={() => onGive(copies.people)}
          >
            Anna avain liittyneille…
          </ControlButton>
        </div>
      </div>
      <ul className="sk-given" data-testid="given-list">
        {copies.people.map((p) => (
          <li key={p.id} data-testid={`given-${p.id}`}>
            <span>
              <strong>{at(p)}</strong>{" "}
              {p.username && (
                <span className="sk-muted">Unix {p.username}</span>
              )}
            </span>
            <span className="sk-muted">
              {p.copy ? (
                <>
                  Annettu {day(p.copy.at)}
                  {!p.copy.current && (
                    <>
                      {" "}
                      <span className="sk-old">
                        (aiempi avain …{p.copy.suffix})
                      </span>
                    </>
                  )}
                </>
              ) : (
                "Ei annettu"
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="s-row sk-muted" data-testid="joined-waiting">
        {copies.waiting > 0
          ? `${copies.waiting} sallittua ei ole vielä kirjautunut; he saavat avaimen ensimmäisellä kirjautumisella. `
          : ""}
        Poistetut eivät ole mukana.{!key && " Aseta avain ensin."}
      </p>
    </div>
  );
}

/** The giving dialog: checks everyone, offers only those a write can reach
 * (preselected), and shows each person's outcome. */
export function GiveDialog({
  targets,
  siteKey,
  check,
  give,
  onClose,
}: {
  targets: JoinedPerson[];
  siteKey: SiteKey;
  check: (p: JoinedPerson) => Promise<CopyCheck>;
  give: (p: JoinedPerson) => Promise<GiveOutcome>;
  onClose: (changed: boolean) => void;
}) {
  const first = targets.length === 1 ? targets[0] : undefined;
  const one = first !== undefined;
  const [checks, setChecks] = useState<Record<string, CopyCheck>>({});
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<
    "checking" | "review" | "writing" | "done"
  >("checking");
  const [outcomes, setOutcomes] = useState<Record<string, GiveOutcome>>({});
  const live = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the targets and the check are fixed for the dialog's life.
  useEffect(() => {
    live.current = true;
    // A few at a time: each check runs native Pi in that person's daemon.
    const queue = [...targets];
    const worker = async () => {
      for (let p = queue.shift(); p; p = queue.shift()) {
        const c = await check(p);
        if (!live.current) return;
        const id = p.id;
        setChecks((x) => ({ ...x, [id]: c }));
        if (writable(c)) setChosen((s) => new Set(s).add(id));
      }
    };
    void Promise.all([worker(), worker(), worker()]).then(() => {
      if (live.current) setPhase("review");
    });
    return () => {
      live.current = false;
    };
  }, []);
  const picked = targets.filter(
    (p) => chosen.has(p.id) && writable(checks[p.id]),
  );
  // One write at a time, in order; nothing is retried.
  const confirm = async () => {
    setPhase("writing");
    for (const p of picked) {
      const o = await give(p);
      setOutcomes((x) => ({ ...x, [p.id]: o }));
    }
    setPhase("done");
  };
  const name = keyNames[siteKey.provider];
  const title = one
    ? `Anna sivuston AI-avain ${first ? at(first) : ""}:lle`
    : "Anna sivuston AI-avain liittyneille";
  return (
    <ModalOverlay
      className="ah-overlay"
      isOpen
      isDismissable={phase !== "writing"}
      onOpenChange={(o) => {
        if (!o) onClose(phase === "done");
      }}
    >
      <Modal className="ah-modal">
        <Dialog
          className="ah-dialog sk-give"
          aria-label={title}
          data-testid="give-dialog"
          data-phase={phase}
        >
          <Heading slot="title">{title}</Heading>
          <p className="sk-terms">
            <strong>{name} API-avain</strong>{" "}
            <code>
              {prefix(siteKey)}
              {siteKey.suffix}
            </code>
            .{" "}
            {phase === "checking"
              ? "Tarkistetaan henkilön omasta palvelusta, mitä hänen Pi:llään on…"
              : phase === "done"
                ? "Valmis."
                : "Tarkistettu henkilön omasta palvelusta juuri nyt. Kirjoitushetkellä tarkistus tehdään uudelleen."}
          </p>
          <ul className="sk-targets" data-testid="give-targets">
            {targets.map((p) => {
              const c = checks[p.id];
              const o = outcomes[p.id];
              const t = c && checkText(c, siteKey);
              return (
                <li
                  key={p.id}
                  data-testid={`give-${p.id}`}
                  data-check={c}
                  data-outcome={o}
                >
                  <span className="sk-who">
                    {!one && c && writable(c) && phase === "review" ? (
                      <Checkbox
                        data-testid={`give-pick-${p.id}`}
                        label={at(p)}
                        checked={chosen.has(p.id)}
                        onChange={(v) =>
                          setChosen((s) => {
                            const n = new Set(s);
                            if (v) n.add(p.id);
                            else n.delete(p.id);
                            return n;
                          })
                        }
                      />
                    ) : (
                      <strong>{at(p)}</strong>
                    )}
                    {p.username && (
                      <span className="sk-muted">
                        Unix <code>{p.username}</code>
                      </span>
                    )}
                  </span>
                  <span className="sk-state">
                    {o ? (
                      <StatusMark
                        tone={outcomeTone(o)}
                        kind={
                          o === "seeded" || o === "replaced"
                            ? "success"
                            : o === "kept" || o === "already_current"
                              ? "neutral"
                              : "unknown"
                        }
                        label={outcomeText[o]}
                      />
                    ) : t ? (
                      <>
                        <StatusMark tone={t.tone} label={t.label} />
                        <span className="sk-muted" data-testid="give-effect">
                          {t.effect}
                        </span>
                      </>
                    ) : phase === "writing" && picked.includes(p) ? (
                      <StatusMark
                        tone="info"
                        animated="running"
                        label="Kirjoitetaan…"
                      />
                    ) : (
                      <StatusMark
                        tone="info"
                        animated="running"
                        label="Tarkistetaan…"
                      />
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {phase !== "done" && (
            <ul className="sa-consequences" data-testid="give-consequences">
              <li>
                <Icon name="key" />
                <span>
                  Kirjoitat toisen henkilön omiin tunnuksiin. Avain menee{" "}
                  {one ? "hänen" : "heidän"} Pi:hinsä,{" "}
                  {one ? "hänen" : "heidän"} agenttinsa käyttävät sitä, ja{" "}
                  {name} laskuttaa sivuston tiliä.
                </span>
              </li>
              <li>
                <Icon name="lock" />
                <span>
                  Kopio on {one ? "hänen" : "heidän"}.{" "}
                  {one ? "Hän ja hänen" : "He ja heidän"} agenttinsa voivat
                  lukea avaimen. Kopiota ei voi perua täältä; käytön estää vain
                  avaimen mitätöinti palvelussa {name}.
                </span>
              </li>
              <li>
                <Icon name="shield" />
                <span>
                  Oma avain tai tilaus ei koskaan korvaudu. Aiemmin annettu
                  sivuston kopio vaihtuu uuteen.
                </span>
              </li>
              <li>
                <Icon name="info" />
                <span>
                  {one ? "Hän näkee" : "He näkevät"} Asetukset › Yhteydet
                  -osiossa, että avain on sivuston antama, ja{" "}
                  {one ? "voi" : "voivat"} vaihtaa sen omaansa.
                </span>
              </li>
            </ul>
          )}
          <div className="ah-dialog-actions">
            <ControlButton
              data-testid="give-cancel"
              size="page"
              variant="secondary"
              isDisabled={phase === "writing"}
              onPress={() => onClose(phase === "done")}
            >
              {phase === "done" ? "Sulje" : "Peruuta"}
            </ControlButton>
            {phase !== "done" && (
              <ControlButton
                data-testid="give-confirm"
                size="page"
                variant="primary"
                isDisabled={phase !== "review" || picked.length === 0}
                onPress={() => void confirm()}
              >
                {phase === "writing"
                  ? "Kirjoitetaan…"
                  : one
                    ? `Kirjoita avain ${first ? at(first) : ""}:n tunnuksiin`
                    : `Kirjoita avain ${picked.length} henkilölle`}
              </ControlButton>
            )}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
