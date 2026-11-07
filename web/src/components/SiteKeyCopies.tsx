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
import { PeopleList, PeopleRow } from "./ServerSection";
import { keyNames } from "./SiteKeySettings";
import { StatusMark } from "./Status";
import "./ServerAccess.css";
import "./SiteKeySettings.css";
import { formatDate, liveText } from "../i18n";
import { siteKeyText } from "../text/siteKey";

const txt = liveText(siteKeyText);

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
  p.login_hint ? `@${p.login_hint}` : txt.github(p.id);
export const day = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : formatDate(d, { day: "numeric", month: "numeric" });
};
export const list = (xs: string[]) =>
  xs.length < 2
    ? xs.join("")
    : `${xs.slice(0, -1).join(", ")}${txt.and}${xs[xs.length - 1]}`;

/** People whose recorded copy is of an earlier key. */
export const earlierHolders = (c: SiteKeyCopies) =>
  c.people.filter((p) => p.copy && !p.copy.current);

function checkText(c: CopyCheck, key: SiteKey) {
  const name = keyNames[key.provider];
  const tones = {
    absent: "info",
    earlier: "info",
    current: "success",
    own: "neutral",
    unknown: "warning",
  } as const;
  return {
    label: txt.check[c].label(name),
    tone: tones[c],
    effect: txt.check[c].effect,
  } as {
    label: string;
    tone: "neutral" | "info" | "success" | "warning";
    effect: string;
  };
}
export const outcomeText = new Proxy({} as Record<GiveOutcome, string>, {
  get: (_target, outcome: string) => txt.outcome[outcome],
});
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
    <div
      className="s-card sk-joined"
      data-testid="joined-card"
      data-settings-row="site-key-copies"
      tabIndex={-1}
    >
      <div className="s-row">
        <div className="s-lbl">
          <strong>{txt.joined}</strong>
          <span className="s-desc">{txt.joinedDesc}</span>
        </div>
        <div className="s-val">
          <ControlButton
            data-testid="give-all"
            size="row"
            variant="primary"
            isDisabled={disabled || !key || copies.people.length === 0}
            onPress={() => onGive(copies.people)}
          >
            {txt.giveAll}
          </ControlButton>
        </div>
      </div>
      <PeopleList testId="given-list" compact columns={[txt.person, txt.copy]}>
        {copies.people.map((p) => (
          <PeopleRow
            key={p.id}
            testId={`given-${p.id}`}
            name={at(p)}
            detail={
              p.username && <span className="s-desc">Unix {p.username}</span>
            }
            cells={[
              p.copy ? (
                <>
                  {txt.given(day(p.copy.at))}
                  {!p.copy.current && (
                    <>
                      {" "}
                      <span className="sk-old">
                        {txt.earlierKey(p.copy.suffix)}
                      </span>
                    </>
                  )}
                </>
              ) : (
                txt.notGiven
              ),
            ]}
          />
        ))}
      </PeopleList>
      <p className="s-row sk-muted" data-testid="joined-waiting">
        {copies.waiting > 0 ? txt.waiting(copies.waiting) : ""}
        {txt.removedNotListed}
        {!key && txt.setFirst}
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
  const title = one ? txt.giveOne(first ? at(first) : "") : txt.giveMany;
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
            <strong>{txt.apiKey(name, false)}</strong>{" "}
            <code>
              {prefix(siteKey)}
              {siteKey.suffix}
            </code>
            .{" "}
            {phase === "checking"
              ? txt.checking
              : phase === "done"
                ? txt.done
                : txt.checked}
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
                        label={txt.writing}
                      />
                    ) : (
                      <StatusMark
                        tone="info"
                        animated="running"
                        label={txt.checkingShort}
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
                <span>{txt.writesOwn(one, name)}</span>
              </li>
              <li>
                <Icon name="lock" />
                <span>{txt.copyTheirs(one, name)}</span>
              </li>
              <li>
                <Icon name="shield" />
                <span>{txt.neverReplaced}</span>
              </li>
              <li>
                <Icon name="info" />
                <span>{txt.theySee(one)}</span>
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
              {phase === "done" ? txt.close : txt.cancel}
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
                  ? txt.writing
                  : one
                    ? txt.writeOne(first ? at(first) : "")
                    : txt.writeMany(picked.length)}
              </ControlButton>
            )}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
