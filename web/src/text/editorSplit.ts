import { catalog } from "../i18n";

// The editor beside the conversation (components/EditorSplit.tsx): the
// panes, the divider and the strip of a hidden conversation.
const fi = {
  editor: "Editori",
  conversationWidth: "Keskustelun leveys",
  conversationHidden: "Keskustelu piilotettu",
  pixels: (width: number) => `${width} pikseliä`,
  dividerHint:
    "Vedä leveyttä. Nuolet muuttavat, Enter piilottaa tai näyttää keskustelun, kaksoisnapsautus palauttaa.",
  newReply: "Uusi vastaus",
  showConversationState: (state: string) => `Näytä keskustelu (${state})`,
  showConversation: "Näytä keskustelu (Ctrl+Alt+K)",
  conversation: "Keskustelu",
};

export const editorSplitText = catalog(fi, {
  editor: "Editor",
  conversationWidth: "Conversation width",
  conversationHidden: "Conversation hidden",
  pixels: (width) => `${width} pixels`,
  dividerHint:
    "Drag to change the width. Arrow keys resize, Enter hides or shows the conversation, a double click resets.",
  newReply: "New reply",
  showConversationState: (state) => `Show conversation (${state})`,
  showConversation: "Show conversation (Ctrl+Alt+K)",
  conversation: "Conversation",
});
