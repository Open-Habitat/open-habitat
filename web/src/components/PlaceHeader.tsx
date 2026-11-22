import type { ReactNode } from "react";
import { useText } from "../i18n";
import { placeHeaderText } from "../text/placeHeader";
import { IconButton } from "./ControlElements";
import { Icon } from "./Icon";
import "./PlaceHeader.css";

export function PlaceHeader({
  title,
  children,
  actions,
  onClose,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
}) {
  const t = useText(placeHeaderText);
  return (
    <header className="ah-place-header">
      <div className="ah-place-heading">
        <h1>{title}</h1>
        {children}
      </div>
      {actions ? <div className="ah-place-actions">{actions}</div> : null}
      <IconButton
        data-testid="place-close"
        className="ah-place-close"
        size="row"
        variant="quiet"
        aria-label={t.close}
        title={t.close}
        onPress={onClose}
      >
        <Icon name="cross" />
      </IconButton>
    </header>
  );
}
