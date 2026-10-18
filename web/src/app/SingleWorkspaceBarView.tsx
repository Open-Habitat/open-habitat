import { useRef, useState } from "react";
import { AccountShelf } from "../components";
import { ControlButton } from "../components/ControlElements";
import { Dialog } from "../components/Overlays";
import { TextField } from "../components/Primitives";
import {
  type SingleWorkspaceAction,
  SingleWorkspaceBar,
} from "../components/SingleWorkspaceBar";
import type { AccountProfile } from "./pi";
import type { Workspace } from "./snapshot";
import type { RootState } from "./store";
import { lastWorkspaceReason } from "./trashText";
import { connectionStatus, serverLabel, useServer } from "./WorkspaceRailView";

/** Single-workspace mode's frame: the loader and the writes stay in App. */
export function SingleWorkspaceBarView({
  workspace,
  phase,
  source,
  profile,
  identityName,
  pathname,
  onNew,
  newReason,
  onAdd,
  onRename,
  onSettings,
  onAdministration,
  onLogout,
}: {
  workspace: Workspace;
  phase: RootState["connection"]["phase"];
  source: string;
  profile?: AccountProfile;
  identityName: string;
  pathname: string;
  onNew?: () => void;
  newReason?: string;
  onAdd?: () => void;
  /** Absent while the display name cannot be changed. */
  onRename?: (display: string) => void;
  onSettings: () => void;
  onAdministration: () => void;
  onLogout: () => void;
}) {
  const server = useServer(pathname);
  const connection = connectionStatus(phase, source);
  const name = workspace.display_name ?? workspace.name;
  const github = workspace.git_summary?.github_repo;
  const [status, setStatus] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [display, setDisplay] = useState(name);
  const renameReturn = useRef<HTMLElement>(null);
  const path = workspace.path?.endsWith(`/src/${workspace.name}`)
    ? `~/src/${workspace.name}`
    : (workspace.path ?? workspace.name);
  const act = (action: SingleWorkspaceAction) => {
    if (action === "copy" && workspace.path)
      void navigator.clipboard?.writeText(workspace.path).then(
        () => setStatus("Polku kopioitu"),
        () => setStatus("Polkua ei voitu kopioida"),
      );
    if (action === "github" && github)
      window.open(
        `https://github.com/${github}`,
        "_blank",
        "noopener,noreferrer",
      );
    if (action === "rename" && onRename) {
      // The menu returns focus to its trigger; the dialog does the same.
      renameReturn.current = document.querySelector(".ah-single-more");
      setDisplay(name);
      setRenameOpen(true);
    }
    if (action === "add") onAdd?.();
  };
  return (
    <>
      <SingleWorkspaceBar
        name={name}
        path={path}
        github={github}
        homeCurrent={pathname === "/workspaces"}
        connectionLabel={`${connection.label} · ${serverLabel(server)}`}
        connectionTone={connection.tone}
        onNew={onNew}
        newReason={newReason}
        renameReason={
          onRename ? undefined : "Näyttönimeä ei voi muuttaa juuri nyt."
        }
        onAdd={onAdd}
        trashReason={lastWorkspaceReason}
        onAction={act}
        status={status}
        account={
          <AccountShelf
            profile={
              profile ?? { name: identityName, email: "", avatar_url: "" }
            }
            server={{
              name: serverLabel(server),
              version: server?.version,
              connectionLabel: connection.label,
              tone: connection.tone,
            }}
            placement="bottom end"
            onSettings={onSettings}
            onAdministration={
              server?.administrator ? onAdministration : undefined
            }
            onLogout={onLogout}
          />
        }
      />
      <div className="ah-workspace-rename">
        <Dialog
          triggerLabel="Muuta näyttönimeä…"
          title="Muuta näyttönimeä"
          returnFocusRef={renameReturn}
          isOpen={renameOpen}
          onOpenChange={setRenameOpen}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!onRename) return;
              onRename(display);
              setRenameOpen(false);
            }}
          >
            <TextField
              label="Näyttönimi"
              value={display}
              onChange={setDisplay}
            />
            <ControlButton size="page" type="submit" isDisabled={!onRename}>
              Tallenna
            </ControlButton>
          </form>
        </Dialog>
      </div>
    </>
  );
}
