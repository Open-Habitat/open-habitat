# text/composerBuiltins.ts

Generated from web/src/text/composerBuiltins.ts; do not edit.

```tsx
import { catalog, formatNumber } from "../i18n";

const fi = {
  compact: "Tiivistä keskustelun aiemmat viestit yhteenvedoksi.",
  new: "Avaa uusi keskustelu tässä työtilassa.",
  busy: "Voit tiivistää, kun agentti odottaa viestiäsi.",
  compacting: "Agentti tiivistää jo keskustelua.",
  unavailable: "Tiivistäminen ei ole nyt käytettävissä.",
  instructionsLong: (limit: number) =>
    `Lyhennä tiivistysohje enintään ${formatNumber(limit)} merkkiin.`,
  instructionsInvalid: "Poista tiivistysohjeesta näkymättömät ohjausmerkit.",
};

export const composerBuiltinsText = catalog(
  fi,
  {
    compact: "Summarize earlier messages to free conversation context.",
    new: "Open a new conversation in this workspace.",
    busy: "You can compact while the agent waits for your message.",
    compacting: "The agent is already compacting the conversation.",
    unavailable: "Compaction is not available right now.",
    instructionsLong: (limit: number) =>
      `Shorten the summary instructions to at most ${formatNumber(limit)} characters.`,
    instructionsInvalid:
      "Remove invisible control characters from the summary instructions.",
  },
  {
    compact: "Summarise earlier messages to free conversation context.",
  },
);

```
