import { useEffect, useState } from "react";
import { NumberStepper } from "../components/NumberStepper";
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
} from "../components/ServerSection";
import { textNow, useText } from "../i18n";
import { serverConversationsText } from "../text/serverConversations";
import { changeLiveLimit, type LiveLimitsView, liveLimits } from "./liveLimits";
import { administration, type BoundUser } from "./serverAdministration";
import { useSettledChanges } from "./settledChanges";
import { bytes } from "./storageQuota";

// Ylläpito › Keskustelut (proto-live-conversation-limit-setting, round 3,
// "3 Muisti edellä"): the server's memory and the estimate if everyone used
// their whole limit first, then the installation's limit and every person's
// limit as steppers that move the estimate at once. The view shows the
// host's reply, and an unconfirmed write says so.
//
// The prototype also showed how many conversations each person has working
// now. Only that person's own daemon knows it, and no route lets the
// administrator's view ask another person's daemon, so the estimate is
// computed from the limits and the memory figure is the whole server's.

export function ServerConversations({ csrf }: { csrf?: string }) {
  const t = useText(serverConversationsText);
  const [view, setView] = useState<LiveLimitsView>();
  const [users, setUsers] = useState<BoundUser[]>();
  const [error, setError] = useState("");
  const [problem, setProblem] = useState("");
  // The key "" is the installation's limit; a person's null is the default.
  const { draft, change, writing } = useSettledChanges<number | null>(
    async (key, value) => {
      if (!csrf) return;
      setProblem("");
      const outcome = await changeLiveLimit(csrf, key || undefined, value);
      if (outcome.ok) {
        setView(outcome.view);
        return;
      }
      const text = textNow(serverConversationsText);
      setProblem(outcome.uncertain ? text.uncertain : text.refused);
      if (!outcome.uncertain) void liveLimits().then(setView, () => {});
    },
  );
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
  if (error)
    return (
      <p role="alert" data-testid="live-limits-unavailable">
        {error}
      </p>
    );
  if (!view || !users) return null;
  const installation = draft[""] ?? view.default_limit ?? view.host_default;
  const ownOf = (id: string): number | null =>
    id in draft
      ? (draft[id] ?? null)
      : (view.people.find((p) => p.id === id)?.limit ?? null);
  const worst = users.reduce(
    (sum, u) => sum + (ownOf(u.id) ?? installation),
    0,
  );
  const worstBytes = worst * view.child_bytes;
  const memory = view.memory;
  const used = memory ? memory.total_bytes - memory.available_bytes : 0;
  const over = !!memory && worstBytes > memory.total_bytes;
  const over32 =
    installation > view.host_default
      ? ` ${t.overHostDefault(view.host_default)}`
      : "";
  return (
    <ServerSection testId="live-limits">
      <SectionLead>{t.lead}</SectionLead>
      <SectionCard>
        <SectionMeter
          row="live-limit-memory"
          testId="live-memory"
          label={t.memory}
          description={
            memory
              ? t.memoryDesc(bytes(view.child_bytes))
              : t.memoryUnknownDesc(bytes(view.child_bytes))
          }
          figure={
            memory
              ? t.capacity(
                  bytes(memory.total_bytes),
                  bytes(memory.available_bytes),
                )
              : undefined
          }
          total={memory?.total_bytes}
          meterLabel={
            memory
              ? t.meter(
                  bytes(used),
                  bytes(worstBytes),
                  bytes(memory.total_bytes),
                )
              : undefined
          }
          now={
            memory
              ? { label: t.usedNow, value: bytes(used), amount: used }
              : undefined
          }
          worst={{
            label: t.worst,
            value: `${t.conversations(worst)} · ${bytes(worstBytes)}`,
            amount: worstBytes,
            testId: "live-worst",
          }}
          over={over ? t.over : undefined}
          overTestId="live-over"
        />
        <SectionNumber
          row="live-limit-default"
          testId="live-default"
          label={t.perPerson}
          description={`${t.perPersonDesc}${over32}`}
          value={installation}
          min={1}
          max={view.max_limit}
          unit={t.unit}
          disabled={!csrf}
          onChange={(n) => change("", n)}
        />
      </SectionCard>
      <SectionSubhead>{t.people}</SectionSubhead>
      <SectionCard>
        <PeopleList
          row="live-limit-people"
          compact
          columns={[t.person, t.limit]}
        >
          {users.map((u) => {
            const own = ownOf(u.id);
            return (
              <PeopleRow
                key={u.id}
                testId={`live-person-${u.username}`}
                data-own={own === null ? undefined : ""}
                name={u.username}
                detail={
                  <span className="s-desc">
                    {own === null ? t.usesDefault : t.ownLimit}
                  </span>
                }
                cells={[
                  <NumberStepper
                    key="limit"
                    label={t.personLimit(u.username)}
                    testId={`live-person-${u.username}-limit`}
                    value={own ?? installation}
                    min={1}
                    max={view.max_limit}
                    disabled={!csrf}
                    onChange={(n) =>
                      change(u.id, n === installation ? null : n)
                    }
                  />,
                ]}
                end={
                  <LimitReset
                    own={own !== null}
                    label={t.toDefault}
                    testId={`live-person-${u.username}-reset`}
                    onPress={() => change(u.id, null)}
                  />
                }
              />
            );
          })}
        </PeopleList>
      </SectionCard>
      <SectionStatus testId="live-status">
        {problem || (writing ? t.saving : "")}
      </SectionStatus>
    </ServerSection>
  );
}
