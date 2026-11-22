import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { afterEach, expect, it } from "vitest";
import { keepsEditor } from "./editorRoute";
import {
  placeBackground,
  usePlaceEscape,
  usePlaceNavigation,
} from "./placeNavigation";

afterEach(cleanup);

it("keeps the editor only when the place actually overlays a conversation", () => {
  const place = { pathname: "/resources", search: "" };
  expect(keepsEditor(place)).toBe(false);
  expect(
    keepsEditor({
      ...place,
      state: {
        placeBackground: {
          pathname: "/workspaces/ws_example123",
          search: "?conversation=pi:example",
        },
      },
    }),
  ).toBe(true);
  expect(
    keepsEditor({
      ...place,
      state: {
        placeBackground: {
          pathname: "/workspaces",
          search: "",
        },
      },
    }),
  ).toBe(false);
});

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const place = usePlaceNavigation();
  usePlaceEscape(true);
  const background = placeBackground(location);
  return (
    <>
      <output data-testid="route">{location.pathname + location.search}</output>
      <output data-testid="background">
        {background?.pathname}
        {background?.search}
      </output>
      <button
        type="button"
        data-testid="shares"
        onClick={() => place("/shares")}
      >
        Shares
      </button>
      <button
        type="button"
        data-testid="resources"
        onClick={() => place("/resources")}
      >
        Resources
      </button>
      <button type="button" data-testid="back" onClick={() => navigate(-1)}>
        Back
      </button>
      <button type="button" data-testid="forward" onClick={() => navigate(1)}>
        Forward
      </button>
      <input data-testid="field" />
    </>
  );
}

const conversation = "/workspaces/ws_example123?conversation=pi:example";
const click = (id: string) => fireEvent.click(screen.getByTestId(id));
const route = () => screen.getByTestId("route").textContent;

it("places share one history entry and Back/Forward retain the exact return location", () => {
  render(
    <MemoryRouter initialEntries={["/workspaces", conversation]}>
      <Navigation />
    </MemoryRouter>,
  );
  click("shares");
  expect(screen.getByTestId("background").textContent).toBe(conversation);
  click("resources");
  expect(route()).toBe("/resources");
  click("resources");
  expect(route()).toBe(conversation);
  click("resources");
  click("back");
  expect(route()).toBe(conversation);
  click("forward");
  expect(route()).toBe("/resources");
  click("back");
  expect(route()).toBe(conversation);
  click("back");
  expect(route()).toBe(conversation);
  click("back");
  expect(route()).toBe("/workspaces");
});

it("a direct link closes to home rather than leaving the application", () => {
  render(
    <MemoryRouter initialEntries={["/shares"]}>
      <Navigation />
    </MemoryRouter>,
  );
  click("resources");
  click("resources");
  expect(route()).toBe("/workspaces");
});

it("Escape yields to fields, inner dialogs and prevented events", () => {
  render(
    <MemoryRouter initialEntries={[conversation]}>
      <Navigation />
    </MemoryRouter>,
  );
  click("shares");
  fireEvent.keyDown(screen.getByTestId("field"), { code: "Escape" });
  expect(route()).toBe("/shares");
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  document.body.append(dialog);
  fireEvent.keyDown(document, { code: "Escape" });
  expect(route()).toBe("/shares");
  dialog.remove();
  const prevented = new KeyboardEvent("keydown", {
    code: "Escape",
    cancelable: true,
  });
  prevented.preventDefault();
  fireEvent(document, prevented);
  expect(route()).toBe("/shares");
  fireEvent.keyDown(document, { code: "Escape" });
  expect(route()).toBe(conversation);
});
