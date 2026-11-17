import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it } from "vitest";
import { TrashNotice } from "./TrashNotice";

afterEach(cleanup);

const trashed = (restore?: "unavailable") => ({
  name: "synthetic",
  result: {
    schema_version: 1 as const,
    state: "trashed" as const,
    workspace_id: "ws_synthetic",
    entry: "synthetic",
    ...(restore ? { restore } : {}),
  },
});

// A move at a full quota has no Trash record (host workspace_delete_linux.go),
// so offering an undo would promise a restore the host refuses; the notice
// stays until closed and still leads to the Trash, where it can be deleted.
it("offers no undo for a move the Trash could not record", () => {
  const { unmount } = render(
    <MemoryRouter>
      <TrashNotice
        outcome={trashed()}
        csrf="csrf"
        refresh={() => {}}
        onClose={() => {}}
      />
    </MemoryRouter>,
  );
  expect(screen.getByTestId("restore-notice")).toBeTruthy();
  unmount();
  render(
    <MemoryRouter>
      <TrashNotice
        outcome={trashed("unavailable")}
        csrf="csrf"
        refresh={() => {}}
        onClose={() => {}}
      />
    </MemoryRouter>,
  );
  expect(screen.queryByTestId("restore-notice")).toBeNull();
  expect(screen.getByTestId("notice-link")).toBeTruthy();
});
