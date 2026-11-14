import type { ComponentProps } from "react";
import type { WorkerPullRequest } from "../app/spinoffWork";
import { useText } from "../i18n";
import { spinoffsText } from "../text/spinoffs";
import { ContextRing, type ContextUsage } from "./ContextRing";
import { ControlButton, controlClassName } from "./ControlElements";
import {
  GitStatusChip,
  GitStatusDetails,
  type GitSummaryFacts,
} from "./GitStatus";
import { Icon } from "./Icon";

// The worker view's header facts (worker-header-status; direction 1
// "Otsikkorivillä" of the 2026-11-13 worker-header round, Jari 13.11.2026):
// the worker's Git changes, pull request, context and model sit on the title
// row in the place and order a conversation has them. Model and ring are
// read only: they open the worker's details, never a picker. A fact the host
// could not give is omitted for model/context; Git keeps its explanation.

/** The worker's Git as the application layer read it. */
export type WorkerGitView =
  | {
      state: "known";
      facts: GitSummaryFacts;
      /** The run landed and its branch is all in the base. */
      merged: boolean;
      path?: string;
      open: boolean;
      onOpenChange: (open: boolean) => void;
      details: Omit<
        ComponentProps<typeof GitStatusDetails>,
        "summary" | "path" | "fetchUnavailable"
      >;
    }
  | { state: "reading" | "unknown" | "landed"; branch?: string };

/** A fact the host could not give: "?" and why, opening the details. */
function UnknownChip({
  testId,
  className,
  sentence,
  value,
  phoneSummary,
  onPress,
  children,
}: {
  testId: string;
  className: string;
  sentence: string;
  value: string;
  phoneSummary?: string;
  onPress: () => void;
  children?: React.ReactNode;
}) {
  const txt = useText(spinoffsText);
  return (
    <ControlButton
      data-testid={testId}
      data-unknown
      data-menu-summary={sentence}
      data-phone-summary={phoneSummary}
      size="inline"
      presentation="pill"
      className={`${className} ah-worker-unknown`}
      aria-label={`${sentence} ${txt.header.openDetails}`}
      title={sentence}
      onPress={onPress}
    >
      {children}
      <span className="ah-gs-counts">{value}</span>
    </ControlButton>
  );
}

/** Git: production's chip and layer when the worktree or branch answered. */
export function WorkerGit({
  git,
  source,
  branchOnly,
  onUnknown,
}: {
  git: WorkerGitView;
  source?: string;
  /** No worktree reading can come: the counts are from the branch. */
  branchOnly: boolean;
  onUnknown: () => void;
}) {
  const txt = useText(spinoffsText);
  if (git.state !== "known") {
    const sentence =
      git.state === "reading"
        ? txt.header.gitReading
        : git.state === "landed"
          ? txt.header.gitLanded(source)
          : txt.header.gitUnknown;
    return (
      <UnknownChip
        testId="git-chip"
        className="ah-gs-chip ah-gs-worktree"
        sentence={sentence}
        value={txt.header.unknownValue}
        phoneSummary={txt.header.unknownValue}
        onPress={onUnknown}
      >
        <Icon name={git.state === "landed" ? "merge" : "worktree"} />
      </UnknownChip>
    );
  }
  return (
    <GitStatusChip
      facts={git.facts}
      open={git.open}
      onOpenChange={git.onOpenChange}
      worktree={{ merged: git.merged }}
    >
      <GitStatusDetails
        summary={git.facts}
        path={git.path}
        fetchUnavailable={txt.header.gitFetch}
        filesNote={branchOnly ? txt.header.gitBranchOnly : undefined}
        {...git.details}
      />
    </GitStatusChip>
  );
}

/** The pull request, when gh found one: a link out beside Git. */
export function WorkerPr({ pr }: { pr?: WorkerPullRequest }) {
  const txt = useText(spinoffsText);
  if (!pr) return null;
  const { passed, failed, pending } = pr.checks;
  return (
    <a
      data-testid="worker-pr"
      data-state={pr.state}
      className={`${controlClassName({ size: "inline", presentation: "pill", variant: "quiet" })} ah-worker-pr`}
      href={pr.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${txt.header.prOpen(pr.number)} ${txt.header.prChecks(passed, failed, pending)}`}
    >
      <Icon name="github" />
      <span>{txt.header.pr(pr.number)}</span>
      <span className="ah-worker-pr-state">{txt.header.prState[pr.state]}</span>
    </a>
  );
}

/** Words for the pull request in the worker's details. */
export function prFact(
  pr: WorkerPullRequest,
  words: {
    pr: (n: number) => string;
    prState: Record<WorkerPullRequest["state"], string>;
    prChecks: (passed: number, failed: number, pending: number) => string;
  },
) {
  const { passed, failed, pending } = pr.checks;
  return `${words.pr(pr.number)} · ${words.prState[pr.state]} · ${words.prChecks(passed, failed, pending)}`;
}

/** The ring, read only: it opens the worker's details. */
export function WorkerContext({
  usage,
  open,
  onToggle,
}: {
  usage?: ContextUsage;
  open: boolean;
  onToggle: () => void;
}) {
  const txt = useText(spinoffsText);
  if (
    usage &&
    (usage.phase === "compacting" ||
      (usage.phase === "known" && usage.tokens !== undefined))
  )
    return (
      <ContextRing
        usage={usage}
        open={open}
        onToggle={onToggle}
        action={txt.header.openDetails}
      />
    );
  return null;
}

/** A known model opens the worker's details, never a picker. */
export function WorkerModel({
  name,
  words,
  open,
  onToggle,
}: {
  /** The model's display name, when the worker's session named it. */
  name?: string;
  /** Model and thinking level, for the tooltip and the phone's facts. */
  words?: string;
  open: boolean;
  onToggle: () => void;
}) {
  const txt = useText(spinoffsText);
  if (!name) return null;
  const sentence = words ?? name;
  return (
    <ControlButton
      data-testid="worker-model"
      data-menu-summary={sentence}
      size="inline"
      presentation="pill"
      className="ah-set-chip ah-set-compact"
      aria-label={`${sentence} ${txt.header.openDetails}`}
      aria-expanded={open}
      title={sentence}
      onPress={onToggle}
    >
      <span className="ah-set-model">{name}</span>
    </ControlButton>
  );
}
