import { type RefObject, useState } from "react";
import { Dialog, DialogTrigger, Popover } from "react-aria-components";
import { ControlButton } from "../ControlElements";
import { Icon } from "../Icon";

/** The opener restores focus after dismissing the attachment dialog. */
export function AttachmentMenu({
  disabled,
  onAttach,
  anchorRef,
}: {
  disabled: boolean;
  onAttach: () => void;
  anchorRef?: RefObject<HTMLDivElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const attach = () => {
    setOpen(false);
    onAttach();
  };
  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <ControlButton
        size="inline"
        data-testid="attach-file"
        className="ah-crow-btn"
        aria-label="Lisää liite"
        isDisabled={disabled}
      >
        <Icon name="paperclip" />
        <span className="ah-crow-lbl">Liitä</span>
      </ControlButton>
      <Popover
        triggerRef={anchorRef}
        placement="top start"
        className="ah-attachment-popover"
        offset={8}
      >
        <Dialog
          aria-modal="true"
          aria-label="Lisää keskusteluun"
          className="ah-attachment-dialog"
          data-testid="attachment-panel"
        >
          <ControlButton
            size="inline"
            presentation="icon"
            className="ah-attachment-close"
            data-testid="attachment-close"
            aria-label="Sulje liitevalikko"
            onPress={() => setOpen(false)}
          >
            ×
          </ControlButton>
          <div className="ah-attachment-choices">
            <ControlButton
              size="row"
              data-testid="attachment-single"
              onPress={attach}
            >
              Tiedosto liitteenä…
            </ControlButton>
            <p>Liite lähettää valitsemasi tiedoston.</p>
          </div>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
