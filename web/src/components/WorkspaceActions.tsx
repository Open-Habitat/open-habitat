import { type RefObject, useState } from "react";
import type { Workspace } from "../app/snapshot";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";

/** The rail and home lead to the workspace; its own actions live in its head. */
export function WorkspaceActions({
  workspace,
  onNew,
  newReason,
  rail = false,
  onRename,
  onHide,
  hidePending = false,
  settingsAvailable = false,
  renameRef,
  deleteRef,
  onDelete,
  page = false,
}: {
  workspace: Workspace;
  onNew?: (id: string) => void;
  newReason?: string;
  rail?: boolean;
  onRename?: () => void;
  onHide?: () => void;
  hidePending?: boolean;
  settingsAvailable?: boolean;
  renameRef?: RefObject<HTMLButtonElement | null>;
  deleteRef?: RefObject<HTMLButtonElement | null>;
  /** Opens the deletion confirmation; absent while changes are not allowed. */
  onDelete?: () => void;
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
            size="row"
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
            size="row"
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
            size="row"
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
            size="row"
            variant="quiet"
            presentation="icon"
            aria-label={hidden ? "Palauta työtila" : "Arkistoi työtila"}
            title={
              hidden
                ? "Palauta työtila sivupalkkiin"
                : "Arkistoi: siirtää työtilan sivupalkin Arkistoidut-ryhmään. Tiedostot ja keskustelut säilyvät."
            }
            aria-pressed={hidden}
            isDisabled={!settingsAvailable || !onHide || hidePending}
            onPress={onHide}
          >
            <Icon name={hidden ? "eye" : "eyeOff"} />
          </ControlButton>
          <ControlButton
            size="row"
            ref={deleteRef}
            variant="danger-subtle"
            presentation="icon"
            aria-label="Poista työtila…"
            title={
              onDelete
                ? "Poista työtila…"
                : "Työtilaa ei voi poistaa juuri nyt: muutokset eivät ole sallittuja."
            }
            isDisabled={!settingsAvailable || !onDelete}
            onPress={onDelete}
          >
            <Icon name="trash" />
          </ControlButton>
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
        size={page ? "row" : "inline"}
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
        <Icon name="plus" />
      </ControlButton>
    </div>
  );
}
