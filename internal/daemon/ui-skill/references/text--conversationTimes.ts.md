# text/conversationTimes.ts

Generated from web/src/text/conversationTimes.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// Times in a conversation (components/ConversationTimes.tsx): the day
// separator's words and a long turn's duration.
const fi = {
  today: "Tänään",
  yesterday: "Eilen",
  minutes: (n: number) => `${n} min`,
  hours: (h: number, m: number) => (m ? `${h} t ${m} min` : `${h} t`),
  turnTook: (took: string) => `vuoro kesti ${took}`,
};

export const conversationTimesText = catalog(fi, {
  today: "Today",
  yesterday: "Yesterday",
  minutes: (n) => `${n} min`,
  hours: (h, m) => (m ? `${h} h ${m} min` : `${h} h`),
  turnTook: (took) => `the turn took ${took}`,
});

```
