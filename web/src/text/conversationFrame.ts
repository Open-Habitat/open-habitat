import { catalog } from "../i18n";

// The conversation's frame (components/ConversationFrame.tsx) and the
// model picker of a new conversation (components/ComposerModelPicker.tsx).
const fi = {
  conversation: "Keskustelu",
  newConversationModel: "Uuden keskustelun malli",
};

export const conversationFrameText = catalog(fi, {
  conversation: "Conversation",
  newConversationModel: "Model for the new conversation",
});
