import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { AppChange, IntegrationApps } from "../app/serverIntegrations";
import { MicrosoftOrganisationsDialog } from "./MicrosoftOrganisations";

// The Organisations dialog's outcomes the synthetic host cannot easily
// stage: a lost reply, a refusal, and a list only root may change. The
// flows themselves run against the host in microsoft-organisations.spec.ts.

const own = "e04c61f9-3b8d-4a27-9f5e-7d1a2c48b903";
const one = "9a4e7b21-5c3d-4f60-8e1a-7b2c9d0e4f35";
const page = (extra: Partial<IntegrationApps> = {}): IntegrationApps => ({
  schema_version: 1,
  browser_setup: true,
  apps: [
    {
      provider: "microsoft_shared",
      client_id: "5b7e0d3a-91c2-4f68-a4d1-2c9e8f60b7a3",
      tenant_id: own,
      usable: true,
      source: "operator",
    },
  ],
  tenants: [
    { tenant_id: own, label: "Own Ltd", source: "operator" },
    { tenant_id: one, label: "Client One", source: "operator" },
  ],
  ...extra,
});

function setup(apps: IntegrationApps, reply: AppChange, locked = false) {
  const calls = {
    onSet: vi.fn(async () => reply),
    onRemove: vi.fn(async () => reply),
    onReread: vi.fn(),
    onClose: vi.fn(),
  };
  render(
    <MicrosoftOrganisationsDialog apps={apps} locked={locked} {...calls} />,
  );
  return calls;
}

it("keeps a removal whose reply was lost on its step, uncertain, and offers to read again", async () => {
  const calls = setup(page(), { kind: "uncertain" });
  fireEvent.click(screen.getByTestId(`mo-remove-open-${one}`));
  fireEvent.click(screen.getByTestId("mo-remove-confirm"));
  await waitFor(() => expect(screen.getByTestId("mo-problem")).toBeTruthy());
  expect(calls.onRemove).toHaveBeenCalledWith(one);
  expect(screen.getByTestId("mo-dialog").dataset.step).toBe("remove");
  fireEvent.click(screen.getByTestId("mo-reread"));
  expect(calls.onReread).toHaveBeenCalledOnce();
});

it("keeps a refused addition on its step with what it typed", async () => {
  setup(page(), { kind: "refused", code: "integration_tenants_full" });
  fireEvent.click(screen.getByTestId("mo-add-open"));
  fireEvent.change(screen.getByTestId("mo-add-label"), {
    target: { value: "Client Two" },
  });
  fireEvent.change(screen.getByTestId("mo-add-tenant"), {
    target: { value: "c3b8d5e0-1a2f-4b7c-a6d9-0e5f8a3b2c47" },
  });
  fireEvent.click(screen.getByTestId("mo-add-save"));
  await waitFor(() => expect(screen.getByTestId("mo-problem")).toBeTruthy());
  expect(screen.getByTestId("mo-dialog").dataset.step).toBe("add");
  expect((screen.getByTestId("mo-add-label") as HTMLInputElement).value).toBe(
    "Client Two",
  );
});

it("lets the list be read but not changed while browser setup is off or root's list is invalid", () => {
  for (const [apps, locked] of [
    [page(), true],
    [page({ tenants: [], tenants_invalid: true }), false],
  ] as const) {
    const { unmount } = render(
      <MicrosoftOrganisationsDialog
        apps={apps}
        locked={locked}
        onSet={vi.fn()}
        onRemove={vi.fn()}
        onReread={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByTestId("mo-add-open").hasAttribute("disabled") ||
        screen.getByTestId("mo-add-open").getAttribute("data-disabled") !==
          null,
    ).toBe(true);
    for (const b of screen.queryAllByTestId(/^mo-remove-open-/))
      expect(
        b.hasAttribute("disabled") || b.getAttribute("data-disabled") !== null,
      ).toBe(true);
    // Approval links are reading, so they stay open.
    for (const b of screen.queryAllByTestId(/^mo-consent-open-/))
      expect(b.hasAttribute("disabled")).toBe(false);
    unmount();
  }
});
