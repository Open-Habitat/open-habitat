import type { RefObject } from "react";
import { useNavigate } from "react-router";
import type { Workspace } from "../app/snapshot";
import { Menu } from "./Overlays";
import { ControlButton } from "./ControlElements";

const deletionReason =
  "Palautettava poisto suunnitellaan ensin (recoverable-workspace-deletion).";

/** The same workspace operations are available from home and from the rail. */
export function WorkspaceActions({
  workspace,
  onNew,
  newReason,
  rail = false,
  onRename,
  onHide,
  settingsAvailable = false,
  menuRef,
  page = false,
}: {
  workspace: Workspace;
  onNew?: (id: string) => void;
  newReason?: string;
  rail?: boolean;
  onRename?: () => void;
  onHide?: () => void;
  settingsAvailable?: boolean;
  menuRef?: RefObject<HTMLButtonElement | null>;
  page?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div className={rail ? "ah-rail-workspace-actions" : "ah-home-actions"}>
      {!page ? (
        <ControlButton
          variant="quiet"
          presentation="icon"
          className={rail ? "ah-workspace-more" : "ah-home-more"}
          aria-label={`Uusi keskustelu työtilassa ${workspace.display_name ?? workspace.name}`}
          isDisabled={!onNew || !!newReason}
          title={newReason || "Uusi keskustelu"}
          onPress={() => onNew?.(workspace.workspace_id)}
        >
          +
        </ControlButton>
      ) : null}
      <Menu
        buttonRef={menuRef}
        label={`Työtilan ${workspace.display_name ?? workspace.name} toiminnot`}
        triggerLabel={`Työtilan ${workspace.display_name ?? workspace.name} toiminnot`}
        triggerPresentation="icon"
        triggerClassName={rail ? "ah-workspace-more" : "ah-home-more"}
        trigger={<span aria-hidden="true">…</span>}
        popoverClassName="ah-workspace-menu"
        placement="end top"
        items={[
          ...(!page ? [{ id: "page", label: "Avaa työtilasivu" }] : []),
          {
            id: "copy",
            label: "Kopioi polku",
            availability:
              workspace.path && navigator.clipboard
                ? undefined
                : ({
                    state: "disabled",
                    reason: "Polun kopiointi ei ole käytettävissä.",
                  } as const),
          },
          ...(workspace.git_summary?.github_repo
            ? [{ id: "github", label: "Avaa GitHubissa" }]
            : []),
          ...(onRename
            ? [
                {
                  id: "rename",
                  label: "Muuta näyttönimeä…",
                  availability: settingsAvailable
                    ? undefined
                    : {
                        state: "disabled" as const,
                        reason: "Päivitä yhteys ja työtilan tiedot.",
                      },
                },
              ]
            : []),
          ...(onHide
            ? [
                {
                  id: "hide",
                  label: "Piilota sivupalkista",
                  availability: settingsAvailable
                    ? undefined
                    : {
                        state: "disabled" as const,
                        reason: "Päivitä yhteys ja työtilan tiedot.",
                      },
                },
              ]
            : []),
          {
            id: "delete",
            label: "Poista työtila… · tulossa",
            danger: true,
            availability: {
              state: "disabled",
              reason: deletionReason,
            } as const,
          },
        ]}
        onAction={(id) => {
          if (id === "rename") onRename?.();
          if (id === "hide") onHide?.();
          if (id === "page") navigate(`/workspaces/${workspace.workspace_id}`);
          if (id === "copy" && workspace.path)
            void navigator.clipboard.writeText(workspace.path);
          if (id === "github" && workspace.git_summary?.github_repo)
            window.open(
              `https://github.com/${workspace.git_summary.github_repo}`,
              "_blank",
              "noopener,noreferrer",
            );
        }}
      />
    </div>
  );
}
