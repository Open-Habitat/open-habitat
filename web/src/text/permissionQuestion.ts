import { catalog } from "../i18n";

// The agent asks the person's permission before a call that changes a
// connected account (components/PermissionQuestion.tsx): the question in the
// composer's place, and its line in the conversation.
const fi = {
  asks: "Agentti pyytää lupaa",
  onAccount: (provider: string, address: string) =>
    `${provider}-tilillä ${address}`,
  allow: "Salli",
  deny: "Älä salli",
  stop: "Pysäytä agentti",
  technical: "Tekninen kutsu",
  waiting: "Agentti odottaa lupaasi",
  // The header while the question is open.
  headerWaiting: "Odottaa lupaasi",
  allowed: "Sallit",
  denied: "Et sallinut",
  unavailable: "Et voi vastata tästä näkymästä.",
};

export const permissionQuestionText = catalog(fi, {
  asks: "The agent asks for permission",
  onAccount: (provider, address) => `On the ${provider} account ${address}`,
  allow: "Allow",
  deny: "Don't allow",
  stop: "Stop the agent",
  technical: "Technical call",
  waiting: "The agent is waiting for your permission",
  headerWaiting: "Waiting for your permission",
  allowed: "You allowed",
  denied: "You didn't allow",
  unavailable: "You can't answer from this view.",
});
