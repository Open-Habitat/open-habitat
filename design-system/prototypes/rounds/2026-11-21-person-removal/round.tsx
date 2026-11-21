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
  SectionRow,
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
// and Levytila, built on production pieces: the server area's frame
// (Settings.css), ServerSection's cards, PeopleList/PeopleRow, StatusMark,
// SectionMeter with its sum of limits, UsageFigure, LimitReset and
// NumberStepper, Segmented, the access list's own classes (ServerAccess.css)
// and the production dialog (react-aria ModalOverlay with .ah-dialog and
// .sa-consequences). The round's own parts are the removal stages on the
// rows, the three confirmations and the removal's progress. The access list
// is composed from those pieces rather than ServerAccess itself, because
// ServerAccess owns its row actions and RemoveDialog.
//
// Common to every direction (a decision for review): a person without access
// counts in the sum of limits by what their home uses, not by their limit,
// because nothing of theirs runs any more and the home cannot grow.

const directions = ["1 Armonaika", "2 Luettelo", "3 Arkisto"];
const params = new URLSearchParams(location.search);
const GiB = 1024 ** 3;
const DAY = 86_400_000;
const GRACE_DAYS = 7;
const ARCHIVE_DAYS = 30;
const DISK = 120 * GiB;

// ---------- The synthetic world ----------

type Pid = "aino" | "mikko" | "sanna" | "olli" | "tuuli";
type Before = "active" | "noaccess";
type Stage =
  | { k: "active" }
  | { k: "noaccess"; since: Date }
  | { k: "grace"; until: Date; before: Before; since?: Date }
  | { k: "running"; step: number }
  | { k: "failed"; done: number }
  | { k: "removed"; at: Date; archive?: { until: Date; size: number } };
type Person = {
  id: Pid;
  login: string;
  unix: string;
  limit: number;
  used: number;
  admin?: boolean;
  lastSeen: Date;
  ws: string[];
  conv: number;
  live: number;
  accounts: string[];
  links: number;
};
type World = {
  now: Date;
  failNext: boolean;
  stages: Record<Pid, Stage>;
  /** Home bytes still on disk while a removal is partway. */
  left: Partial<Record<Pid, number>>;
};

const at = (day: number, h = 10, m = 0, month = 10) =>
  new Date(2026, month, day, h, m);
const PEOPLE: Person[] = [
  { id: "aino", login: "aino-k", unix: "aino-k", limit: 30 * GiB, used: 21.6 * GiB, admin: true, lastSeen: at(21), ws: [], conv: 0, live: 0, accounts: [], links: 0 },
  { id: "mikko", login: "mikko-l", unix: "mikko-l", limit: 40 * GiB, used: 14.2 * GiB, lastSeen: at(19), ws: ["kotisivu", "kuitit", "opinnot", "pelit"], conv: 37, live: 2, accounts: ["GitHub", "Google"], links: 3 },
  { id: "sanna", login: "sanna-v", unix: "sanna-v", limit: 20 * GiB, used: 3.5 * GiB, lastSeen: at(2), ws: ["gradu"], conv: 12, live: 0, accounts: ["GitHub"], links: 1 },
  { id: "olli", login: "olli-p", unix: "olli-p", limit: 30 * GiB, used: 17.9 * GiB, lastSeen: at(20), ws: [], conv: 0, live: 0, accounts: [], links: 0 },
  { id: "tuuli", login: "tuuli-r", unix: "tuuli-r", limit: 25 * GiB, used: 8.3 * GiB, lastSeen: at(21), ws: [], conv: 0, live: 0, accounts: [], links: 0 },
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
const archiveSize = (p: Person) => Math.round(p.used * 0.8 / (0.1 * GiB)) * 0.1 * GiB;
const homePath = (p: Person) => `/home/${p.unix}`;
const archivePath = (p: Person, d: Date) =>
  `/var/lib/open-habitat/archives/${p.unix}-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.tar.zst`;

const stepsFor = (d: number): Step[] =>
  d === 2
    ? ["archive", "sessions", "accounts", "links", "home", "unix"]
    : ["sessions", "accounts", "links", "home", "unix"];

/** What a person's home occupies on the disk now. */
const onDisk = (w: World, p: Person) => {
  const s = w.stages[p.id];
  if (s.k === "removed") return 0;
  return w.left[p.id] ?? p.used;
};
/** What a person reserves in the sum of limits. */
const reserved = (w: World, p: Person, limit: number) => {
  const s = w.stages[p.id];
  if (s.k === "removed") return 0;
  if (s.k === "active") return limit;
  return onDisk(w, p);
};
const archives = (w: World) =>
  PEOPLE.flatMap((p) => {
    const s = w.stages[p.id];
    return s.k === "removed" && s.archive && s.archive.until > w.now
      ? [{ p, ...s.archive }]
      : [];
  });

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

type Act = {
  ask: (id: Pid) => void;
  undo: (id: Pid) => void;
  retry: (id: Pid) => void;
  restore: (id: Pid) => void;
};

// ---------- Käyttäjät ja pääsy ----------

function AccessMark({ p, w }: { p: Person; w: World }) {
  const a = useText(serverAccessText);
  const t = useT();
  const s = w.stages[p.id];
  const id = `access-state-${p.id}`;
  if (s.k === "noaccess") return <StatusMark data-testid={id} tone="warning" label={a.noAccess} />;
  if (s.k === "grace")
    return <StatusMark data-testid={id} tone="warning" label={t.inGrace(daysLeft(s.until, w.now))} />;
  if (s.k === "running")
    return <StatusMark data-testid={id} tone="info" animated="running" label={stepsFor(dirNow)[s.step] === "archive" ? t.archiving : t.running} />;
  if (s.k === "failed") return <StatusMark data-testid={id} tone="danger" label={t.failed} />;
  if (s.k === "removed") return <StatusMark data-testid={id} tone="neutral" label={t.removedMark} />;
  return <StatusMark data-testid={id} tone="success" label={p.admin ? a.admin : a.user} />;
}

/** The removal's steps, done and left: on the row and in 2's window. */
function Steps({ d, s, testId }: { d: number; s: Stage; testId: string }) {
  const t = useT();
  const steps = stepsFor(d);
  const done = s.k === "running" ? s.step : s.k === "failed" ? s.done : s.k === "removed" ? steps.length : 0;
  return (
    <ol className="pr-steps" data-testid={testId}>
      {steps.map((step, i) => {
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

function AccessRowEnd({ p, w, d, act }: { p: Person; w: World; d: number; act: Act }) {
  const t = useT();
  const s = w.stages[p.id];
  if (p.admin) return null;
  if (s.k === "active" || s.k === "noaccess")
    return (
      <ControlButton
        data-testid={`remove-${p.id}`}
        size="row"
        variant="quiet"
        aria-label={t.removePersonNamed(who(p))}
        onPress={() => act.ask(p.id)}
      >
        <Icon name="cross" />
        {s.k === "noaccess" ? t.removeData : t.removePerson}
      </ControlButton>
    );
  if (s.k === "grace")
    return (
      <ControlButton data-testid={`undo-${p.id}`} size="row" variant="secondary" aria-label={t.undoNamed(who(p))} onPress={() => act.undo(p.id)}>
        <Icon name="restore" />
        {t.undo}
      </ControlButton>
    );
  if (s.k === "failed")
    return (
      <ControlButton data-testid={`retry-${p.id}`} size="row" variant="secondary" onPress={() => act.retry(p.id)}>
        <Icon name="refresh" />
        {t.retry}
      </ControlButton>
    );
  if (s.k === "removed" && s.archive && s.archive.until > w.now && d === 2)
    return (
      <ControlButton data-testid={`restore-${p.id}`} size="row" variant="secondary" onPress={() => act.restore(p.id)}>
        <Icon name="restore" />
        {t.restoreArchive}
      </ControlButton>
    );
  return null;
}

function StageDetail({ p, w, d, place }: { p: Person; w: World; d: number; place: "access" | "storage" }) {
  const t = useT();
  const a = useText(serverAccessText);
  const day = useDay();
  const s = w.stages[p.id];
  if (s.k === "noaccess")
    return <span className="sa-muted" data-testid={`${place}-stage-${p.id}`}>{t.noAccessSince(day(s.since))}</span>;
  if (s.k === "grace")
    return (
      <span className="pr-grace" data-testid={`${place}-stage-${p.id}`}>
        <Icon name="clock" />
        {t.graceFact(day(s.until))} · {t.graceNote}
      </span>
    );
  if (s.k === "running")
    return <Steps d={d} s={s} testId={`${place}-steps-${p.id}`} />;
  if (s.k === "failed")
    return (
      <>
        <span className="sa-bad" role="alert" data-testid={`${place}-failed-${p.id}`}>
          <Icon name="warning" />
          {t.stepFailed} {t.stepsDone(s.done, stepsFor(d).length)}
        </span>
        <Steps d={d} s={s} testId={`${place}-steps-${p.id}`} />
      </>
    );
  if (s.k === "removed")
    return (
      <span className="sa-facts" data-testid={`${place}-stage-${p.id}`}>
        <span>{t.removedFact(day(s.at))}</span>
        {s.archive && s.archive.until > w.now && (
          <span data-testid={`archive-kept-${p.id}`}>{t.archiveKept(day(s.archive.until), bytes(s.archive.size))}</span>
        )}
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
                detail={<StageDetail p={p} w={w} d={d} place="access" />}
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

function Storage({ w, d, act, limits, setLimit }: { w: World; d: number; act: Act; limits: Record<Pid, number>; setLimit: (id: Pid, n: number) => void }) {
  const st = useText(serverStorageText);
  const t = useT();
  const fallback = 25 * GiB;
  const used = PEOPLE.reduce((sum, p) => sum + onDisk(w, p), 0) + archives(w).reduce((s, x) => s + x.size, 0);
  const worst = PEOPLE.reduce((sum, p) => sum + reserved(w, p, limits[p.id]), 0);
  const over = worst > DISK;
  const shown = PEOPLE.filter((p) => w.stages[p.id].k !== "removed");
  const arch = archives(w);
  const day = useDay();
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
        {d === 2 && (
          <SectionRow label={t.archives} description={t.archivesDesc} testId="archives-row">
            <span className="sa-muted" data-testid="archives-figure">
              {arch.length ? t.archiveRow(arch.length, bytes(arch.reduce((s, x) => s + x.size, 0)), day(arch[0].until)) : t.noArchives}
            </span>
          </SectionRow>
        )}
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
                        {s.k === "grace" && (
                          <ControlButton data-testid={`storage-undo-${p.id}`} size="row" variant="quiet" aria-label={t.undoNamed(who(p))} onPress={() => act.undo(p.id)}>
                            {t.undo}
                          </ControlButton>
                        )}
                        {(s.k === "noaccess") && (
                          <ControlButton data-testid={`storage-remove-${p.id}`} size="row" variant="quiet" aria-label={t.removePersonNamed(who(p))} onPress={() => act.ask(p.id)}>
                            {t.removeData}
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

/** The inventory: exactly what removal deletes. */
function Inventory({ p, compact }: { p: Person; compact?: boolean }) {
  const t = useT();
  if (compact)
    return (
      <p className="pr-short" data-testid="inventory-short">
        <strong>{t.inventory}:</strong> {homePath(p)} ({bytes(p.used)}), {t.short({ ws: p.ws.length, conv: p.conv, acc: p.accounts.length, links: p.links })}
      </p>
    );
  const [a, path, b] = t.home(homePath(p), bytes(p.used));
  const items: [IconName, ReactNode, string][] = [
    ["folder", <>{a}<code>{path}</code>{b}</>, "home"],
    ["worktree", <>{t.workspaces(p.ws.length)} {p.ws.map((n, i) => <React.Fragment key={n}>{i > 0 && ", "}<code>{n}</code></React.Fragment>)}</>, "workspaces"],
    ["agent", t.conversations(p.conv, p.live), "conversations"],
    ["plug", t.accounts(p.accounts.join(", ")), "accounts"],
    ["link", t.links(p.links), "links"],
    ["terminal", <>{t.unixAccount}<code>{p.unix}</code>{t.unixNotReused}</>, "unix"],
  ];
  return (
    <>
      <h3 className="pr-inv-h">{t.inventory}</h3>
      <ul className="sa-consequences pr-inventory" data-testid="inventory">
        {items.map(([icon, words, key]) => (
          <li key={key} data-item={key}>
            <Icon name={icon} />
            <span>{words}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

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

/** 1 Armonaika: access ends now, the data is deleted after the period. */
function GraceDialog({ p, w, onConfirm, onClose }: { p: Person; w: World; onConfirm: () => void; onClose: () => void }) {
  const t = useT();
  const day = useDay();
  const until = new Date(w.now.getTime() + GRACE_DAYS * DAY);
  const gone = w.stages[p.id].k === "noaccess";
  return (
    <Frame label={t.graceQuestion(who(p))} testId="grace-dialog" onClose={onClose}>
      <Heading slot="title">{t.graceQuestion(who(p))}</Heading>
      <ul className="sa-consequences">
        <li>
          <Icon name="cross" />
          <span>{gone ? t.graceAccessGone : t.graceAccess}</span>
        </li>
        <li data-testid="grace-when">
          <Icon name="clock" />
          <span>{t.graceWhen(day(until), GRACE_DAYS)}</span>
        </li>
        <li>
          <Icon name="disk" />
          <span>{t.graceDisk(bytes(p.used))}</span>
        </li>
      </ul>
      <Inventory p={p} compact />
      <div className="ah-dialog-actions">
        <ControlButton size="page" variant="secondary" onPress={onClose} autoFocus>
          {useText(serverAccessText).cancel}
        </ControlButton>
        <ControlButton data-testid="grace-confirm" size="page" variant="danger" onPress={onConfirm}>
          {t.graceConfirm(GRACE_DAYS)}
        </ControlButton>
      </div>
    </Frame>
  );
}

/** 2 Yksi ikkuna: the full inventory, two presses, then the progress here. */
function ListDialog({ p, w, onConfirm, onAccessOnly, onRetry, onClose }: { p: Person; w: World; onConfirm: () => void; onAccessOnly: () => void; onRetry: () => void; onClose: () => void }) {
  const t = useT();
  const a = useText(serverAccessText);
  const [armed, setArmed] = useState(false);
  const s = w.stages[p.id];
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(id);
  }, [armed]);
  const started = s.k === "running" || s.k === "failed" || s.k === "removed";
  if (started) {
    const title = s.k === "running" ? t.progressTitle(who(p)) : s.k === "failed" ? t.failedTitle(who(p)) : t.doneTitle(who(p));
    return (
      <Frame label={title} testId="list-dialog" onClose={onClose} dismissable={s.k !== "running"}>
        <Heading slot="title" data-testid="list-dialog-title">{title}</Heading>
        {s.k === "failed" && (
          <p className="sa-bad" role="alert">
            <Icon name="warning" />
            {t.stepFailed}
          </p>
        )}
        <Steps d={1} s={s} testId="dialog-steps" />
        {s.k === "removed" && <p data-testid="list-freed">{t.doneFreed(bytes(p.used))}</p>}
        <div className="ah-dialog-actions">
          {s.k === "failed" && (
            <ControlButton data-testid="dialog-retry" size="page" variant="danger" onPress={onRetry}>
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
  return (
    <Frame label={t.listQuestion(who(p))} testId="list-dialog" onClose={onClose}>
      <Heading slot="title">{t.listQuestion(who(p))}</Heading>
      <p className="pr-warn">
        <Icon name="warning" />
        {t.cannotUndo}
      </p>
      <Inventory p={p} />
      <p className="pr-armed" aria-live="polite" data-testid="armed-note">
        {armed ? t.armed : ""}
      </p>
      <div className="ah-dialog-actions pr-actions-3">
        {w.stages[p.id].k === "active" && (
          <ControlButton data-testid="access-only" size="page" variant="quiet" onPress={onAccessOnly}>
            {t.accessOnly}
          </ControlButton>
        )}
        <ControlButton size="page" variant="secondary" onPress={onClose} autoFocus>
          {a.cancel}
        </ControlButton>
        <ControlButton
          data-testid="list-confirm"
          data-armed={armed ? "" : undefined}
          size="page"
          variant="danger"
          onPress={() => (armed ? onConfirm() : setArmed(true))}
        >
          {armed ? t.confirmNow : t.deleteNow}
        </ControlButton>
      </div>
    </Frame>
  );
}

/** 3 Arkisto ensin: an archive on the server, then the removal runs on the row. */
function ArchiveDialog({ p, w, onConfirm, onClose }: { p: Person; w: World; onConfirm: (archive: boolean) => void; onClose: () => void }) {
  const t = useT();
  const a = useText(serverAccessText);
  const day = useDay();
  const [archive, setArchive] = useState(true);
  const [armed, setArmed] = useState(false);
  const until = new Date(w.now.getTime() + ARCHIVE_DAYS * DAY);
  const [pre, path] = t.archivePath(archivePath(p, w.now));
  return (
    <Frame label={t.archiveQuestion(who(p))} testId="archive-dialog" onClose={onClose}>
      <Heading slot="title">{t.archiveQuestion(who(p))}</Heading>
      <p>{t.archiveLead}</p>
      <div className="pr-archive" data-on={archive ? "" : undefined}>
        <label className="pr-check">
          <input type="checkbox" data-testid="archive-toggle" checked={archive} onChange={(e) => { setArchive(e.target.checked); setArmed(false); }} />
          <strong>{t.archiveMake}</strong>
        </label>
        <span className="pr-archive-path">
          {pre}
          <code data-testid="archive-path">{path}</code>
        </span>
        <span className="sa-muted">{t.archiveFacts(bytes(archiveSize(p)), day(until))}</span>
      </div>
      <Inventory p={p} compact />
      {!archive && (
        <p className="pr-warn">
          <Icon name="warning" />
          {t.cannotUndo} {armed ? t.armed : ""}
        </p>
      )}
      <div className="ah-dialog-actions">
        <ControlButton size="page" variant="secondary" onPress={onClose} autoFocus>
          {a.cancel}
        </ControlButton>
        <ControlButton
          data-testid="archive-confirm"
          size="page"
          variant="danger"
          onPress={() => (archive || armed ? onConfirm(archive) : setArmed(true))}
        >
          {archive ? t.archiveConfirm : armed ? t.confirmNow : t.noArchiveConfirm}
        </ControlButton>
      </div>
    </Frame>
  );
}

// ---------- The page ----------

let dirNow = 0;

function Page({ d }: { d: number }) {
  const t = useT();
  const lang = React.useContext(LangContext);
  const acc = useText(accountText);
  const srv = useText(serverSettingsText);
  const [w, setW] = useState<World>(START);
  const [view, setView] = useState<"kayttajat" | "levy">(params.get("view") === "levy" ? "levy" : "kayttajat");
  // The default view: the confirmation open for @mikko-l, where the
  // directions differ. Closing it shows the list.
  const [asking, setAsking] = useState<Pid | undefined>(params.get("ask") === "none" ? undefined : "mikko");
  const [noArchive, setNoArchive] = useState<Partial<Record<Pid, boolean>>>({});
  const [limits, setLimits] = useState<Record<Pid, number>>(() => Object.fromEntries(PEOPLE.map((p) => [p.id, p.limit])) as Record<Pid, number>);
  dirNow = d;
  const steps = stepsFor(d);

  // The removal runs step by step; the review's failure switch interrupts
  // it at the home directory once.
  useEffect(() => {
    const running = PEOPLE.find((p) => w.stages[p.id].k === "running");
    if (!running) return;
    const s = w.stages[running.id] as { k: "running"; step: number };
    const id = setTimeout(() => {
      setW((cur) => {
        const step = steps[s.step];
        if (step === "home" && cur.failNext)
          return { ...cur, failNext: false, left: { ...cur.left, [running.id]: running.used }, stages: { ...cur.stages, [running.id]: { k: "failed", done: s.step } } };
        const next = s.step + 1;
        if (next >= steps.length) {
          const archive = d === 2 && !noArchive[running.id] ? { until: new Date(cur.now.getTime() + ARCHIVE_DAYS * DAY), size: archiveSize(running) } : undefined;
          return { ...cur, stages: { ...cur.stages, [running.id]: { k: "removed", at: cur.now, archive } } };
        }
        return { ...cur, stages: { ...cur.stages, [running.id]: { k: "running", step: next } } };
      });
    }, 320);
    return () => clearTimeout(id);
  }, [w, d]);

  const set = (id: Pid, s: Stage) => setW((cur) => ({ ...cur, stages: { ...cur.stages, [id]: s } }));
  const start = (id: Pid) => set(id, { k: "running", step: 0 });
  const act: Act = {
    ask: setAsking,
    undo: (id) => {
      const s = w.stages[id];
      if (s.k === "grace") set(id, s.before === "noaccess" ? { k: "noaccess", since: s.since ?? w.now } : { k: "active" });
    },
    retry: (id) => {
      const s = w.stages[id];
      if (s.k === "failed") set(id, { k: "running", step: s.done });
      if (d === 1) setAsking(id);
    },
    restore: (id) => set(id, { k: "noaccess", since: w.now }),
  };
  const advance = (days: number) =>
    setW((cur) => {
      const now = new Date(cur.now.getTime() + days * DAY);
      const stages = { ...cur.stages };
      // Only one removal runs at a time in the stand-in; due ones start in turn.
      for (const p of PEOPLE) {
        const s = stages[p.id];
        if (s.k === "grace" && s.until <= now && !Object.values(stages).some((x) => x.k === "running")) stages[p.id] = { k: "running", step: 0 };
      }
      return { ...cur, now, stages };
    });
  const asked = asking && person(asking);
  const closeAsk = () => setAsking(undefined);

  const admin = shownSettingsSections(lang).filter((s) => s.admin);
  const label = (id: string, l: string) => (id === "palvelin" ? srv.general : id === "palvelinintegraatiot" ? srv.integrations : l);
  const title = admin.find((s) => s.id === view)!;
  return (
    <>
      <div className="pr-tools" data-testid="review-tools">
        <span className="pr-now" data-testid="review-now">{t.clock(`${dayOf(w.now, lang)} ${lang === "fi" ? "klo" : ""} 10.00`)}</span>
        <span className="ra-hint">{t.hint}</span>
        <button type="button" className="ra-event" data-testid="event-day" onClick={() => advance(1)}>{t.day1}</button>
        <button type="button" className="ra-event" data-testid="event-week" onClick={() => advance(GRACE_DAYS)}>{t.day7}</button>
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
            setNoArchive({});
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
                  <Icon name={s.icon} />
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
            <Storage w={w} d={d} act={act} limits={limits} setLimit={(id, n) => setLimits((l) => ({ ...l, [id]: n }))} />
          )}
        </div>
      </section>
      {asked && d === 0 && (
        <GraceDialog
          p={asked}
          w={w}
          onClose={closeAsk}
          onConfirm={() => {
            const s = w.stages[asked.id];
            set(asked.id, { k: "grace", until: new Date(w.now.getTime() + GRACE_DAYS * DAY), before: s.k === "noaccess" ? "noaccess" : "active", since: s.k === "noaccess" ? s.since : undefined });
            closeAsk();
          }}
        />
      )}
      {asked && d === 1 && (
        <ListDialog
          p={asked}
          w={w}
          onClose={closeAsk}
          onAccessOnly={() => {
            set(asked.id, { k: "noaccess", since: w.now });
            closeAsk();
          }}
          onRetry={() => act.retry(asked.id)}
          onConfirm={() => start(asked.id)}
        />
      )}
      {asked && d === 2 && (
        <ArchiveDialog
          p={asked}
          w={w}
          onClose={closeAsk}
          onConfirm={(archive) => {
            setNoArchive((n) => ({ ...n, [asked.id]: !archive }));
            // Without an archive the archive step is passed over.
            set(asked.id, { k: "running", step: archive ? 0 : 1 });
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
