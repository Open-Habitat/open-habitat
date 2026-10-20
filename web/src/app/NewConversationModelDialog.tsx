import { useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { ControlButton } from "../components/ControlElements";
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
        <Dialog className="ah-dialog" aria-label="Malli uudelle keskustelulle">
          <Heading slot="title">Malli uudelle keskustelulle</Heading>
          <p>
            Agentin oletusmalli ei ole käytettävissä. Valitse toinen malli.
            Oletusta ei muuteta.
          </p>
          <PiModelSelector csrf={csrf} scope="new" onChoice={setChoice} />
          <div className="ah-dialog-actions">
            <ControlButton size="page" variant="secondary" onPress={onClose}>
              Peruuta
            </ControlButton>
            <ControlButton
              size="page"
              variant="primary"
              isDisabled={!choice || !csrf}
              onPress={() => {
                if (choice) onCreate(choice);
              }}
            >
              Aloita keskustelu valitulla mallilla
            </ControlButton>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
