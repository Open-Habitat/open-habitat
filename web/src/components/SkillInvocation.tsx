import type { ReactNode } from "react";
import {
  Dialog,
  DialogTrigger,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { ControlButton } from "./ControlElements";
import { GuideArticle } from "./GoalGuide";
import "./SkillInvocation.css";
import { useText } from "../i18n";
import { skillInvocationText } from "../text/skillInvocation";
import { startPageRequestText } from "../text/startPageRequest";

export function SkillInvocation({
  name,
  description,
  children,
}: {
  name: string;
  description?: string;
  children: ReactNode;
}) {
  const t = useText(skillInvocationText);
  const startPage = useText(startPageRequestText);
  const builtin = name === "open-habitat-start-page";
  const title = builtin ? startPage.title : name;
  const detail = builtin ? startPage.description : description;
  return (
    <DialogTrigger>
      <ControlButton
        size="row"
        variant="secondary"
        className="ah-skill-chip"
        data-testid="skill-chip"
        title={t.show}
      >
        <span className="ah-skill-chip-label">
          <span className={builtin ? undefined : "ah-skill-name"}>{title}</span>
          {detail && (
            <span>
              {detail.length > 240 ? `${detail.slice(0, 240)}…` : detail}
            </span>
          )}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
        >
          <path d="m9 5 7 7-7 7" />
        </svg>
      </ControlButton>
      <ModalOverlay className="ah-overlay ah-skill-overlay" isDismissable>
        <Modal className="ah-skill-sheet">
          <Dialog
            className="ah-skill-reader"
            aria-label={t.instructionsOf(title)}
            data-testid="skill-panel"
          >
            {({ close }) => (
              <GuideArticle
                title={title}
                eyebrow={t.eyebrow}
                onBack={close}
                backLabel={t.back}
                action={
                  <ControlButton
                    size="row"
                    variant="secondary"
                    data-testid="skill-close"
                    onPress={close}
                  >
                    {t.close}
                  </ControlButton>
                }
              >
                <section data-testid="skill-instruction">
                  <p>{t.recorded}</p>
                  {children}
                </section>
              </GuideArticle>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
