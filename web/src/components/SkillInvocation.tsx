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

/** Only an existing introductory paragraph is a description, never a generated
 * summary or a lookup of the currently installed skill's frontmatter. */
export function skillDescription(instruction: string): string | undefined {
  const paragraphs = instruction.trim().split(/\n\s*\n/);
  const first = paragraphs[0]?.startsWith("#") ? paragraphs[1] : paragraphs[0];
  if (!first || /^(?:[#>`~]|[-*+] |\d+\.)/.test(first)) return undefined;
  const plain = first
    .replace(/<[^>]*>/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain
    ? plain.length > 240
      ? `${plain.slice(0, 240)}…`
      : plain
    : undefined;
}

export function SkillInvocation({
  name,
  preview,
  children,
}: {
  name: string;
  preview: string;
  children: ReactNode;
}) {
  return (
    <DialogTrigger>
      <ControlButton
        size="row"
        variant="secondary"
        className="ah-skill-chip"
        data-testid="skill-chip"
        title="Näytä taidon ohje"
      >
        <span>{skillDescription(preview) ?? "Näytä taidon ohje"}</span>
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
            aria-label={`Taidon ohje: ${name}`}
            data-testid="skill-panel"
          >
            {({ close }) => (
              <GuideArticle
                title={name}
                eyebrow="TAIDON OHJE"
                onBack={close}
                backLabel="← Takaisin keskusteluun"
                action={
                  <ControlButton
                    size="row"
                    variant="secondary"
                    data-testid="skill-close"
                    onPress={close}
                  >
                    Sulje
                  </ControlButton>
                }
              >
                <section data-testid="skill-instruction">
                  <p>
                    Tämä on kutsuhetken tallennettu ohje, ei nykyinen
                    taitotiedosto.
                  </p>
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
