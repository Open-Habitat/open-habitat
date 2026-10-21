import { fireEvent, render, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { PiToolUse } from "./PiBlocks";

it("keeps the failed status and output without a duplicate notice", () => {
  const view = render(
    <PiToolUse name="bash" state="failed">
      <pre>Permission denied</pre>
    </PiToolUse>,
  );
  expect(view.getByRole("button")).toBeTruthy();
  expect(view.queryByText("Permission denied")).toBeNull();
  fireEvent.click(view.getByRole("button"));
  expect(view.getByText("Permission denied")).toBeTruthy();
});

it("starts loaded bash closed and live bash open, retaining a person's toggle", () => {
  const choices = new Map<string, boolean>();
  const expansion = {
    get: () => choices.get("call"),
    set: (value: boolean) => {
      choices.set("call", value);
    },
  };
  const loaded = render(
    <PiToolUse name="bash" state="succeeded" expansion={expansion}>
      <p>Output</p>
    </PiToolUse>,
  );
  expect(loaded.queryByText("Output")).toBeNull();
  fireEvent.click(within(loaded.container).getByRole("button"));
  expect(loaded.getByText("Output")).toBeTruthy();
  loaded.unmount();
  const returned = render(
    <PiToolUse name="bash" state="succeeded" expansion={expansion}>
      <p>Output</p>
    </PiToolUse>,
  );
  expect(returned.getByText("Output")).toBeTruthy();
  returned.unmount();
  const live = render(
    <PiToolUse name="bash" state="running">
      <p>Live output</p>
    </PiToolUse>,
  );
  expect(live.getByText("Live output")).toBeTruthy();
  live.unmount();
  const liveChoice = new Map<string, boolean>();
  const carried = {
    get: () => liveChoice.get("call"),
    set: (value: boolean) => {
      liveChoice.set("call", value);
    },
  };
  const arriving = render(
    <PiToolUse name="bash" state="running" expansion={carried}>
      <p>Running</p>
    </PiToolUse>,
  );
  expect(arriving.getByText("Running")).toBeTruthy();
  arriving.unmount();
  const saved = render(
    <PiToolUse name="bash" state="succeeded" expansion={carried}>
      <p>Saved</p>
    </PiToolUse>,
  );
  expect(saved.queryByText("Saved")).toBeNull();
  fireEvent.click(within(saved.container).getByRole("button"));
  expect(saved.getByText("Saved")).toBeTruthy();
});

it("closes a streaming block on completion unless the reader chose to open it", () => {
  const view = render(
    <PiToolUse name="bash" state="running">
      <p>Running output</p>
    </PiToolUse>,
  );
  expect(view.getByText("Running output")).toBeTruthy();
  view.rerender(
    <PiToolUse name="bash" state="succeeded">
      <p>Saved output</p>
    </PiToolUse>,
  );
  expect(view.queryByText("Saved output")).toBeNull();
  fireEvent.click(view.getByRole("button"));
  view.rerender(
    <PiToolUse name="bash" state="succeeded">
      <p>Saved output</p>
    </PiToolUse>,
  );
  expect(view.getByText("Saved output")).toBeTruthy();
});
