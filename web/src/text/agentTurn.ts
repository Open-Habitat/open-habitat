import { catalog, plural } from "../i18n";

// One agent turn in stages (components/AgentTurn.tsx): reasoning rows, a
// stage's summary and time, the working strip and the stopped end.
const fi = {
  thinkingHidden: "Ajattelu · piilotettu",
  thinkingNow: "Ajattelee",
  thinking: "Ajattelu",
  thinkingTitled: (title: string) => `Ajattelu · ${title}`,
  thoughts: (n: number) => `${n} ${n === 1 ? "ajatus" : "ajatusta"}`,
  tools: (n: number) => `${n} ${n === 1 ? "työkalu" : "työkalua"}`,
  work: "Työ",
  failures: (n: number) => `${n} epäonnistui`,
  hideWork: "Piilota työ",
  showWork: "Näytä työ",
  agentWorking: "Agentti työskentelee",
  workerWorking: "Worker työskentelee",
  stopped: "Keskeytit",
  stoppedRestart: "Katkesi palvelimen uudelleenkäynnistyksessä",
};

export const agentTurnText = catalog(fi, {
  thinkingHidden: "Thinking · hidden",
  thinkingNow: "Thinking",
  thinking: "Thinking",
  thinkingTitled: (title) => `Thinking · ${title}`,
  thoughts: (n) =>
    `${n} ${plural("en", n, { one: "thought", other: "thoughts" })}`,
  tools: (n) => `${n} ${plural("en", n, { one: "tool", other: "tools" })}`,
  work: "Work",
  failures: (n) => `${n} failed`,
  hideWork: "Hide work",
  showWork: "Show work",
  agentWorking: "Agent working",
  workerWorking: "Worker working",
  stopped: "You stopped it",
  stoppedRestart: "Cut off when the server restarted",
});
