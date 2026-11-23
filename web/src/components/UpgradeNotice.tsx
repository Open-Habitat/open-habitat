import { useEffect, useState } from "react";
import { formatDate, useText } from "../i18n";
import { upgradeNoticeText } from "../text/upgradeNotice";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { WarningBanner } from "./WarningBanner";
import "./ScheduledWake.css";

/** The snapshot's installation upgrade (snapshot.schema.json#/properties/upgrade). */
export type UpgradeSchedule = {
  schedule_id: string;
  revision: number;
  target_version: string;
  announced_at: string;
  deadline: string;
  status: "countdown" | "starting" | "withdrawn" | "unknown";
};

/** Habitat's line where the agent got the announcement
 * (history.schema.json#/$defs/upgradeNotice). */
export type UpgradeNoticeLineModel = {
  version: string;
  deadline: string;
  variant: "busy" | "idle";
  processes: { process_id: string; name: string }[];
};

const clock = (iso: string) =>
  formatDate(new Date(iso), { hour: "numeric", minute: "2-digit" });

/** Which banner shows at now: the deadline passing turns a countdown into
 * "starting" without a new snapshot, and never into "complete". */
export function upgradeBannerState(
  schedule: UpgradeSchedule,
  now: number,
): UpgradeSchedule["status"] {
  if (schedule.status === "countdown" && now >= Date.parse(schedule.deadline))
    return "starting";
  return schedule.status;
}

/** The non-modal page banner for an announced upgrade. It keeps the last
 * schedule the host gave while the page reconnects, so the downtime reads as
 * "starting", not as an endless zero. */
export function UpgradeBanner({
  schedule,
  now: fixedNow,
}: {
  schedule?: UpgradeSchedule;
  /** Test seam; the banner counts down on its own clock otherwise. */
  now?: number;
}) {
  const t = useText(upgradeNoticeText);
  const [tick, setTick] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<string>();
  useEffect(() => {
    if (fixedNow !== undefined || !schedule) return;
    const timer = window.setInterval(() => setTick(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, [fixedNow, schedule]);
  if (!schedule) return null;
  const now = fixedNow ?? tick;
  const state = upgradeBannerState(schedule, now);
  const key = `${schedule.schedule_id}:${schedule.revision}:${state}`;
  if (dismissed === key) return null;
  const at = clock(schedule.deadline);
  const minutes = Math.max(
    1,
    Math.ceil((Date.parse(schedule.deadline) - now) / 60000),
  );
  const close =
    state === "withdrawn" || state === "unknown" ? (
      <ControlButton
        variant="quiet"
        size="inline"
        data-testid="upgrade-banner-dismiss"
        onPress={() => setDismissed(key)}
      >
        {t.dismiss}
      </ControlButton>
    ) : undefined;
  const copy =
    state === "countdown"
      ? {
          title: t.countdown.title(at, minutes),
          detail: t.countdown.detail,
          short: t.countdown.short(at),
          tone: "progress" as const,
        }
      : state === "starting"
        ? { ...t.starting, short: t.starting.title, tone: "progress" as const }
        : state === "withdrawn"
          ? {
              ...t.withdrawn,
              short: t.withdrawn.title,
              tone: "neutral" as const,
            }
          : { ...t.unknown, short: t.unknown.title, tone: "neutral" as const };
  return (
    <WarningBanner
      data-testid="upgrade-banner"
      data-state={state}
      subject="upgrade-banner"
      tone={copy.tone}
      placement="page"
      title={copy.title}
      short={copy.short}
      actions={close}
    >
      {copy.detail}
    </WarningBanner>
  );
}

/** Habitat's line where the agent got the announcement; the agent's own
 * English text stays out. */
export function UpgradeNoticeLine({ line }: { line: UpgradeNoticeLineModel }) {
  const t = useText(upgradeNoticeText);
  const at = clock(line.deadline);
  return (
    <aside
      className="ah-wake-line"
      role="note"
      data-testid="upgrade-notice-line"
      data-variant={line.variant}
    >
      <Icon name="info" className="ah-wake-icon" aria-hidden="true" />
      <span className="ah-wake-line-who">{t.habitat}</span>
      <span>
        {line.variant === "idle" && line.processes.length
          ? t.toldIdle(line.version, at)
          : t.told(line.version, at)}
        {line.variant === "idle" && line.processes.length ? (
          <ul>
            {line.processes.map((p) => (
              <li key={p.process_id}>{p.name || p.process_id}</li>
            ))}
          </ul>
        ) : null}
      </span>
    </aside>
  );
}
