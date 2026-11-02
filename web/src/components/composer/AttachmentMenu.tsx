import { useText } from "../../i18n";
import { attachmentMenuText } from "../../text/attachmentMenu";
import { ControlButton } from "../ControlElements";
import { Icon } from "../Icon";

export function AttachmentMenu({
  disabled,
  onAttach,
}: {
  disabled: boolean;
  onAttach: () => void;
}) {
  const t = useText(attachmentMenuText);
  return (
    <ControlButton
      size="inline"
      data-testid="attach-file"
      className="ah-crow-btn"
      aria-label={t.add}
      isDisabled={disabled}
      onPress={onAttach}
    >
      <Icon name="paperclip" />
      <span className="ah-crow-lbl">{t.attach}</span>
    </ControlButton>
  );
}
