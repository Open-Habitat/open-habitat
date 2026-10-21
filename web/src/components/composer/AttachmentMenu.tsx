import { useContext, useEffect, useRef, useState } from "react";
import { Dialog, DialogTrigger, Popover } from "react-aria-components";
import { ControlButton } from "../ControlElements";
import { Icon } from "../Icon";
import { LocalFolder, LocalFolderContext } from "../LocalFolder";

/** One opener owns focus restoration for both the attachment choices and help. */
export function AttachmentMenu({
  disabled,
  onAttach,
}: {
  disabled: boolean;
  onAttach: () => void;
}) {
  const folder = useContext(LocalFolderContext);
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (help) dialog.current?.focus();
  }, [help]);
  const attach = () => {
    setOpen(false);
    onAttach();
  };
  return (
    <DialogTrigger
      isOpen={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setHelp(false);
      }}
    >
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
        placement="top start"
        className="ah-attachment-popover"
        offset={8}
      >
        <Dialog
          ref={dialog}
          aria-modal="true"
          aria-label={help ? "Oman koneen kansio" : "Lisää keskusteluun"}
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
          {help && folder ? (
            <LocalFolder view={folder} onAttach={attach} />
          ) : (
            <div className="ah-attachment-choices">
              <ControlButton
                size="row"
                data-testid="attachment-single"
                onPress={attach}
              >
                Tiedosto liitteenä…
              </ControlButton>
              {folder ? (
                <ControlButton
                  size="row"
                  data-testid="attachment-folder"
                  onPress={() => setHelp(true)}
                >
                  Oman koneen kansio…
                </ControlButton>
              ) : null}
              <p>
                Liite lähettää valitsemasi tiedoston. Kansio sallii agentin
                pyytämät haut.
              </p>
            </div>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
