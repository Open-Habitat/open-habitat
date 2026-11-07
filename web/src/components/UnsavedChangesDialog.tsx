import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { useText } from "../i18n";
import { unsavedChangesDialogText } from "../text/unsavedChangesDialog";
import { ControlButton } from "./ControlElements";
import "./UnsavedChangesDialog.css";

/** Leaving the editor saves its text without asking; this window appears
 * only when that save could not be done (proto-own-confirm-dialog, Jari
 * 7.11.2026: direction C, with direction A's window for a failed save). Its
 * buttons say what they do; Esc and a press outside keep editing. */
export function UnsavedChangesDialog({
  reason,
  onDiscard,
  onKeep,
}: {
  /** Why the save failed, in the person's words. */
  reason: string;
  onDiscard: () => void;
  onKeep: () => void;
}) {
  const t = useText(unsavedChangesDialogText);
  return (
    <ModalOverlay
      isOpen
      isDismissable
      className="ah-overlay ah-unsaved-overlay"
      onOpenChange={(open) => {
        if (!open) onKeep();
      }}
    >
      <Modal className="ah-modal ah-unsaved-modal">
        <AriaDialog
          data-testid="unsaved-dialog"
          className="ah-dialog ah-unsaved-dialog"
          role="alertdialog"
          aria-label={t.title}
        >
          <Heading slot="title">{t.title}</Heading>
          <p>{reason}</p>
          <div className="ah-dialog-actions">
            <ControlButton
              data-testid="unsaved-discard"
              size="page"
              variant="danger-subtle"
              onPress={onDiscard}
            >
              {t.discard}
            </ControlButton>
            <ControlButton
              data-testid="unsaved-keep"
              size="page"
              variant="secondary"
              autoFocus
              onPress={onKeep}
            >
              {t.keep}
            </ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
