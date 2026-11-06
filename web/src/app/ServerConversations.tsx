import { useEffect, useRef, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { Icon } from "../components/Icon";
import { NumberStepper } from "../components/NumberStepper";
import { textNow, useText } from "../i18n";
import { serverConversationsText } from "../text/serverConversations";
import { changeLiveLimit, type LiveLimitsView, liveLimits } from "./liveLimits";
import { administration, type BoundUser } from "./serverAdministration";
import { bytes } from "./storageQuota";
import "./ServerConversations.css";

// Ylläpito › Keskustelut (proto-live-conversation-limit-setting, round 3,
// "3 Muisti edellä"): the server's memory and the estimate if everyone used
// their whole limit first, then the installation's limit and every person's
// limit as steppers that move the estimate at once. A change is written a
// moment after the last press, so stepping from 12 to 20 is one write; the
// view shows the host's reply, and an unconfirmed write says so.
//
// The prototype also showed how many conversations each person has working
// now. Only that person's own daemon knows it, and no route lets the
// administrator's view ask another person's daemon, so the estimate is
// computed from the limits and the memory figure is the whole server's.

const settleMs = 500;

type Draft = { installation?: number; own: Record<string, number | null> };

export function ServerConversations({ csrf }: { csrf?: string }) {
  const t = useText(serverConversationsText);
  const [view, setView] = useState<LiveLimitsView>();
  const [users, setUsers] = useState<BoundUser[]>();
  const [error, setError] = useState("");
  const [problem, setProblem] = useState("");
  const [draft, setDraft] = useState<Draft>({ own: {} });
  const [writing, setWriting] = useState(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, () => void>());
  const revisions = useRef(new Map<string, number>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      liveLimits(controller.signal),
      administration(controller.signal),
    ])
      .then(([limits, admin]) => {
        setView(limits);
        setUsers(admin.users);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(textNow(serverConversationsText).unavailable);
      });
    return () => controller.abort();
  }, []);
  // Leaving the view sends what was stepped rather than dropping it.
  useEffect(() => {
    const waiting = timers.current;
    const writes = pending.current;
    return () => {
      for (const timer of waiting.values()) clearTimeout(timer);
      for (const write of writes.values()) write();
    };
  }, []);
  if (error)
    return (
      <p role="alert" data-testid="live-limits-unavailable">
        {error}
      </p>
    );
  if (!view || !users) return null;
  const installation =
    draft.installation ?? view.default_limit ?? view.host_default;
  const ownOf = (id: string): number | null =>
    id in draft.own
      ? (draft.own[id] ?? null)
      : (view.people.find((p) => p.id === id)?.limit ?? null);
  const worst = users.reduce(
    (sum, u) => sum + (ownOf(u.id) ?? installation),
    0,
  );
  const worstBytes = worst * view.child_bytes;

  // Writes go one at a time, so replies arrive in the order the changes were
  // made; a reply clears a control's draft only if no newer press of that
  // control came after it.
  const write = (key: string, value: number | null, revision: number) => {
    if (!csrf) return;
    pending.current.delete(key);
    setWriting((n) => n + 1);
    setProblem("");
    const clear = () =>
      setDraft((old) => {
        if (revisions.current.get(key) !== revision) return old;
        const own = { ...old.own };
        if (key) delete own[key];
        return { installation: key ? old.installation : undefined, own };
      });
    queue.current = queue.current
      .then(() => changeLiveLimit(csrf, key || undefined, value))
      .then((outcome) => {
        if (outcome.ok) {
          setView(outcome.view);
          clear();
          return;
        }
        const text = textNow(serverConversationsText);
        setProblem(outcome.uncertain ? text.uncertain : text.refused);
        if (!outcome.uncertain) void liveLimits().then(setView, () => {});
        clear();
      })
      .finally(() => setWriting((n) => n - 1));
  };
  const change = (key: string, value: number | null) => {
    const revision = (revisions.current.get(key) ?? 0) + 1;
    revisions.current.set(key, revision);
    setDraft((old) =>
      key
        ? { ...old, own: { ...old.own, [key]: value } }
        : { ...old, installation: value ?? undefined },
    );
    const waiting = timers.current.get(key);
    if (waiting) clearTimeout(waiting);
    pending.current.set(key, () => write(key, value, revision));
    timers.current.set(
      key,
      setTimeout(() => {
        timers.current.delete(key);
        write(key, value, revision);
      }, settleMs),
    );
  };

  const memory = view.memory;
  const used = memory ? memory.total_bytes - memory.available_bytes : 0;
  const over = !!memory && worstBytes > memory.total_bytes;
  const share = (n: number) =>
    memory ? `${Math.min(100, (100 * n) / memory.total_bytes)}%` : "0%";
  const over32 =
    installation > view.host_default
      ? ` ${t.overHostDefault(view.host_default)}`
      : "";
  return (
    <div className="ah-live-limits" data-testid="live-limits">
      <p className="s-intro">{t.lead}</p>
      <div className="s-card ah-administration">
        <div
          className="s-row ah-live-memory"
          data-settings-row="live-limit-memory"
          data-testid="live-memory"
          tabIndex={-1}
        >
          <div className="s-lbl">
            <strong>{t.memory}</strong>
            <span className="s-desc">
              {memory
                ? t.memoryDesc(
                    bytes(memory.total_bytes),
                    bytes(view.child_bytes),
                  )
                : t.memoryUnknownDesc(bytes(view.child_bytes))}
            </span>
          </div>
          {memory ? (
            <div
              className="ah-live-meter"
              role="img"
              aria-label={t.meter(
                bytes(used),
                bytes(worstBytes),
                bytes(memory.total_bytes),
              )}
            >
              <span
                className="ah-live-meter-worst"
                data-over={over ? "" : undefined}
                style={{ width: share(worstBytes) }}
              />
              <span
                className="ah-live-meter-now"
                style={{ width: share(used) }}
              />
            </div>
          ) : null}
          <dl className="ah-live-legend">
            {memory ? (
              <div>
                <dt>
                  <span className="ah-live-key ah-live-key-now" />
                  {t.usedNow}
                </dt>
                <dd>{bytes(used)}</dd>
              </div>
            ) : null}
            <div data-testid="live-worst">
              <dt>
                <span
                  className="ah-live-key ah-live-key-worst"
                  data-over={over ? "" : undefined}
                />
                {t.worst}
              </dt>
              <dd>{`${t.conversations(worst)} · ${bytes(worstBytes)}`}</dd>
            </div>
          </dl>
          {over ? (
            <p className="ah-live-over" data-testid="live-over">
              <Icon name="warning" />
              {t.over}
            </p>
          ) : null}
        </div>
        <div
          className="s-row"
          data-settings-row="live-limit-default"
          tabIndex={-1}
        >
          <div className="s-lbl">
            <strong>{t.perPerson}</strong>
            <span className="s-desc">{`${t.perPersonDesc}${over32}`}</span>
          </div>
          <div className="s-val">
            <NumberStepper
              label={t.perPerson}
              testId="live-default"
              value={installation}
              min={1}
              max={view.max_limit}
              unit={t.unit}
              disabled={!csrf}
              onChange={(n) => change("", n)}
            />
          </div>
        </div>
      </div>
      <h3 className="s-h3">{t.people}</h3>
      <div className="s-card ah-administration">
        <ul className="ah-live-people" data-settings-row="live-limit-people">
          {users.map((u) => {
            const own = ownOf(u.id);
            return (
              <li
                key={u.id}
                data-testid={`live-person-${u.username}`}
                data-own={own === null ? undefined : ""}
              >
                <span className="ah-live-person">
                  <strong>{u.username}</strong>
                  <span className="s-desc">
                    {own === null ? t.usesDefault : t.ownLimit}
                  </span>
                </span>
                <NumberStepper
                  label={t.personLimit(u.username)}
                  testId={`live-person-${u.username}-limit`}
                  value={own ?? installation}
                  min={1}
                  max={view.max_limit}
                  disabled={!csrf}
                  onChange={(n) => change(u.id, n === installation ? null : n)}
                />
                {own === null ? (
                  <span className="ah-live-reset-slot" />
                ) : (
                  <ControlButton
                    data-testid={`live-person-${u.username}-reset`}
                    size="row"
                    variant="quiet"
                    onPress={() => change(u.id, null)}
                  >
                    {t.toDefault}
                  </ControlButton>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <p className="ah-live-status" role="status" data-testid="live-status">
        {problem || (writing ? t.saving : "")}
      </p>
    </div>
  );
}
