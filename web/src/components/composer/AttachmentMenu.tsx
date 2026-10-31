import { type RefObject, useState } from "react";
import { Dialog, DialogTrigger, Popover } from "react-aria-components";
import { useText } from "../../i18n";
import { attachmentMenuText } from "../../text/attachmentMenu";
import { ControlButton } from "../ControlElements";
import { Icon } from "../Icon";
import "./AttachmentMenu.css";

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
  const t = useText(attachmentMenuText);
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
        aria-label={t.add}
        isDisabled={disabled}
      >
        <Icon name="paperclip" />
        <span className="ah-crow-lbl">{t.attach}</span>
      </ControlButton>
      <Popover
        triggerRef={anchorRef}
        placement="top start"
        className="ah-attachment-popover"
        offset={8}
      >
        <Dialog
          aria-modal="true"
          aria-label={t.dialog}
          className="ah-attachment-dialog"
          data-testid="attachment-panel"
        >
          <ControlButton
            size="inline"
            presentation="icon"
            className="ah-attachment-close"
            data-testid="attachment-close"
            aria-label={t.close}
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
              {t.file}
            </ControlButton>
            <p>{t.fileNote}</p>
          </div>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
