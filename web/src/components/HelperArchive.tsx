import type { ReactNode } from "react";
import { useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { type Spinoff, spinoffStateLabel } from "../app/spinoffs";
import { useText } from "../i18n";
import { helperArchiveText } from "../text/helperArchive";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { WorkerMark } from "./WorkerMark";
import "./HelperArchive.css";

function HelperDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <ModalOverlay
      isOpen
      isDismissable
      className="ah-overlay"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal className="ah-modal">
        <Dialog className="ah-dialog ah-helper-dialog" aria-label={title}>
          <Heading slot="title">{title}</Heading>
          {children}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

export function HelperArchiveRows({
  runs,
  restored = false,
  branchView,
}: {
  runs: Spinoff[];
  restored?: boolean;
  branchView: (run: Spinoff, close: () => void) => ReactNode;
}) {
  const t = useText(helperArchiveText);
  const [branch, setBranch] = useState<Spinoff>();
  return (
    <>
      <ul className="ah-helper-archive-rows">
        {runs.map((run) => {
          const r = run.resident;
          if (!r) return null;
          const working = r.round_state === "working";
          const uncertain =
            !r.unlanded &&
            r.round_state === "waiting" &&
            r.rounds > (r.landed_round ?? 0);
          const branchWork =
            run.state === "unknown" || working || r.unlanded || uncertain;
          return (
            <li key={run.run_id} data-testid="helper-archive-row">
              <WorkerMark
                kind={
                  run.state === "unknown"
                    ? "unknown"
                    : working
                      ? "working"
                      : "waiting_parent"
                }
              />
              <div>
                <strong>{r.name}</strong> · {run.title}
                <p>{spinoffStateLabel(run)}</p>
                {restored && r.report ? (
                  <p data-testid="helper-restore-report">
                    {r.report.split("\n")[0]}
                  </p>
                ) : null}
                <p>
                  <Icon name={branchWork ? "branch" : "check"} />{" "}
                  {run.state === "unknown"
                    ? t.unconfirmed
                    : working
                      ? t.working(r.rounds + 1)
                      : r.unlanded
                        ? t.unlanded(r.rounds)
                        : uncertain
                          ? t.unconfirmed
                          : t.landed}
                  {branchWork ? (
                    <>
                      {" "}
                      <ControlButton
                        size="inline"
                        variant="quiet"
                        data-testid="helper-archive-branch"
                        onPress={() => setBranch(run)}
                      >
                        {t.branch}
                      </ControlButton>
                    </>
                  ) : null}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {branch ? branchView(branch, () => setBranch(undefined)) : null}
    </>
  );
}

export function HelperBranchDialog({
  branch,
  loading,
  onClose,
}: {
  branch?: Spinoff;
  loading: boolean;
  onClose: () => void;
}) {
  const t = useText(helperArchiveText);
  return (
    <HelperDialog title={t.branchTitle} onClose={onClose}>
      {loading ? (
        <p role="status">{t.loading}</p>
      ) : branch?.branch ? (
        <>
          <p>
            <Icon name="branch" />{" "}
            <code data-testid="helper-branch-name">{branch.branch}</code>
          </p>
          <dl>
            <dt>{t.source}</dt>
            <dd>
              <code>{branch.source_branch}</code>
            </dd>
            <dt>{t.worktree}</dt>
            <dd>
              <code>{branch.worktree}</code>
            </dd>
          </dl>
        </>
      ) : (
        <p role="status">{t.branchUnavailable}</p>
      )}
      <ControlButton size="row" variant="quiet" onPress={onClose}>
        {t.close}
      </ControlButton>
    </HelperDialog>
  );
}

export function HelperArchiveConfirm({
  title,
  runs,
  incomplete,
  onAnswer,
  branchView,
}: {
  runs: Spinoff[];
  incomplete: boolean;
  title: string;
  branchView: (run: Spinoff, close: () => void) => ReactNode;
  onAnswer: (yes: boolean) => void;
}) {
  const t = useText(helperArchiveText);
  return (
    <HelperDialog title={t.title} onClose={() => onAnswer(false)}>
      <div data-testid="helper-archive-confirm">
        <p>
          <strong>{title}</strong>
        </p>
        <p>{incomplete ? t.unavailable : t.lead}</p>
        <HelperArchiveRows runs={runs} branchView={branchView} />
        <p>{t.rule}</p>
        <div className="ah-dialog-actions">
          <ControlButton
            autoFocus
            size="row"
            variant="quiet"
            data-testid="helper-archive-cancel"
            onPress={() => onAnswer(false)}
          >
            {t.cancel}
          </ControlButton>
          <ControlButton
            size="row"
            variant="primary"
            data-testid="helper-archive-accept"
            onPress={() => onAnswer(true)}
          >
            {t.archive}
          </ControlButton>
        </div>
      </div>
    </HelperDialog>
  );
}
