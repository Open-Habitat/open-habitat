import instructions from "../../../internal/daemon/start-page-skill/SKILL.md?raw";
import type { ComposerGoal } from "../components/composer/GoalChip";
import { goalDraft } from "../components/StartHere";
import { liveText } from "../i18n";
import { startPageRequestText } from "../text/startPageRequest";

const t = liveText(startPageRequestText);
export const startPageSkill = "open-habitat-start-page";
export function startPageGoal(update = false): ComposerGoal {
  return {
    skill: startPageSkill,
    title: update ? t.update : t.create,
    request: instructions.replace(/^---\n[\s\S]*?\n---\n/, "").trim(),
    placeholder: t.placeholder,
  };
}
export function startPageDraft(draft = "", update = false) {
  if (draft.startsWith(`/skill:${startPageSkill} `)) {
    return {
      text: draft,
      selectionStart: draft.endsWith(t.placeholder)
        ? draft.length - t.placeholder.length
        : draft.length,
      selectionEnd: draft.length,
    };
  }
  return goalDraft(
    {
      skill: startPageSkill,
      title: update ? t.update : t.create,
      when: "",
      what: "",
      steps: [],
      prompt: `${update ? t.updateSentence : t.sentence}\n${t.placeholder}`,
    },
    draft,
  );
}
