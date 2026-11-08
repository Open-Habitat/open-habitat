import { useState } from "react";
import {
  conversationWeight,
  type ConversationWeight as Weight,
} from "../app/largeContent";
import { useText } from "../i18n";
import { conversationWeightText } from "../text/conversationWeight";
import { largeContentText } from "../text/largeContent";
import { ControlButton } from "./ControlElements";
import { WarningBanner } from "./WarningBanner";

// The near warning is said once: dismissed, it stays away for this
// conversation until the page is loaded again. It is view state, not a
// preference, so it is kept in memory only.
const dismissed = new Set<string>();

/** One warning as a conversation grows large, and past the advised size
 * the offer to continue in a new conversation (Jari 8.11.2026, direction C:
 * no standing meter, a word only where it matters). */
export function ConversationWeight({
  agentId,
  bytes,
  onNewConversation,
}: {
  agentId: string;
  /** The conversation's size from the snapshot. */
  bytes: number | undefined;
  onNewConversation: () => void;
}) {
  const t = useText(conversationWeightText);
  const sizes = useText(largeContentText);
  const [, setDismissals] = useState(0);
  const weight: Weight | undefined = conversationWeight(bytes);
  if (!weight || !bytes) return null;
  if (weight === "near" && dismissed.has(agentId)) return null;
  const size = sizes.size(bytes);
  const heavy = weight === "heavy";
  return (
    <WarningBanner
      data-testid="conversation-weight"
      data-state={weight}
      tone="neutral"
      icon="warning"
      title={heavy ? t.heavyTitle : t.nearTitle}
      short={heavy ? t.heavyShort(size) : t.nearShort(size)}
      actions={
        <>
          <ControlButton
            data-testid="conversation-weight-new"
            size="row"
            variant={heavy ? "primary" : "secondary"}
            onPress={onNewConversation}
          >
            {t.newConversation}
          </ControlButton>
          {heavy ? null : (
            <ControlButton
              data-testid="conversation-weight-dismiss"
              size="row"
              variant="quiet"
              onPress={() => {
                dismissed.add(agentId);
                setDismissals((n) => n + 1);
              }}
            >
              {t.dismiss}
            </ControlButton>
          )}
        </>
      }
    >
      {heavy ? t.heavy(size) : t.near(size)}
    </WarningBanner>
  );
}
