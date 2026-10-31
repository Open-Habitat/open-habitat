import { useState } from "react";
import { Dialog, DialogTrigger, Heading, Popover } from "react-aria-components";
import { useNavigate } from "react-router";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import "./WorkspaceIcon.css";
import { liveText } from "../i18n";
import { statusText } from "../text/status";

const txt = liveText(statusText);

/** A workspace's icon as the app resolved it (workspace-icons,
 * experimental): what to show, the name-derived glyph that stands in when
 * there is nothing else or an image does not load, and where it came from
 * in words. */
export type WorkspaceIconModel = {
  name: string;
  glyph: { letters: string; hue: number };
  show:
    | { kind: "emoji"; value: string }
    | { kind: "image"; src: string }
    | { kind: "glyph" };
  source: string;
  /** The file the icon came from, shown as a path; absent when derived. */
  where?: string;
};

/** The icon itself, decoration: the row or the button beside it says the
 * workspace's name. `size` is the rail's 16 px, the strip's 22 px or the
 * card's 40 px. */
export function WorkspaceIcon({
  icon,
  size = "s",
}: {
  icon: WorkspaceIconModel;
  size?: "s" | "m" | "l";
}) {
  const [broken, setBroken] = useState<string>();
  const show =
    icon.show.kind === "image" && broken === icon.show.src
      ? ({ kind: "glyph" } as const)
      : icon.show;
  return (
    <span
      className="ah-wsi"
      data-size={size}
      data-kind={show.kind}
      data-testid="workspace-icon"
      aria-hidden="true"
      style={
        show.kind === "glyph"
          ? ({
              "--ah-wsi-hue": `var(--ah-glyph-${icon.glyph.hue})`,
            } as React.CSSProperties)
          : undefined
      }
    >
      {show.kind === "emoji" ? (
        show.value
      ) : show.kind === "image" ? (
        /* biome-ignore lint/a11y/noNoninteractiveElementInteractions: An image that does not load falls back to the glyph. */
        <img
          alt=""
          src={show.src}
          draggable={false}
          onError={() => setBroken(show.src)}
        />
      ) : (
        icon.glyph.letters
      )}
    </span>
  );
}

/** What the icon's card offers besides the name and the source. */
export type WorkspaceCardActions = {
  /** Starts a conversation in the workspace; absent when none can start. */
  onNew?: (workspaceId: string) => void;
  /** Why a conversation cannot start now ("" or absent when it can). */
  newReason?: (workspaceId: string) => string | undefined;
};

/** The icon before a rail row, as its own button (Lähdeketju): it opens a
 * card with the workspace's whole name, where the icon came from, and the
 * workspace's page and a new conversation. On a phone the card is a sheet. */
export function WorkspaceIconButton({
  icon,
  workspaceId,
  actions,
}: {
  icon: WorkspaceIconModel;
  workspaceId: string;
  actions?: WorkspaceCardActions;
}) {
  const navigate = useNavigate();
  const reason = actions?.newReason?.(workspaceId);
  return (
    <DialogTrigger>
      <ControlButton
        data-testid="workspace-icon-button"
        size="inline"
        variant="quiet"
        className="ah-wsi-button"
        aria-label={txt.workspaceIcon(icon.name)}
        title={icon.name}
      >
        <WorkspaceIcon icon={icon} />
      </ControlButton>
      <Popover
        placement="bottom start"
        offset={4}
        className="ah-popover ah-wsi-popover"
      >
        <Dialog
          className="ah-wsi-card"
          data-testid="workspace-card"
          aria-label={icon.name}
        >
          {({ close }) => (
            <>
              <header className="ah-wsi-card-head">
                <WorkspaceIcon icon={icon} size="l" />
                <Heading slot="title" level={2}>
                  {icon.name}
                </Heading>
              </header>
              <p
                className="ah-wsi-card-source"
                data-testid="workspace-card-source"
              >
                {icon.source}
                {icon.where ? (
                  <>
                    {" · "}
                    <code>{icon.where}</code>
                  </>
                ) : null}
              </p>
              <ControlButton
                data-testid="workspace-card-open"
                size="row"
                variant="quiet"
                className="ah-wsi-card-action"
                onPress={() => {
                  close();
                  navigate(`/workspaces/${workspaceId}`);
                }}
              >
                <Icon name="folder" /> {txt.openWorkspacePage}
              </ControlButton>
              {actions?.onNew ? (
                <ControlButton
                  data-testid="workspace-card-new"
                  size="row"
                  variant="quiet"
                  className="ah-wsi-card-action"
                  isDisabled={!!reason}
                  title={reason || undefined}
                  onPress={() => {
                    close();
                    actions.onNew?.(workspaceId);
                  }}
                >
                  <Icon name="plus" /> {txt.newConversation}
                </ControlButton>
              ) : null}
            </>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
