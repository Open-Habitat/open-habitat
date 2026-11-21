import React, {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import "../../../../web/src/components/components.css";
import "../../../../web/src/components/Settings.css";
import "../../../../web/src/components/ServerAccess.css";
import { bytes } from "../../../../web/src/app/storageQuota";
import { shownSettingsSections } from "../../../../web/src/app/settingsIndex";
import {
  ControlButton,
  Segmented,
} from "../../../../web/src/components/ControlElements";
import { Icon, type IconName } from "../../../../web/src/components/Icon";
import { NumberStepper } from "../../../../web/src/components/NumberStepper";
import {
  LimitReset,
  PeopleList,
  PeopleRow,
  SectionCard,
  SectionLead,
  SectionMeter,
  SectionNumber,
  SectionStatus,
  SectionSubhead,
  ServerSection,
  UsageFigure,
} from "../../../../web/src/components/ServerSection";
import { StatusMark } from "../../../../web/src/components/Status";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { accountText } from "../../../../web/src/text/account";
import { serverAccessText } from "../../../../web/src/text/serverAccess";
import { serverAdministrationText } from "../../../../web/src/text/serverAdministration";
import { serverSettingsText } from "../../../../web/src/text/serverSettings";
import { serverStorageText } from "../../../../web/src/text/serverStorage";
import { type Step, TEXT, type Text } from "./text";
import "./round.css";

// person-removal (Jari 21.11.2026): a real person removal replaces "remove
// access" leaving the person's home and quota behind. This round is the
// administrator's removal flow in Palvelimen ylläpito › Käyttäjät ja pääsy
// and Levytila, aligned with ADR 0037 (proposed): removal is its own action
// beside withdrawal; it closes the person out at once (sign-in, processes,
// services, shared links) and deletes the home at the due time; cancelling
// leaves access withdrawn; the dialog names consequences in the person's
// terms, never what is in their home, and the administrator types the login;
// nothing is archived for the administrator; an interrupted removal shows
// "Poisto kesken" with a fixed reason and the server retries hourly; from
// the first stage the person counts in the sum of limits by usage.
//
// Built on production pieces: the server area's frame (Settings.css),
// ServerSection's cards, PeopleList/PeopleRow, StatusMark, SectionMeter with
// its sum of limits, UsageFigure, LimitReset and NumberStepper, Segmented,
// the access list's own classes (ServerAccess.css) and the production dialog
// (react-aria ModalOverlay with .ah-dialog and .sa-consequences). The access
// list is composed from those pieces rather than ServerAccess itself, which
// owns its row actions and RemoveDialog.

const directions = ["1 Armonaika", "2 Heti", "3 Vaiheittain"];
const params = new URLSearchParams(location.search);
const GiB = 1024 ** 3;
const DAY = 86_400_000;
const GRACE_DAYS = 14;
const DISK = 120 * GiB;
const STEPS: Step[] = ["close", "services", "links", "home", "space", "unix"];
/** Steps the first stage does at once; the rest run at the due time. */
const CLOSE_OUT = 3;
const FAIL_AT = STEPS.indexOf("space");
/** What files_remain leaves on the disk in the stand-in. */
const LEFTOVER = 0.3 * GiB;

// ---------- The synthetic world ----------

type Pid = "aino" | "mikko" | "sanna" | "olli" | "tuuli";
type Stage =
  | { k: "active" }
  | { k: "noaccess"; since: Date }
  | { k: "scheduled"; until: Date; since: Date }
  | { k: "running"; step: number }
  | { k: "failed"; done: number }
  | { k: "removed"; at: Date };
type Person = {
  id: Pid;
  login: string;
  unix: string;
  limit: number;
  used: number;
  admin?: boolean;
  lastSeen: Date;
  /** The daemon's disconnect counts (ADR 0037 section 4), never names. */
  services: { revoked: number; local: number };
};
type World = {
  now: Date;
  failNext: boolean;
  stages: Record<Pid, Stage>;
  /** Bytes still on disk after an interrupted removal. */
  left: Partial<Record<Pid, number>>;
};

const at = (day: number, h = 10, m = 0, month = 10) =>
  new Date(2026, month, day, h, m);
const PEOPLE: Person[] = [
  { id: "aino", login: "aino-k", unix: "aino-k", limit: 30 * GiB, used: 21.6 * GiB, admin: true, lastSeen: at(21), services: { revoked: 0, local: 0 } },
  { id: "mikko", login: "mikko-l", unix: "mikko-l", limit: 40 * GiB, used: 14.2 * GiB, lastSeen: at(19), services: { revoked: 1, local: 1 } },
  { id: "sanna", login: "sanna-v", unix: "sanna-v", limit: 20 * GiB, used: 3.5 * GiB, lastSeen: at(2), services: { revoked: 0, local: 1 } },
  { id: "olli", login: "olli-p", unix: "olli-p", limit: 30 * GiB, used: 17.9 * GiB, lastSeen: at(20), services: { revoked: 2, local: 0 } },
  { id: "tuuli", login: "tuuli-r", unix: "tuuli-r", limit: 25 * GiB, used: 8.3 * GiB, lastSeen: at(21), services: { revoked: 0, local: 0 } },
];
const person = (id: Pid) => PEOPLE.find((p) => p.id === id)!;
const START: World = {
  now: at(21, 10),
  failNext: params.get("fail") === "1",
  stages: {
    aino: { k: "active" },
    mikko: { k: "active" },
    sanna: { k: "noaccess", since: at(3) },
    olli: { k: "active" },
    tuuli: { k: "active" },
  },
  left: {},
};

/** What a person's home occupies on the disk now. */
const onDisk = (w: World, p: Person) => {
  const s = w.stages[p.id];
  if (s.k === "removed") return 0;
  return w.left[p.id] ?? p.used;
};
/** What a person reserves in the sum of limits: by usage once nothing of
 * theirs runs (ADR 0037 section 7). */
const reserved = (w: World, p: Person, limit: number) => {
  const s = w.stages[p.id];
  if (s.k === "removed") return 0;
  if (s.k === "active") return limit;
  return onDisk(w, p);
};

// ---------- Review state ----------

let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: "fi" | "en" = params.get("lang") === "en" ? "en" : "fi";
const LangContext = React.createContext<"fi" | "en">("fi");
const useT = () => TEXT[React.useContext(LangContext)];
const dayOf = (d: Date, lang: "fi" | "en") =>
  lang === "fi"
    ? `${d.getDate()}.${d.getMonth() + 1}.`
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const useDay = () => {
  const lang = React.useContext(LangContext);
  return (d: Date) => dayOf(d, lang);
};
const daysLeft = (until: Date, now: Date) =>
  Math.max(0, Math.ceil((until.getTime() - now.getTime()) / DAY));
const who = (p: Person) => `@${p.login}`;

type Ask = { id: Pid; kind: "remove" | "access" };
type Act = {
  ask: (a: Ask) => void;
  cancel: (id: Pid) => void;
  retry: (id: Pid) => void;
};

// ---------- Käyttäjät ja pääsy ----------

function AccessMark({ p, w }: { p: Person; w: World }) {
  const a = useText(serverAccessText);
  const t = useT();
  const day = useDay();
  const s = w.stages[p.id];
  const id = `access-state-${p.id}`;
  if (s.k === "noaccess") return <StatusMark data-testid={id} tone="warning" label={a.noAccess} />;
  if (s.k === "scheduled") return <StatusMark data-testid={id} tone="warning" label={t.scheduledMark(day(s.until))} />;
  if (s.k === "running") return <StatusMark data-testid={id} tone="info" animated="running" label={t.running} />;
  if (s.k === "failed") return <StatusMark data-testid={id} tone="danger" label={t.failed} />;
  if (s.k === "removed") return <StatusMark data-testid={id} tone="neutral" label={t.removedMark} />;
  return <StatusMark data-testid={id} tone="success" label={p.admin ? a.admin : a.user} />;
}

/** The removal's steps, done and left: on the row and in 2's window. */
function Steps({ s, testId, from = 0 }: { s: Stage; testId: string; from?: number }) {
  const t = useT();
  const done = s.k === "running" ? s.step : s.k === "failed" ? s.done : s.k === "removed" ? STEPS.length : 0;
  return (
    <ol className="pr-steps" data-testid={testId}>
      {STEPS.map((step, i) => {
        if (i < from) return null;
        const state = i < done ? "done" : s.k === "failed" && i === done ? "failed" : s.k === "running" && i === done ? "running" : "left";
        return (
          <li key={step} data-step={step} data-state={state}>
            <Icon name={state === "done" ? "check" : state === "failed" ? "warning" : state === "running" ? "refresh" : "clock"} />
            <span>{state === "running" ? t.stepsRunning[step] : state === "failed" ? t.interrupted(t.stepsRunning[step]) : t.steps[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Removal is offered beside withdrawal in 1 and 2, and only on a withdrawn
 * person in 3. A site.json person and the administrator themself have none. */
function AccessRowEnd({ p, w, d, act }: { p: Person; w: World; d: number; act: Act }) {
  const t = useT();
  const s = w.stages[p.id];
  if (p.admin) return null;
  if (s.k === "active" || s.k === "noaccess")
    return (
      <span className="pr-actions">
        {s.k === "active" && (
          <ControlButton data-testid={`withdraw-${p.id}`} size="row" variant="quiet" onPress={() => act.ask({ id: p.id, kind: "access" })}>
            <Icon name="cross" />
            {t.removeAccess}
          </ControlButton>
        )}
        {(s.k === "noaccess" || d !== 2) && (
          <ControlButton data-testid={`remove-${p.id}`} size="row" variant="quiet" aria-label={t.removePersonNamed(who(p))} onPress={() => act.ask({ id: p.id, kind: "remove" })}>
            <Icon name="trash" />
            {t.removePerson}
          </ControlButton>
        )}
      </span>
    );
  if (s.k === "scheduled")
    return (
      <ControlButton data-testid={`cancel-${p.id}`} size="row" variant="secondary" aria-label={t.cancelNamed(who(p))} onPress={() => act.cancel(p.id)}>
        <Icon name="restore" />
        {t.cancel}
      </ControlButton>
    );
  if (s.k === "failed")
    return (
      <ControlButton data-testid={`retry-${p.id}`} size="row" variant="secondary" onPress={() => act.retry(p.id)}>
        <Icon name="refresh" />
        {t.retry}
      </ControlButton>
    );
  return null;
}

function StageDetail({ p, w, place }: { p: Person; w: World; place: "access" | "storage" }) {
  const t = useT();
  const a = useText(serverAccessText);
  const day = useDay();
  const s = w.stages[p.id];
  if (s.k === "noaccess")
    return <span className="sa-muted" data-testid={`${place}-stage-${p.id}`}>{t.noAccessSince(day(s.since))}</span>;
  if (s.k === "scheduled")
    return (
      <span className="pr-grace" data-testid={`${place}-stage-${p.id}`}>
        <Icon name="clock" />
        <span>
          <span data-testid={`${place}-days-${p.id}`}>{t.daysLeft(daysLeft(s.until, w.now))}</span> · {t.scheduledNote}
        </span>
      </span>
    );
  if (s.k === "running") return <Steps s={s} testId={`${place}-steps-${p.id}`} />;
  if (s.k === "failed")
    return (
      <>
        <span className="sa-bad" role="alert" data-testid={`${place}-failed-${p.id}`}>
          <Icon name="warning" />
          {t.failedReason} {t.stepsDone(s.done, STEPS.length)}. {t.retryHourly}
        </span>
        <Steps s={s} testId={`${place}-steps-${p.id}`} />
      </>
    );
  if (s.k === "removed")
    return (
      <span className="sa-facts" data-testid={`${place}-stage-${p.id}`}>
        <span>{t.removedFact(day(s.at))}</span>
        <span data-testid={`services-${p.id}`}>{t.servicesFact(p.services.revoked, p.services.local)}</span>
      </span>
    );
  return place === "access" ? (
    <span className="sa-facts">
      <span>
        {a.unix} <code>{p.unix}</code>
      </span>
      <span>{a.lastSeen(day(p.lastSeen))}</span>
    </span>
  ) : null;
}

type Filter = "all" | "joined" | "allowed" | "withdrawn";
const stageOf = (s: Stage): Exclude<Filter, "all"> => (s.k === "active" ? "joined" : "withdrawn");

function Access({ w, d, act }: { w: World; d: number; act: Act }) {
  const a = useText(serverAccessText);
  const adm = useText(serverAdministrationText);
  const [filter, setFilter] = useState<Filter>("all");
  const count = (f: Filter) => PEOPLE.filter((p) => stageOf(w.stages[p.id]) === f).length;
  const shown = PEOPLE.filter((p) => filter === "all" || stageOf(w.stages[p.id]) === filter);
  return (
    <ServerSection testId="access-view">
      <SectionLead>{adm.accessLead}</SectionLead>
      <div className="sa s-stack" data-testid="server-access" data-mode="listed">
        <SectionSubhead
          aside={
            <Segmented
              data-testid="access-filter"
              label={a.show}
              size="row"
              value={filter}
              onChange={setFilter}
              options={[
                { id: "all", label: a.all },
                { id: "joined", label: a.joined(count("joined")) },
                { id: "allowed", label: a.allowed(count("allowed")) },
                { id: "withdrawn", label: a.withdrawn(count("withdrawn")) },
              ]}
            />
          }
        >
          {a.people} <span className="s-count">{PEOPLE.length}</span>
        </SectionSubhead>
        <SectionCard>
          <PeopleList row="access-people" testId="access-list" actions columns={[a.person, a.role]}>
            {shown.map((p) => (
              <PeopleRow
                key={p.id}
                testId={`access-row-${p.id}`}
                data-stage={w.stages[p.id].k}
                name={
                  <span className="sa-login" data-testid={`access-login-${p.id}`}>
                    @{p.login}
                  </span>
                }
                detail={<StageDetail p={p} w={w} place="access" />}
                cells={[<AccessMark key="state" p={p} w={w} />]}
                end={<AccessRowEnd p={p} w={w} d={d} act={act} />}
              />
            ))}
          </PeopleList>
        </SectionCard>
      </div>
    </ServerSection>
  );
}

// ---------- Levytila ----------

function Storage({ w, act, limits, setLimit }: { w: World; act: Act; limits: Record<Pid, number>; setLimit: (id: Pid, n: number) => void }) {
  const st = useText(serverStorageText);
  const t = useT();
  const fallback = 25 * GiB;
  const used = PEOPLE.reduce((sum, p) => sum + onDisk(w, p), 0);
  const worst = PEOPLE.reduce((sum, p) => sum + reserved(w, p, limits[p.id]), 0);
  const over = worst > DISK;
  const shown = PEOPLE.filter((p) => w.stages[p.id].k !== "removed");
  return (
    <ServerSection testId="server-storage-section">
      <SectionLead>{st.lead}</SectionLead>
      <SectionCard>
        <SectionMeter
          row="disk"
          testId="server-storage"
          data-overcommitted={String(over)}
          data-worst={(worst / GiB).toFixed(2)}
          label={st.disk}
          figure={st.capacity(bytes(DISK), bytes(DISK - used))}
          total={DISK}
          meterLabel={st.meter(bytes(used), bytes(worst), bytes(DISK))}
          now={{ label: st.usedNow, value: bytes(used), amount: used, testId: "storage-now" }}
          worst={{ label: st.worst, value: bytes(worst), amount: worst, testId: "storage-worst" }}
          over={over ? st.overcommitted : undefined}
          overTestId="storage-over"
        />
        <SectionNumber
          row="default-limit"
          testId="default-limit"
          label={st.defaultLimit}
          description={st.defaultLimitDesc}
          value={fallback / GiB}
          min={1}
          max={2 ** 20}
          step={5}
          unit="GiB"
          onChange={() => {}}
        />
      </SectionCard>
      <SectionSubhead>{st.people}</SectionSubhead>
      <SectionCard>
        <PeopleList row="user-limits" columns={[st.person, st.used, st.limit]}>
          {shown.map((p) => {
            const s = w.stages[p.id];
            const limit = limits[p.id];
            const own = limit !== fallback;
            const counting = s.k === "active";
            return (
              <PeopleRow
                key={p.id}
                testId={`administration-user-${p.login}`}
                data-stage={s.k}
                name={p.login}
                detail={
                  counting ? (
                    <span className="s-desc">{own ? st.ownLimit : st.usesDefault}</span>
                  ) : (
                    <>
                      <span className="pr-stage-line">
                        <AccessMark p={p} w={w} />
                        {s.k === "scheduled" && (
                          <ControlButton data-testid={`storage-cancel-${p.id}`} size="row" variant="quiet" aria-label={t.cancelNamed(who(p))} onPress={() => act.cancel(p.id)}>
                            {t.cancel}
                          </ControlButton>
                        )}
                        {s.k === "noaccess" && (
                          <ControlButton data-testid={`storage-remove-${p.id}`} size="row" variant="quiet" aria-label={t.removePersonNamed(who(p))} onPress={() => act.ask({ id: p.id, kind: "remove" })}>
                            {t.removePerson}
                          </ControlButton>
                        )}
                        {s.k === "failed" && (
                          <ControlButton data-testid={`storage-retry-${p.id}`} size="row" variant="quiet" onPress={() => act.retry(p.id)}>
                            {t.retry}
                          </ControlButton>
                        )}
                      </span>
                      <span className="s-desc">{t.countedByUse}</span>
                    </>
                  )
                }
                cells={[
                  <UsageFigure
                    key="use"
                    testId={`storage-use-${p.login}`}
                    used={onDisk(w, p)}
                    limit={limit}
                    text={counting ? `${bytes(onDisk(w, p))} / ${bytes(limit)}` : bytes(onDisk(w, p))}
                  />,
                  counting ? (
                    <LimitReset
                      key="limit"
                      own={own}
                      label={st.toDefault(bytes(fallback))}
                      name={st.toDefaultFor(p.login, bytes(fallback))}
                      testId={`storage-limit-${p.login}-reset`}
                      onPress={() => setLimit(p.id, fallback)}
                    >
                      <NumberStepper
                        label={st.personLimit(p.login)}
                        testId={`storage-limit-${p.login}`}
                        value={limit / GiB}
                        min={1}
                        max={2 ** 20}
                        step={5}
                        onChange={(n) => setLimit(p.id, n * GiB)}
                      />
                    </LimitReset>
                  ) : (
                    <span key="limit" className="sa-muted" data-testid={`storage-limit-${p.login}-none`}>
                      <s>{bytes(limit)}</s>
                    </span>
                  ),
                ]}
              />
            );
          })}
        </PeopleList>
      </SectionCard>
      <SectionStatus testId="storage-status" />
    </ServerSection>
  );
}

// ---------- The confirmations ----------

function Frame({ label, testId, onClose, dismissable = true, children }: { label: string; testId: string; onClose: () => void; dismissable?: boolean; children: ReactNode }) {
  return (
    <ModalOverlay className="ah-overlay" isOpen isDismissable={dismissable} isKeyboardDismissDisabled={!dismissable} onOpenChange={(open) => !open && onClose()}>
      <Modal className="ah-modal">
        <AriaDialog className="ah-dialog sa-dialog pr-dialog" data-testid={testId} aria-label={label}>
          {children}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Withdrawal as production words it (3's first step, and "Poista pääsy"
 * everywhere), with the line that says removal is the next, separate act. */
function AccessDialog({ p, onConfirm, onClose }: { p: Person; onConfirm: () => void; onClose: () => void }) {
  const a = useText(serverAccessText);
  const t = useT();
  return (
    <Frame label={a.removeAccessQuestion(who(p))} testId="access-dialog" onClose={onClose}>
      <Heading slot="title">{a.removeAccessQuestion(who(p))}</Heading>
      <ul className="sa-consequences">
        <li>
          <Icon name="cross" />
          <span>
            {a.cannotSignIn}
            {a.sessionsEnd}
          </span>
        </li>
        <li data-testid="access-stays">
          <Icon name="terminal" />
          <span>{t.accessStays}</span>
        </li>
      </ul>
      <div className="ah-dialog-actions">
        <ControlButton size="page" variant="secondary" onPress={onClose} autoFocus>
          {a.cancel}
        </ControlButton>
        <ControlButton data-testid="access-confirm" size="page" variant="danger" onPress={onConfirm}>
          {a.removeAccess}
        </ControlButton>
      </div>
    </Frame>
  );
}

const typed = (value: string, p: Person) => value.trim().replace(/^@/, "").toLowerCase() === p.login;

/** Removal (ADR 0037 section 2): consequences in the person's terms, the
 * typed login. `when` is 1's choice; 2 removes now, 3 schedules. */
function RemoveDialog({ p, w, d, onConfirm, onClose, onRetry }: { p: Person; w: World; d: number; onConfirm: (now: boolean) => void; onClose: () => void; onRetry: () => void }) {
  const t = useT();
  const a = useText(serverAccessText);
  const day = useDay();
  const [value, setValue] = useState("");
  const [now, setNow] = useState(d === 1);
  const s = w.stages[p.id];
  const until = day(new Date(w.now.getTime() + GRACE_DAYS * DAY));
  // 2 shows the removal running in its window.
  if (d === 1 && (s.k === "running" || s.k === "failed" || s.k === "removed")) {
    const title = s.k === "running" ? t.progressTitle(who(p)) : s.k === "failed" ? t.failedTitle(who(p)) : t.doneTitle(who(p));
    return (
      <Frame label={title} testId="remove-dialog" onClose={onClose} dismissable={s.k !== "running"}>
        <Heading slot="title" data-testid="remove-dialog-title">{title}</Heading>
        {s.k === "failed" && (
          <p className="sa-bad" role="alert">
            <Icon name="warning" />
            {t.failedReason} {t.retryHourly}
          </p>
        )}
        <Steps s={s} testId="dialog-steps" />
        {s.k === "removed" && <p data-testid="dialog-freed">{t.doneFreed(bytes(p.used))}</p>}
        <div className="ah-dialog-actions">
          {s.k === "failed" && (
            <ControlButton data-testid="dialog-retry" size="page" variant="secondary" onPress={onRetry}>
              <Icon name="refresh" />
              {t.retry}
            </ControlButton>
          )}
          <ControlButton data-testid="dialog-close" size="page" variant="secondary" isDisabled={s.k === "running"} onPress={onClose}>
            {t.close}
          </ControlButton>
        </div>
      </Frame>
    );
  }
  const gone = s.k === "noaccess";
  const confirm = d === 1 ? t.confirmPermanent : now ? t.confirmNow : t.confirmOn(until);
  return (
    <Frame label={t.question(who(p))} testId="remove-dialog" onClose={onClose}>
      <Heading slot="title">{t.question(who(p))}</Heading>
      <ul className="sa-consequences" data-testid="consequences">
        <li>
          <Icon name="cross" />
          <span>{gone ? t.accessGone : t.accessNow}</span>
        </li>
        <li>
          <Icon name="plug" />
          <span>{t.servicesNow}</span>
        </li>
        <li>
          <Icon name="link" />
          <span>{t.linksNow}</span>
        </li>
        <li data-testid="home-line">
          <Icon name="trash" />
          <span>{now ? t.homeNow(bytes(p.used)) : t.homeOn(until, bytes(p.used))}</span>
        </li>
      </ul>
      {d === 0 && (
        <fieldset className="pr-when" data-testid="when">
          <legend>{t.when}</legend>
          <label>
            <input type="radio" name="when" data-testid="when-grace" checked={!now} onChange={() => setNow(false)} />
            {t.whenGrace(GRACE_DAYS, until)}
          </label>
          <label>
            <input type="radio" name="when" data-testid="when-now" checked={now} onChange={() => setNow(true)} />
            {t.whenNow}
          </label>
        </fieldset>
      )}
      <p className="pr-tell">
        <Icon name="info" />
        <span>{t.tellThem}</span>
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (typed(value, p)) onConfirm(now);
        }}
      >
        <label className="sa-field pr-type">
          <span>
            {t.typeLogin("")}
            <code>{p.login}</code>
          </span>
          <input data-testid="type-login" value={value} autoComplete="off" spellCheck={false} onChange={(e) => setValue(e.target.value)} />
        </label>
        <div className="ah-dialog-actions">
          <ControlButton size="page" variant="secondary" onPress={onClose} autoFocus>
            {a.cancel}
          </ControlButton>
          <ControlButton data-testid="remove-confirm" type="submit" size="page" variant="danger" isDisabled={!typed(value, p)}>
            {confirm}
          </ControlButton>
        </div>
      </form>
    </Frame>
  );
}

// ---------- The page ----------

function Page({ d }: { d: number }) {
  const t = useT();
  const lang = React.useContext(LangContext);
  const acc = useText(accountText);
  const srv = useText(serverSettingsText);
  const [w, setW] = useState<World>(START);
  const [view, setView] = useState<"kayttajat" | "levy">(params.get("view") === "levy" ? "levy" : "kayttajat");
  // The default view: the direction's first dialog open for @mikko-l, where
  // the directions differ. Closing it shows the list.
  const [asking, setAsking] = useState<Ask | undefined>(params.get("ask") === "none" ? undefined : { id: "mikko", kind: d === 2 ? "access" : "remove" });
  const [limits, setLimits] = useState<Record<Pid, number>>(() => Object.fromEntries(PEOPLE.map((p) => [p.id, p.limit])) as Record<Pid, number>);

  // The data removal runs step by step; the review's failure switch stops it
  // once where the broker proves the space free (files_remain).
  useEffect(() => {
    const running = PEOPLE.find((p) => w.stages[p.id].k === "running");
    if (!running) return;
    const s = w.stages[running.id] as { k: "running"; step: number };
    const id = setTimeout(() => {
      setW((cur) => {
        if (s.step === FAIL_AT && cur.failNext)
          return { ...cur, failNext: false, left: { ...cur.left, [running.id]: LEFTOVER }, stages: { ...cur.stages, [running.id]: { k: "failed", done: s.step } } };
        const next = s.step + 1;
        if (next >= STEPS.length) {
          const { [running.id]: _, ...left } = cur.left;
          return { ...cur, left, stages: { ...cur.stages, [running.id]: { k: "removed", at: cur.now } } };
        }
        return { ...cur, stages: { ...cur.stages, [running.id]: { k: "running", step: next } } };
      });
    }, 320);
    return () => clearTimeout(id);
  }, [w]);

  const set = (id: Pid, s: Stage) => setW((cur) => ({ ...cur, stages: { ...cur.stages, [id]: s } }));
  const act: Act = {
    ask: setAsking,
    // Cancelling leaves access withdrawn (ADR 0037 section 1).
    cancel: (id) => {
      const s = w.stages[id];
      if (s.k === "scheduled") set(id, { k: "noaccess", since: s.since });
    },
    retry: (id) => {
      const s = w.stages[id];
      if (s.k === "failed") set(id, { k: "running", step: s.done });
    },
  };
  const advance = (days: number) =>
    setW((cur) => {
      const now = new Date(cur.now.getTime() + days * DAY);
      const stages = { ...cur.stages };
      // The broker starts a due removal itself; one at a time in the stand-in.
      for (const p of PEOPLE) {
        const s = stages[p.id];
        if (s.k === "scheduled" && s.until <= now && !Object.values(stages).some((x) => x.k === "running")) stages[p.id] = { k: "running", step: CLOSE_OUT };
      }
      return { ...cur, now, stages };
    });
  const asked = asking && person(asking.id);
  const closeAsk = () => setAsking(undefined);

  const admin = shownSettingsSections(lang).filter((s) => s.admin);
  const label = (id: string, l: string) => (id === "palvelin" ? srv.general : id === "palvelinintegraatiot" ? srv.integrations : l);
  const title = admin.find((s) => s.id === view)!;
  return (
    <>
      <div className="pr-tools" data-testid="review-tools">
        <span className="pr-now" data-testid="review-now">{t.clock(dayOf(w.now, lang))}</span>
        <span className="ra-hint">{t.hint}</span>
        <button type="button" className="ra-event" data-testid="event-day" onClick={() => advance(1)}>{t.day1}</button>
        <button type="button" className="ra-event" data-testid="event-grace" onClick={() => advance(GRACE_DAYS)}>{t.day14}</button>
        <label className="pr-fail">
          <input type="checkbox" data-testid="event-fail" checked={w.failNext} onChange={(e) => setW((c) => ({ ...c, failNext: e.target.checked }))} />
          {t.failNext}
        </label>
        <button
          type="button"
          className="ra-event"
          data-testid="event-reset"
          onClick={() => {
            setW(START);
            setAsking(undefined);
            setLimits(Object.fromEntries(PEOPLE.map((p) => [p.id, p.limit])) as Record<Pid, number>);
          }}
        >
          {t.reset}
        </button>
      </div>
      <section className="ah-account-settings s-page s-server-area detail" data-testid="settings-page">
        <nav data-testid="settings-navigation" className="s-nav" aria-label={acc.administration}>
          <ControlButton className="s-own-back" variant="quiet" size="row" presentation="back" onPress={() => {}}>
            <Icon name="back" />
            {srv.ownSettings}
          </ControlButton>
          <h1 data-testid="settings-title">{acc.administration}</h1>
          <p className="s-desc">Habitat · {srv.affectsEveryone}</p>
          <div className="s-server-links" data-testid="server-section-links">
            {admin.map((s) => {
              const live = s.id === "kayttajat" || s.id === "levy";
              return (
                <button
                  type="button"
                  key={s.id}
                  className="s-nav-i"
                  data-testid={`settings-${s.id}`}
                  aria-current={view === s.id ? "page" : undefined}
                  aria-disabled={live ? undefined : "true"}
                  onClick={() => live && setView(s.id as "kayttajat" | "levy")}
                >
                  <Icon name={s.icon as IconName} />
                  {label(s.id, s.label)}
                </button>
              );
            })}
          </div>
        </nav>
        <div className="s-main" data-settings-page={view}>
          <h2 data-testid={`settings-section-${view}`}>{title.label}</h2>
          {view === "kayttajat" ? (
            <Access w={w} d={d} act={act} />
          ) : (
            <Storage w={w} act={act} limits={limits} setLimit={(id, n) => setLimits((l) => ({ ...l, [id]: n }))} />
          )}
        </div>
      </section>
      {asked && asking.kind === "access" && (
        <AccessDialog
          p={asked}
          onClose={closeAsk}
          onConfirm={() => {
            set(asked.id, { k: "noaccess", since: w.now });
            closeAsk();
          }}
        />
      )}
      {asked && asking.kind === "remove" && (
        <RemoveDialog
          p={asked}
          w={w}
          d={d}
          onClose={closeAsk}
          onRetry={() => act.retry(asked.id)}
          onConfirm={(now) => {
            const s = w.stages[asked.id];
            if (now) {
              set(asked.id, { k: "running", step: 0 });
              if (d !== 1) closeAsk();
              return;
            }
            set(asked.id, { k: "scheduled", until: new Date(w.now.getTime() + GRACE_DAYS * DAY), since: s.k === "noaccess" ? s.since : w.now });
            closeAsk();
          }}
        />
      )}
    </>
  );
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(reviewLanguage);
  const [run, setRun] = useState(0);
  const bar = useRef<HTMLElement>(null);
  const t: Text = TEXT[language];
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
    <LangContext.Provider value={language}>
      <div className="ra-review" data-direction={direction}>
        <header className="ra-bar" ref={bar}>
          <div className="ra-controls">
            <strong>{t.title}</strong>
            <label>
              {t.theme}{" "}
              <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value as typeof reviewTheme; setTheme(reviewTheme); }}>
                {(["light", "dark", "contrast"] as const).map((k) => (
                  <option key={k} value={k}>{t.themes[k]}</option>
                ))}
              </select>
            </label>
            <label>
              {t.language}{" "}
              <select
                id="language"
                value={language}
                onChange={(e) => {
                  reviewLanguage = e.target.value as "fi" | "en";
                  setPersonalLanguage(reviewLanguage);
                  setLanguage(reviewLanguage);
                  setRun((r) => r + 1);
                }}
              >
                <option value="fi">suomi</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
          <ol className="ra-lines" data-testid="direction-lines">
            {t.lines.map((l, i) => (
              <li key={i} aria-current={i === direction ? "true" : undefined}>{l}</li>
            ))}
          </ol>
          <p className="ra-recommend" data-testid="recommendation">{t.recommend}</p>
        </header>
        <div className="ra-stage pr-stage">
          <Page key={`${direction}-${run}`} d={direction} />
        </div>
      </div>
    </LangContext.Provider>
  );
}

setPersonalLanguage(reviewLanguage);
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
// Nor does a press on the picker count as a press outside the dialog: on
// touch, react-aria would close it and swallow the click.
for (const type of ["pointerdown", "pointerup", "mousedown", "touchstart", "touchend"])
  window.addEventListener(type, (e) => {
    if (picker.contains(e.target as Node)) e.stopPropagation();
  }, true);
new Function("stage", "variants", pickerSource)(stageSink, variants);

export type { React };
