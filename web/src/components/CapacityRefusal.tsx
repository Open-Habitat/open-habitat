import { useEffect, useId, useState } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { useText } from "../i18n";
import { capacityRefusalText } from "../text/capacityRefusal";
import { pendingConversationText } from "../text/pendingConversation";
import { statusText } from "../text/status";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { StatusMark } from "./Status";
import "./CapacityRefusal.css";

/** One conversation holding a place, as the card shows it. */
export type CapacityHolder = {
  agentId: string;
  title: string;
  /** Empty when the conversation's workspace is not in the snapshot. */
  workspaceName: string;
  activity: "turn" | "question" | "processes" | "unknown";
  /** Stopped from this card: the row stays so the person sees what they did. */
  stopped?: boolean;
  stopping?: boolean;
  /** Longest untouched first within a workspace. */
  changedAt?: number;
};

/** A new conversation refused at the limit on conversations working at once
 * (proto-live-conversation-limit-setting, round 3): the limit and who set
 * it, this person's working conversations by workspace with a stop for each,
 * Try again, and Change the limit, which only an administrator can use.
 * Once a stop has freed a place it says there is room. */
export function CapacityRefusal({
  limit,
  source,
  here,
  holders,
  room,
  tries,
  admin,
  stopProblem,
  onRetry,
  onStop,
  onOpen,
  onAdmin,
}: {
  limit: number;
  source: "default" | "installation" | "own";
  /** This workspace's name: its group comes first. */
  here: string;
  holders: CapacityHolder[];
  room: boolean;
  tries: number;
  /** Whether the person is an administrator; undefined while unknown. */
  admin?: boolean;
  stopProblem?: string;
  /** Absent while another creation is under way. */
  onRetry?: () => void;
  onStop: (agentId: string) => void;
  onOpen: (agentId: string) => void;
  onAdmin: () => void;
}) {
  const t = useText(capacityRefusalText);
  const pending = useText(pendingConversationText);
  const [window, setWindow] = useState<{ open: boolean; group?: string }>({
    open: false,
  });
  const sentence = useId();
  const holding = holders.filter((h) => !h.stopped);
  const n = holding.length;
  const groupOf = (h: CapacityHolder) => h.workspaceName || t.otherPlace;
  const count = (w: string) => holding.filter((h) => groupOf(h) === w).length;
  const groups = [...new Set(holders.map(groupOf))].sort((a, b) =>
    a === here ? -1 : b === here ? 1 : count(b) - count(a),
  );
  const windowView = (
    <CapacityWindow
      open={window.open}
      group={window.group}
      here={here}
      groups={groups}
      holders={holders}
      limit={limit}
      stopProblem={stopProblem}
      onClose={() => setWindow({ open: false })}
      onStop={onStop}
      onOpen={(id) => {
        setWindow({ open: false });
        onOpen(id);
      }}
    />
  );
  // The window stays open over the room a stop in it made.
  if (room)
    return (
      <>
        <aside
          className="ah-notice ah-tone-success"
          data-testid="creation-problem"
          data-state="room"
        >
          <strong>{t.room}</strong>
          <p>{t.roomText(n, limit)}</p>
          <div className="ah-actions">
            <ControlButton
              data-testid="retry"
              size="row"
              variant="primary"
              isDisabled={!onRetry}
              onPress={onRetry}
            >
              {t.start}
            </ControlButton>
          </div>
        </aside>
        {windowView}
      </>
    );
  const said =
    source === "own"
      ? t.own(limit, n)
      : source === "installation"
        ? t.installation(limit, n)
        : t.server(limit, n);
  return (
    <aside
      className="ah-notice ah-tone-warning ah-capacity"
      data-testid="creation-problem"
      data-state="refused"
      data-reason="capacity"
    >
      <strong>{pending.conversationNotCreated}</strong>
      <p id={sentence}>{tries ? `${said} ${t.stillFull}` : said}</p>
      {groups.length ? (
        <div className="ah-capacity-chips" data-testid="capacity-workspaces">
          {groups
            .filter((w) => count(w))
            .map((w) => (
              <button
                key={w}
                type="button"
                className="ah-capacity-chip"
                data-testid="capacity-workspace"
                data-workspace={w}
                aria-label={t.inWorkspace(w, count(w))}
                onClick={() => setWindow({ open: true, group: w })}
              >
                <Icon name="folder" className="ah-capacity-chip-icon" />
                <span className="ah-capacity-chip-name">{w}</span>
                <span className="ah-rail-count">{count(w)}</span>
              </button>
            ))}
        </div>
      ) : null}
      <div className="ah-actions">
        <ControlButton
          data-testid="capacity-who"
          size="row"
          variant="primary"
          onPress={() => setWindow({ open: true })}
        >
          {t.who}
        </ControlButton>
        <ControlButton
          data-testid="retry"
          size="row"
          variant="secondary"
          isDisabled={!onRetry}
          onPress={onRetry}
        >
          {pending.retry}
        </ControlButton>
        {admin ? (
          <ControlButton
            data-testid="capacity-admin"
            size="row"
            variant="quiet"
            onPress={onAdmin}
          >
            {t.changeLimitAdmin}
          </ControlButton>
        ) : (
          <ControlButton
            data-testid="capacity-admin"
            size="row"
            variant="quiet"
            isDisabled
            aria-describedby={sentence}
          >
            {t.changeLimit}
          </ControlButton>
        )}
      </div>
      {windowView}
    </aside>
  );
}

function CapacityWindow({
  open,
  group,
  here,
  groups,
  holders,
  limit,
  stopProblem,
  onClose,
  onStop,
  onOpen,
}: {
  open: boolean;
  group?: string;
  here: string;
  groups: string[];
  holders: CapacityHolder[];
  limit: number;
  stopProblem?: string;
  onClose: () => void;
  onStop: (agentId: string) => void;
  onOpen: (agentId: string) => void;
}) {
  const t = useText(capacityRefusalText);
  const rail = useText(statusText).rail;
  const [target, setTarget] = useState<HTMLElement | null>(null);
  // The chosen workspace's group comes into view when the window opens.
  useEffect(() => {
    if (open && group) target?.scrollIntoView({ block: "start" });
  }, [open, group, target]);
  const groupOf = (h: CapacityHolder) => h.workspaceName || t.otherPlace;
  const working = holders.filter((h) => !h.stopped).length;
  const kind = (h: CapacityHolder) =>
    h.activity === "question"
      ? rail.asks
      : h.activity === "processes"
        ? rail.background
        : h.activity === "turn"
          ? rail.working
          : t.unknown;
  const stopWord = (h: CapacityHolder) =>
    h.activity === "processes"
      ? t.stopProcess
      : h.activity === "unknown"
        ? t.stop
        : t.stopTurn;
  const tone = (h: CapacityHolder) =>
    h.stopped
      ? "neutral"
      : h.activity === "question"
        ? "warning"
        : h.activity === "turn"
          ? "info"
          : "neutral";
  return (
    <ModalOverlay
      className="ah-overlay"
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      isDismissable
    >
      <Modal className="ah-modal ah-capacity-modal">
        <AriaDialog
          className="ah-dialog"
          data-testid="capacity-window"
          aria-label={t.windowLabel}
        >
          <Heading slot="title">{t.windowTitle(working, limit)}</Heading>
          <p className="s-desc">{t.windowDesc}</p>
          <div className="ah-capacity-scroll">
            {groups.map((w) => {
              const rows = holders
                .filter((h) => groupOf(h) === w)
                .sort((a, b) => (a.changedAt ?? 0) - (b.changedAt ?? 0));
              const live = rows.filter((h) => !h.stopped).length;
              return (
                <section
                  key={w}
                  className="ah-capacity-group"
                  data-group={w}
                  data-target={group === w ? "" : undefined}
                  ref={group === w ? setTarget : undefined}
                >
                  <h3 className="ah-capacity-group-head">
                    {w === here
                      ? t.thisWorkspace(w, live)
                      : t.workspace(w, live)}
                  </h3>
                  <ul className="ah-capacity-list">
                    {rows.map((h) => (
                      <li
                        key={h.agentId}
                        data-testid="capacity-holder"
                        data-agent={h.agentId}
                        data-state={h.stopped ? "stopped" : h.activity}
                      >
                        <StatusMark
                          label=""
                          tone={tone(h)}
                          animated={
                            !h.stopped && h.activity === "turn"
                              ? "running"
                              : false
                          }
                        />
                        <div className="ah-capacity-text">
                          <button
                            type="button"
                            className="ah-capacity-title"
                            onClick={() => onOpen(h.agentId)}
                          >
                            {h.title}
                          </button>
                          <span className="ah-capacity-meta">
                            {h.stopped
                              ? t.stopped
                              : h.stopping
                                ? t.stopping
                                : kind(h)}
                          </span>
                        </div>
                        {h.stopped ? (
                          <Icon name="check" className="ah-capacity-ok" />
                        ) : (
                          <ControlButton
                            data-testid="capacity-stop"
                            size="row"
                            variant="secondary"
                            isDisabled={h.stopping}
                            onPress={() => onStop(h.agentId)}
                          >
                            {stopWord(h)}
                          </ControlButton>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
          {stopProblem ? (
            <p role="alert" className="ah-capacity-problem">
              {stopProblem}
            </p>
          ) : null}
          <div className="ah-dialog-actions">
            <ControlButton
              data-testid="capacity-close"
              size="row"
              variant="primary"
              onPress={onClose}
            >
              {t.done}
            </ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
