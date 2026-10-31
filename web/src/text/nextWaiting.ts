import { catalog, plural } from "../i18n";

// The round through what waits for the person: the dock's step states
// (app/NextWaitingDock.tsx) and what the round says (app/nextWaiting.ts).
const fi = {
  asks: "kysyy",
  newReply: "uusi vastaus",
  elsewhere: "toisaalla",
  roundDone: (n: number) => `Kierros käyty: ${n} hoidettu.`,
  handledElsewhere: (title: string) => `${title} hoidettiin toisaalla.`,
};

export const nextWaitingText = catalog(fi, {
  asks: "asks",
  newReply: "new reply",
  elsewhere: "elsewhere",
  roundDone: (n) =>
    `Round done: ${n} ${plural("en", n, { one: "item", other: "items" })} handled.`,
  handledElsewhere: (title) => `${title} was handled elsewhere.`,
});
