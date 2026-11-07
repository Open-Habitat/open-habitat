import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { adoptCreation } from "./heldMessages";

/** The mounted creation view keeps its draft when it receives its ID. Storage
 * adoption can happen before that render commits; it is not newer than input
 * still arriving in the mounted field (including an upload reply). */
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
  }));
  if (draft.key !== key) {
    setDraft({
      key,
      value:
        id && draft.origin?.identity === identity
          ? draft.value
          : (sessionStorage.getItem(key) ?? ""),
      origin,
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
      });
      sessionStorage.setItem(key, value);
    },
    [key, id, identity, workspaceId],
  );
  return { draft: draft.value, changeDraft };
}
