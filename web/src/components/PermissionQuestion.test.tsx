import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  type Permission,
  PermissionLine,
  PermissionQuestion,
} from "./PermissionQuestion";

const permission: Permission = {
  action: "Poista postikansio ’Laskut 2024’",
  consequence: "Kansio ja sen 37 viestiä poistetaan postilaatikosta.",
  account: { provider: "Microsoft", address: "henkilo@example.test" },
  call: {
    area: "ms-admin",
    tool: "delete-mail-folder",
    arguments: '{"mailFolderId":"AAMkExample"}',
  },
};

it("shows the typed parts as plain text and answers with a decision", () => {
  const onAnswer = vi.fn();
  const onStop = vi.fn();
  render(
    <PermissionQuestion
      permission={{ ...permission, action: "<b>Poista</b> kansio" }}
      available
      onAnswer={onAnswer}
      onStop={onStop}
    />,
  );
  const question = screen.getByTestId("permission-question");
  expect(screen.getByTestId("permission-title").textContent).toBe(
    "<b>Poista</b> kansio",
  );
  expect(question.querySelector("b")).toBeNull();
  expect(screen.getByTestId("permission-account").textContent).toBe(
    "Microsoft-tilillä henkilo@example.test",
  );
  expect(within(question).getByText(permission.consequence)).toBeTruthy();
  const technical = screen.getByTestId("permission-technical");
  expect(technical.textContent).toContain("ms-admin · delete-mail-folder");
  expect(technical.textContent).toContain('{"mailFolderId":"AAMkExample"}');
  fireEvent.click(screen.getByTestId("permission-allow"));
  fireEvent.click(screen.getByTestId("permission-deny"));
  expect(onAnswer.mock.calls).toEqual([["allow"], ["deny"]]);
  fireEvent.click(screen.getByTestId("permission-stop"));
  expect(onStop).toHaveBeenCalledOnce();
});

it("cannot be answered without control, and has no account line without one", () => {
  const onAnswer = vi.fn();
  render(
    <PermissionQuestion
      permission={{ ...permission, account: undefined }}
      available={false}
      onAnswer={onAnswer}
    />,
  );
  fireEvent.click(screen.getByTestId("permission-allow"));
  expect(onAnswer).not.toHaveBeenCalled();
  expect(screen.queryByTestId("permission-account")).toBeNull();
  expect(screen.queryByTestId("permission-stop")).toBeNull();
});

it("the stream line waits, then records the decision", () => {
  const { rerender } = render(<PermissionLine action={permission.action} />);
  const line = screen.getByTestId("permission-line");
  expect(line.textContent).toBe(
    `Agentti odottaa lupaasi · ${permission.action}`,
  );
  expect(line.dataset.open).toBe("true");
  rerender(<PermissionLine action={permission.action} decision="allow" />);
  expect(line.textContent).toBe(`Sallit · ${permission.action}`);
  rerender(<PermissionLine action={permission.action} decision="deny" />);
  expect(line.textContent).toBe(`Et sallinut · ${permission.action}`);
  expect(line.dataset.open).toBeUndefined();
});
