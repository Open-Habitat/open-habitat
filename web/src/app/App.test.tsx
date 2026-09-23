import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { store } from "./store";
describe("App", () => {
  it("starts behind an honest loading boundary", () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByRole("heading", { name: "Ladataan" })).toBeTruthy();
  });
});
