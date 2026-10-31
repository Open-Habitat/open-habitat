import { liveText } from "../i18n";
import { agentTitleText } from "../text/agentTitle";
import type { Agent } from "./snapshot";

const txt = liveText(agentTitleText);

/** What a conversation is called. One nobody has named yet carries the
 * daemon's placeholder, which the browser words in the person's language. */
export function agentTitle(title: Agent["title"]) {
  return title.source === "new_conversation"
    ? txt.newConversation
    : title.display;
}
