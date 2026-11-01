# text/skillInvocation.ts

Generated from web/src/text/skillInvocation.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// A skill call in a conversation and its recorded instructions
// (components/SkillInvocation.tsx).
const fi = {
  show: "Näytä taidon ohje",
  instructionsOf: (name: string) => `Taidon ohje: ${name}`,
  eyebrow: "TAIDON OHJE",
  back: "← Takaisin keskusteluun",
  close: "Sulje",
  recorded: "Tämä on kutsuhetken tallennettu ohje, ei nykyinen taitotiedosto.",
};

export const skillInvocationText = catalog(fi, {
  show: "Show the skill's instructions",
  instructionsOf: (name) => `Skill instructions: ${name}`,
  eyebrow: "SKILL INSTRUCTIONS",
  back: "← Back to the conversation",
  close: "Close",
  recorded:
    "These are the instructions as recorded when the skill was called, not the current skill file.",
});

```
