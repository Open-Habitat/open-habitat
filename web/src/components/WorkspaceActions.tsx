import { type RefObject, useState } from "react";
import type { Workspace } from "../app/snapshot";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";

const deletionReason =
  "Palautettava poisto suunnitellaan ensin (recoverable-workspace-deletion).";

/** The rail and home lead to the workspace; its own actions live in its head. */
export function WorkspaceActions({
  workspace,
  onNew,
  newReason,
  rail = false,
  onRename,
  onHide,
  settingsAvailable = false,
  renameRef,
  page = false,
}: {
  workspace: Workspace;
  onNew?: (id: string) => void;
  newReason?: string;
  rail?: boolean;
  onRename?: () => void;
  onHide?: () => void;
  settingsAvailable?: boolean;
  renameRef?: RefObject<HTMLButtonElement | null>;
  page?: boolean;
}) {
  const [copyState, setCopyState] = useState("");
  const hidden = workspace.visibility === "hidden";
  const github = workspace.git_summary?.github_repo;
  return (
    // biome-ignore lint/a11y/useSemanticElements: action group is not a form fieldset.
    <div
      className={
        page
          ? "ah-workspace-icon-row"
          : rail
            ? "ah-rail-workspace-actions"
            : "ah-home-actions"
      }
      role="group"
      aria-label={page ? "Työtilan toiminnot" : undefined}
    >
      {page ? (
        <>
          <ControlButton
            variant="quiet"
            presentation="icon"
            aria-label="Kopioi polku"
            title={copyState || "Kopioi polku"}
            isDisabled={!workspace.path || !navigator.clipboard}
            onPress={() => {
              if (workspace.path)
                void navigator.clipboard.writeText(workspace.path).then(
                  () => setCopyState("Polku kopioitu"),
                  () => setCopyState("Polkua ei voitu kopioida"),
                );
            }}
          >
            <Icon name={copyState === "Polku kopioitu" ? "check" : "copy"} />
          </ControlButton>
          <ControlButton
            variant="quiet"
            presentation="icon"
            aria-label="Avaa GitHubissa"
            title={
              github
                ? `Avaa GitHubissa · ${github}`
                : "Työtilalla ei ole GitHub-originia."
            }
            isDisabled={!github}
            onPress={() => {
              if (github)
                window.open(
                  `https://github.com/${github}`,
                  "_blank",
                  "noopener,noreferrer",
                );
            }}
          >
            <Icon name="github" />
          </ControlButton>
          <ControlButton
            ref={renameRef}
            variant="quiet"
            presentation="icon"
            aria-label="Muuta näyttönimeä…"
            title="Muuta näyttönimeä…"
            isDisabled={!settingsAvailable || !onRename}
            onPress={onRename}
          >
            <Icon name="pencil" />
          </ControlButton>
          <ControlButton
            variant="quiet"
            presentation="icon"
            aria-label={hidden ? "Näytä sivupalkissa" : "Piilota sivupalkista"}
            title={hidden ? "Näytä sivupalkissa" : "Piilota sivupalkista"}
            aria-pressed={hidden}
            isDisabled={!settingsAvailable || !onHide}
            onPress={onHide}
          >
            <Icon name={hidden ? "eye" : "eyeOff"} />
          </ControlButton>
          <span title={deletionReason}>
            <ControlButton
              variant="danger-subtle"
              presentation="icon"
              aria-label="Poista työtila…"
              title={deletionReason}
              aria-describedby="workspace-deletion-reason"
              isDisabled
            >
              <Icon name="trash" />
            </ControlButton>
          </span>
          <span id="workspace-deletion-reason" className="ah-visually-hidden">
            {deletionReason}
          </span>
          <span className="ah-workspace-action-divider" aria-hidden="true" />
          {copyState ? (
            <span className="ah-visually-hidden" role="status">
              {copyState}
            </span>
          ) : null}
        </>
      ) : null}
      <ControlButton
        variant={page ? "primary" : "quiet"}
        presentation="icon"
        className={
          page
            ? "ah-workspace-plus"
            : rail
              ? "ah-workspace-more"
              : "ah-home-more"
        }
        aria-label={
          page
            ? "Aloita uusi Pi-keskustelu"
            : `Uusi keskustelu työtilassa ${workspace.display_name ?? workspace.name}`
        }
        isDisabled={!onNew || !!newReason}
        title={newReason || "Uusi keskustelu"}
        onPress={() => onNew?.(workspace.workspace_id)}
      >
        +
      </ControlButton>
    </div>
  );
}
