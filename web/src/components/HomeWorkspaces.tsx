import { useEffect, useId, useState } from "react";
import {
  type ConversationStore,
  useConversationMetadata,
} from "../app/conversationStore";
import type { Recap } from "../app/conversations";
import { readRecap } from "../app/conversations";
import type { Workspace } from "../app/snapshot";
import { agentPresentation } from "./agentPresentation";
import { ControlButton, LinkRow } from "./ControlElements";
import { Icon } from "./Icon";
import { WorkspaceActions } from "./WorkspaceActions";
import { relativeRecapAge } from "./RecapCard";
import type { ReturnConversation } from "./ReturnView";
import { StatusMark } from "./Status";
import "./HomeWorkspaces.css";

export type HomeConversation = ReturnConversation & {
  workspaceId: string;
  revision?: string;
};
export type HomeSection = {
  workspace: Workspace;
  open: HomeConversation[];
  done: number;
};
export function homeSections(
  workspaces: Workspace[],
  conversations: HomeConversation[],
): HomeSection[] {
  return workspaces
    .map((workspace) => {
      const all = conversations.filter(
        (c) => c.workspaceId === workspace.workspace_id,
      );
      const open = all.filter(
        (c) => c.process !== "confirmed_exited" || c.attention === "new",
      );
      open.sort((a, b) => rank(a) - rank(b));
      return { workspace, open, done: all.length - open.length };
    })
    .sort((a, b) => score(b.open) - score(a.open));
}
function rank(c: HomeConversation): number {
  if (c.attention === "new") return 0;
  const activity = agentPresentation(c).activity;
  return activity === "waiting" ? 1 : activity === "working" ? 2 : 3;
}
function score(items: HomeConversation[]) {
  return items.reduce((sum, c) => sum + [100, 10, 1, 0][rank(c)], 0);
}

export function HomeCard({
  conversation,
  onArchive,
  archiveReason,
  archiveError,
  showArchive = true,
}: {
  conversation: HomeConversation;
  onArchive?: () => void;
  archiveReason?: string;
  archiveError: boolean;
  showArchive?: boolean;
}) {
  const [state, setState] = useState<{
    recap: Recap | null;
    latest_message: string;
  }>();
  const [error, setError] = useState(false);
  const archiveReasonId = useId();
  useEffect(() => {
    let active = true;
    // A native JSONL append changes the token even when the ID is stable.
    void conversation.revision;
    setError(false);
    void readRecap(conversation.id)
      .then((value) => {
        if (active) setState(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [conversation.id, conversation.revision]);
  const activity = agentPresentation(conversation).activity;
  const label =
    conversation.attention === "new"
      ? "Lue vastaus"
      : activity === "waiting"
        ? "Vastaa"
        : "Avaa";
  return (
    <article
      className={`ah-home-card${conversation.attention === "new" ? " ah-home-card-new" : ""}`}
    >
      <div className="ah-home-card-head">
        <LinkRow href={conversation.href}>
          <span
            aria-hidden="true"
            className={`ah-home-dot ah-home-${rank(conversation)}`}
          />
          {conversation.title}
        </LinkRow>
        {!conversation.browserSession && (
          <StatusMark label="Vain luku" kind="read-only" />
        )}
        {state?.recap && (
          <time dateTime={new Date(state.recap.generated_at).toISOString()}>
            {relativeRecapAge(state.recap.generated_at, Date.now())}
          </time>
        )}
        {state?.recap && state.recap.through !== state.latest_message && (
          <span className="ah-home-stale">uusia viestejä</span>
        )}
        {showArchive ? (
          <span title={archiveReason || "Arkistoi"}>
            <ControlButton
              className="ah-home-archive"
              variant="quiet"
              size="micro"
              aria-label="Arkistoi"
              aria-describedby={archiveReason ? archiveReasonId : undefined}
              isDisabled={!onArchive || !!archiveReason}
              onPress={onArchive}
            >
              <Icon name="archive" />
            </ControlButton>
            {archiveReason ? (
              <span id={archiveReasonId} className="ah-visually-hidden">
                {archiveReason}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
      {state?.recap ? (
        <>
          <p className="ah-home-recap">{state.recap.recap}</p>
          <p className="ah-home-next">
            <strong>Seuraavaksi</strong>
            <span>{state.recap.next}</span>
          </p>
        </>
      ) : error ? (
        <p>Katsausta ei voitu lukea</p>
      ) : state && conversation.attention === "new" ? (
        <p className="ah-home-pending">valmistui juuri · katsaus syntyy pian</p>
      ) : null}
      {archiveError && (
        <p className="ah-inline-error" role="alert">
          Arkistointia ei voitu vahvistaa. Päivitä tilanne ennen uutta yritystä.
        </p>
      )}
      {activity === "working" && (
        <p className="ah-home-live">
          Pi työskentelee
          {conversation.liveActivity === "tool.started"
            ? " · käyttää työkalua"
            : conversation.liveActivity === "assistant.delta"
              ? " · kirjoittaa vastausta"
              : ""}
        </p>
      )}
      {(state?.recap ||
        !state ||
        error ||
        conversation.attention !== "new") && (
        <LinkRow className="ah-home-open" href={conversation.href}>
          {label} →
        </LinkRow>
      )}
    </article>
  );
}
function GitLine({ workspace }: { workspace: Workspace }) {
  return (
    <span className="ah-home-git">
      {workspace.git_summary ? (
        <>
          ⑂ {workspace.git_summary.branch}
          {workspace.git_summary.dirty_count > 0 &&
            ` +${workspace.git_summary.dirty_count}`}
        </>
      ) : (
        "Git-tila ei tiedossa"
      )}
    </span>
  );
}
export function HomeWorkspaces({
  workspaces,
  conversations,
  store,
  onNew,
  onWorkspaceAction,
  onCreate,
  onArchive,
  archiveReason,
}: {
  workspaces: Workspace[];
  conversations: HomeConversation[];
  store?: ConversationStore;
  onNew?: (id: string) => void;
  onWorkspaceAction?: (id: string, action: "rename" | "hide") => void;
  onCreate?: () => void;
  onArchive?: (id: string) => Promise<boolean>;
  archiveReason?: (conversation: HomeConversation) => string;
}) {
  const [archiveErrorId, setArchiveErrorId] = useState<string | null>(null);
  const [archivePendingId, setArchivePendingId] = useState<string | null>(null);
  const metadata = useConversationMetadata(store);
  conversations = conversations.map((c) => ({
    ...c,
    command: metadata.staleStatuses.has(c.id)
      ? c.command
      : (metadata.statuses.get(c.id)?.state ?? c.command),
    pendingQuestion:
      !metadata.staleStatuses.has(c.id) &&
      (!!metadata.statuses.get(c.id)?.pending_question || !!c.pendingQuestion),
    attention: metadata.attention.get(c.id) ?? c.attention,
  }));
  const sections = homeSections(workspaces, conversations);
  const waiting = conversations.filter(
    (c) => c.attention === "new" || agentPresentation(c).activity === "waiting",
  ).length;
  const working = conversations.filter(
    (c) => agentPresentation(c).activity === "working",
  ).length;
  return (
    <div className="ah-home">
      <header className="ah-home-head">
        <div>
          <h1>Työtilat</h1>
          <p>
            {workspaces.length} työtilaa · {waiting} odottaa sinua · {working}{" "}
            käynnissä
          </p>
        </div>
        <ControlButton
          type="button"
          className="ah-home-primary"
          onClick={onCreate}
          isDisabled={!onCreate}
        >
          Uusi työtila
        </ControlButton>
      </header>
      {sections
        .filter((s) => s.open.length)
        .map(({ workspace, open, done }) => (
          <section
            className="ah-home-section"
            key={workspace.workspace_id}
            aria-label={workspace.display_name ?? workspace.name}
          >
            <header className="ah-home-workspace-head">
              <LinkRow
                href={`/workspaces/${workspace.workspace_id}`}
                className="ah-home-name"
              >
                {workspace.display_name ?? workspace.name}
              </LinkRow>
              <GitLine workspace={workspace} />
              <span className="ah-home-grow" />
              {done > 0 && <span>{done} valmista</span>}
              <WorkspaceActions
                workspace={workspace}
                onNew={onNew}
                onRename={
                  onWorkspaceAction
                    ? () => onWorkspaceAction(workspace.workspace_id, "rename")
                    : undefined
                }
                onHide={
                  onWorkspaceAction
                    ? () => onWorkspaceAction(workspace.workspace_id, "hide")
                    : undefined
                }
                settingsAvailable={
                  !!onWorkspaceAction && workspace.mutation_state === "allowed"
                }
              />
            </header>
            <div className="ah-home-grid">
              {open.map((c) => (
                <HomeCard
                  key={c.id}
                  conversation={c}
                  archiveError={archiveErrorId === c.id}
                  archiveReason={
                    archivePendingId === c.id
                      ? "Arkistointi kesken."
                      : (archiveReason?.(c) ??
                        (onArchive ? "" : "Arkistointi ei ole käytettävissä."))
                  }
                  onArchive={
                    onArchive
                      ? () => {
                          setArchiveErrorId(null);
                          setArchivePendingId(c.id);
                          void onArchive(c.id).then((ok) => {
                            setArchivePendingId(null);
                            if (!ok) setArchiveErrorId(c.id);
                          });
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          </section>
        ))}
      {sections.some((s) => !s.open.length) && (
        <section aria-label="Ei avointa työtä">
          <h2>Ei avointa työtä</h2>
          <div className="ah-home-quiet">
            {sections
              .filter((s) => !s.open.length)
              .map(({ workspace, done }) => (
                <div className="ah-home-row" key={workspace.workspace_id}>
                  <LinkRow
                    className="ah-home-name"
                    href={`/workspaces/${workspace.workspace_id}`}
                  >
                    {workspace.display_name ?? workspace.name}
                  </LinkRow>
                  <GitLine workspace={workspace} />
                  <span className="ah-home-grow" />
                  {done ? `${done} valmista` : "ei keskusteluja"}
                  <WorkspaceActions
                    workspace={workspace}
                    onNew={onNew}
                    onRename={
                      onWorkspaceAction
                        ? () =>
                            onWorkspaceAction(workspace.workspace_id, "rename")
                        : undefined
                    }
                    onHide={
                      onWorkspaceAction
                        ? () =>
                            onWorkspaceAction(workspace.workspace_id, "hide")
                        : undefined
                    }
                    settingsAvailable={
                      !!onWorkspaceAction &&
                      workspace.mutation_state === "allowed"
                    }
                  />
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
