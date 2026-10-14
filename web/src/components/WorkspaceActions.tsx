import { useNavigate } from "react-router";
import type { Workspace } from "../app/snapshot";
import { Menu } from "./Overlays";

const deletionReason =
  "Palautettava poisto suunnitellaan ensin (recoverable-workspace-deletion).";

/** The same workspace operations are available from home and from the rail. */
export function WorkspaceActions({
  workspace,
  onNew,
  rail = false,
}: {
  workspace: Workspace;
  onNew?: (id: string) => void;
  rail?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div className={rail ? "ah-rail-workspace-actions" : "ah-home-actions"}>
      <Menu
        label={`Työtilan ${workspace.display_name ?? workspace.name} toiminnot`}
        triggerLabel={`Työtilan ${workspace.display_name ?? workspace.name} toiminnot`}
        triggerPresentation="icon"
        triggerClassName={rail ? "ah-workspace-more" : "ah-home-more"}
        trigger={<span aria-hidden="true">···</span>}
        popoverClassName="ah-workspace-menu"
        placement="end top"
        items={[
          {
            id: "new",
            label: "Uusi keskustelu",
            availability: onNew
              ? undefined
              : ({
                  state: "disabled",
                  reason: "Keskustelun luonti ei ole nyt käytettävissä.",
                } as const),
          },
          { id: "page", label: "Avaa työtilasivu" },
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
          if (id === "new") onNew?.(workspace.workspace_id);
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
