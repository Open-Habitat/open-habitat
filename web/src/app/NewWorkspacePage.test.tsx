import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { NewWorkspacePage } from "./NewWorkspacePage";

afterEach(() => {
  vi.unstubAllGlobals();
});
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

// Typing past an exact owner/repo aborts its lookup; typing it again must
// look it up again rather than wait on the aborted one forever.
it("looks an exact name up again after its lookup was aborted", async () => {
  const lookups: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/onboarding/github/repos")
        return json({ schema_version: 1, complete: true, repositories: [] });
      if (url.startsWith("/api/v1/onboarding/github/repository?")) {
        const name = decodeURIComponent(url.split("full_name=")[1]);
        lookups.push(name);
        if (lookups.length === 1)
          // The first lookup hangs until it is aborted.
          return new Promise<Response>((_, reject) =>
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            ),
          );
        return json({ schema_version: 1, full_name: name, state: "not_found" });
      }
      return new Response("", { status: 503 });
    }),
  );
  render(
    <MemoryRouter initialEntries={["/workspaces/new"]}>
      <NewWorkspacePage
        workspaces={[]}
        onCreated={() => {}}
        onOpen={() => {}}
        refresh={() => {}}
      />
    </MemoryRouter>,
  );
  const search = screen.getByRole("searchbox", { name: "Hae repoa" });
  fireEvent.change(search, { target: { value: "public/repo" } });
  await waitFor(() => expect(lookups).toEqual(["public/repo"]));
  fireEvent.change(search, { target: { value: "public/other" } });
  await waitFor(() => expect(lookups).toEqual(["public/repo", "public/other"]));
  fireEvent.change(search, { target: { value: "public/repo" } });
  await waitFor(() =>
    expect(lookups).toEqual(["public/repo", "public/other", "public/repo"]),
  );
  expect(
    await screen.findByText("Repoa ei ole, tai sinulla ei ole siihen pääsyä."),
  ).toBeTruthy();
});
