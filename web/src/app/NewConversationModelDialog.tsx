import { useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { ControlButton } from "../components/ControlElements";
import { useText } from "../i18n";
import { newConversationModelDialogText } from "../text/newConversationModelDialog";
import { type Choice, PiModelSelector } from "./PiModelSelector";

/** A refused native default needs an explicit choice, not a dead + button. */
export function NewConversationModelDialog({
  csrf,
  onClose,
  onCreate,
}: {
  csrf?: string;
  onClose: () => void;
  onCreate: (choice: Choice) => void;
}) {
  const t = useText(newConversationModelDialogText);
  const [choice, setChoice] = useState<Choice>();
  return (
    <ModalOverlay
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className="ah-overlay"
      isDismissable
    >
      <Modal className="ah-modal">
        <Dialog
          data-testid="new-conversation-model"
          className="ah-dialog"
          aria-label={t.title}
        >
          <Heading slot="title">{t.title}</Heading>
          <p>{t.defaultUnavailable}</p>
          <PiModelSelector csrf={csrf} scope="new" onChoice={setChoice} />
          <div className="ah-dialog-actions">
            <ControlButton
              data-testid="cancel"
              size="page"
              variant="secondary"
              onPress={onClose}
            >
              {t.cancel}
            </ControlButton>
            <ControlButton
              data-testid="conversation-model-start"
              size="page"
              variant="primary"
              isDisabled={!choice || !csrf}
              onPress={() => {
                if (choice) onCreate(choice);
              }}
            >
              {t.start}
            </ControlButton>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
