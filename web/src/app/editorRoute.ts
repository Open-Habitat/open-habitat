import { isSettingsRoute, settingsSection } from "./settingsRoute";

interface Place {
  pathname: string;
  search: string;
}

/** A conversation route: App wraps every one of them in the workspace editor,
 * so moving between them keeps the editor and its document mounted. */
export function conversationLocation({ pathname, search }: Place) {
  if (/^\/agents\/pi:[0-9a-fA-F-]{36}$/.test(pathname)) return true;
  return (
    /^\/workspaces\/ws_[A-Za-z0-9_-]{8,80}$/.test(pathname) &&
    !!new URLSearchParams(search).get("conversation")
  );
}

/** Whether a route change leaves the editor mounted: another conversation,
 * or Settings, which lies over the view it was opened from. Leaving for
 * anywhere else unmounts the document, so its unsaved text is saved first. */
export function keepsEditor(place: Place) {
  return (
    conversationLocation(place) ||
    (isSettingsRoute(place.pathname) &&
      settingsSection(place.pathname) !== undefined)
  );
}
