import {
  Dialog,
  DialogTrigger,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { useText } from "../../i18n";
import { goalChipText } from "../../text/goalChip";
import { ControlButton } from "../ControlElements";
import { GuideArticle } from "../GoalGuide";
import { Icon } from "../Icon";
import "../SkillInvocation.css";
import "./GoalChip.css";

/** A start-page goal whose skill the composer shows as a chip: its native
 * skill name, the goal's title and the authored request for reading. */
export type ComposerGoal = { skill: string; title: string; request: string };

/**
 * The chip is how the field shows a draft that begins with a goal's
 * `/skill:name `; there is no separate state. The draft stays exactly what Pi
 * receives, so a sent goal is Pi's own skill invocation and the field edits
 * only the text after it. A typed invocation of the same skill gets the chip
 * too once its space is written.
 */
export function splitGoal(
  text: string,
  goals?: ComposerGoal[],
): { goal?: ComposerGoal; text: string } {
  const match = /^\/skill:(\S+) /.exec(text);
  const goal = match ? goals?.find((g) => g.skill === match[1]) : undefined;
  return goal && match ? { goal, text: text.slice(match[0].length) } : { text };
}

export function joinGoal(goal: ComposerGoal | undefined, text: string) {
  return goal ? `/skill:${goal.skill} ${text}` : text;
}

/** Muokkaa tekstinä: the request as ordinary editable text, without the
 * skill. A request already written in the field is not repeated. */
export function unwrapGoal(goal: ComposerGoal, text: string) {
  if (text.startsWith(goal.request)) return text;
  return `${goal.request}\n\n${text}`;
}

export function GoalChip({
  goal,
  onRemove,
  onUnwrap,
}: {
  goal: ComposerGoal;
  onRemove?: () => void;
  onUnwrap?: () => void;
}) {
  const t = useText(goalChipText);
  return (
    <div className="ah-goal-chip-row">
      <div className="ah-goal-chip" data-testid="goal-chip">
        <DialogTrigger>
          <ControlButton
            size="row"
            variant="quiet"
            className="ah-goal-chip-open"
            data-testid="goal-chip-open"
            aria-label={t.open(goal.title)}
            title={t.openTip}
          >
            <Icon name="run" />
            <span className="ah-goal-chip-title">{goal.title}</span>
          </ControlButton>
          <ModalOverlay className="ah-overlay ah-skill-overlay" isDismissable>
            <Modal className="ah-skill-sheet">
              <Dialog
                className="ah-skill-reader ah-goal-chip-reader"
                aria-label={t.card(goal.title)}
                data-testid="goal-chip-card"
              >
                {({ close }) => (
                  <GuideArticle
                    title={goal.title}
                    eyebrow={t.eyebrow(goal.skill)}
                    onBack={close}
                    backLabel={t.back}
                  >
                    <section>
                      <h3>{t.request}</h3>
                      <pre
                        className="ah-guide-prompt"
                        // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users must scroll the bounded full request.
                        tabIndex={0}
                        data-testid="goal-chip-request"
                      >
                        {goal.request}
                      </pre>
                      <p className="ah-goal-chip-note">{t.note}</p>
                    </section>
                    <footer className="ah-guide-actions">
                      {onUnwrap ? (
                        <ControlButton
                          size="row"
                          variant="secondary"
                          data-testid="goal-chip-unwrap"
                          onPress={() => {
                            close();
                            onUnwrap();
                          }}
                        >
                          <Icon name="pencil" />
                          {t.unwrap}
                        </ControlButton>
                      ) : null}
                      <ControlButton size="row" variant="quiet" onPress={close}>
                        {t.close}
                      </ControlButton>
                    </footer>
                  </GuideArticle>
                )}
              </Dialog>
            </Modal>
          </ModalOverlay>
        </DialogTrigger>
        {onRemove ? (
          <ControlButton
            size="inline"
            variant="quiet"
            presentation="icon"
            className="ah-goal-chip-remove"
            data-testid="goal-chip-remove"
            aria-label={t.remove(goal.title)}
            title={t.removeTip}
            onPress={onRemove}
          >
            <Icon name="cross" />
          </ControlButton>
        ) : null}
      </div>
    </div>
  );
}
