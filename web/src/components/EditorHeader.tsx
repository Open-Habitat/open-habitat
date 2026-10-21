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
  const Title = collapsed ? "h1" : "h2";
  return (
    <header className="ah-editor-header" data-testid="editor-header">
      <Title>{title}</Title>
      <span className="ah-editor-controls">
        <ControlButton
          data-testid="hide-conversation"
          size="row"
          variant="quiet"
          aria-label={
            collapsed ? "Palauta rinnakkain" : "Editori koko ikkunaan"
          }
          title={
            collapsed
              ? "Palauta keskustelu editorin viereen"
              : "Editori koko ikkunaan"
          }
          aria-pressed={collapsed}
          onPress={onToggleCollapsed}
        >
          <Icon name={collapsed ? "back" : "forward"} />
        </ControlButton>
        <ControlButton
          data-testid="close-editor"
          size="row"
          variant="quiet"
          aria-label="Sulje editori"
          title="Sulje editori"
          onPress={onClose}
        >
          <Icon name="cross" />
        </ControlButton>
      </span>
    </header>
  );
}
