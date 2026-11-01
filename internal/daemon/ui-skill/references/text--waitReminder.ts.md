# text/waitReminder.ts

Generated from web/src/text/waitReminder.ts; do not edit.

```tsx
import { catalog, plural } from "../i18n";

// The marker of Habitat's turn-end reminder about unwaited workers
// (components/WaitReminder.tsx).
const fi = {
  reminded: (count: number) =>
    count === 1
      ? "Habitat muistutti agenttia: kukaan ei odota workeria"
      : `Habitat muistutti agenttia: kukaan ei odota ${count} workeria`,
  more: (n: number) => `ja ${n} muuta`,
};

export const waitReminderText = catalog(fi, {
  reminded: (count) =>
    count === 1
      ? "Habitat reminded the agent: nobody is waiting for a worker"
      : `Habitat reminded the agent: nobody is waiting for ${count} workers`,
  more: (n) => `and ${n} ${plural("en", n, { one: "other", other: "others" })}`,
});

```
