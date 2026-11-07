import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { adoptCreation } from "./heldMessages";

/** The mounted creation view keeps its draft when it receives its ID. Storage
 * adoption can happen before that render commits; it is not newer than input
 * still arriving in the mounted field (including an upload reply). A field
 * nobody wrote in holds nothing newer: it may have mounted only after
 * adoption had emptied the creation draft, so the adopted draft wins. */
export function useConversationDraft(
  identity: string,
  workspaceId: string,
  id?: string,
) {
  const creationKey = `nah:${identity}:draft:new:${workspaceId}`;
  const key = id ? `nah:${identity}:draft:${id}` : creationKey;
  const origin = id ? undefined : { identity, workspaceId };
  const [draft, setDraft] = useState(() => ({
    key,
    value: sessionStorage.getItem(key) ?? "",
    origin,
    written: false,
  }));
  if (draft.key !== key) {
    const stored = sessionStorage.getItem(key);
    setDraft({
      key,
      value:
        id && draft.origin?.identity === identity
          ? draft.written
            ? draft.value
            : (stored ?? draft.value)
          : (stored ?? ""),
      origin,
      written: false,
    });
  }
  const committed = useRef(draft);
  useLayoutEffect(() => {
    // Worktree creation also changes workspaceId: adopt from the workspace
    // the mounted field belonged to, not the newly created worktree.
    const from = committed.current.origin;
    if (id && from?.identity === identity && committed.current.key !== key)
      adoptCreation(identity, from.workspaceId, id);
    committed.current = draft;
    sessionStorage.setItem(draft.key, draft.value);
  }, [draft, key, identity, id]);
  const changeDraft = useCallback(
    (value: string) => {
      setDraft({
        key,
        value,
        origin: id ? undefined : { identity, workspaceId },
        written: true,
      });
      sessionStorage.setItem(key, value);
    },
    [key, id, identity, workspaceId],
  );
  return { draft: draft.value, changeDraft };
}
