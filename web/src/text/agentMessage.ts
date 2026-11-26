import { catalog } from "../i18n";

// Agent messages between the person's conversations
// (components/AgentMessage.tsx, agent-agent-messages, experimental; round
// 2026-11-25-agent-agent-message-4, B Hiljainen). A block says only who it
// is from or to and the message; these are its accessible names and the
// senders that have no conversation name to show.
const fi = {
  from: (name: string) => `Viesti keskustelusta ${name}`,
  to: (name: string) => `Viesti keskusteluun ${name}`,
  quote: (who?: string, time?: string) =>
    who && time
      ? `Lainaus: ${who} klo ${time}. Siirry viestiin.`
      : who
        ? `Lainaus: ${who}. Siirry viestiin.`
        : "Lainaus. Siirry viestiin.",
  thisAgent: "tämä agentti",
  // A participant of the owner's shared conversation: the owner's other
  // titles are private, and the participant could not open the link.
  ownersOther: "Omistajan toinen keskustelu",
  // Sent with the CLI outside any of the person's conversations.
  outside: "Agentti keskustelujesi ulkopuolelta",
};

export const agentMessageText = catalog(fi, {
  from: (name) => `Message from ${name}`,
  to: (name) => `Message to ${name}`,
  quote: (who, time) =>
    who && time
      ? `Quote: ${who} at ${time}. Go to the message.`
      : who
        ? `Quote: ${who}. Go to the message.`
        : "Quote. Go to the message.",
  thisAgent: "this agent",
  ownersOther: "The owner's other conversation",
  outside: "An agent outside your conversations",
});
