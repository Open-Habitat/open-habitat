import { useText } from "../i18n";
import { editorHeaderText } from "../text/editorHeader";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";

/** Editor-local actions stay reachable even when the conversation is hidden. */
export function EditorHeader({
  title = "VS Code",
  collapsed,
  onToggleCollapsed,
  onClose,
}: {
  title?: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onClose: () => void;
}) {
  const t = useText(editorHeaderText);
  const Title = collapsed ? "h1" : "h2";
  return (
    <header className="ah-editor-header" data-testid="editor-header">
      <Title>{title}</Title>
      <span className="ah-editor-controls">
        <ControlButton
          data-testid="hide-conversation"
          size="row"
          variant="quiet"
          aria-label={collapsed ? t.sideBySide : t.fullWindow}
          title={collapsed ? t.sideBySideHint : t.fullWindow}
          aria-pressed={collapsed}
          onPress={onToggleCollapsed}
        >
          <Icon name={collapsed ? "back" : "forward"} />
        </ControlButton>
        <ControlButton
          data-testid="close-editor"
          size="row"
          variant="quiet"
          aria-label={t.close}
          title={t.close}
          onPress={onClose}
        >
          <Icon name="cross" />
        </ControlButton>
      </span>
    </header>
  );
}
