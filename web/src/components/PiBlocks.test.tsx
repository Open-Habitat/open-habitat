import { fireEvent, render, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { PiToolUse } from "./PiBlocks";

it("starts loaded bash closed and live bash open, retaining a person's toggle", () => {
  const choices = new Map<string, boolean>();
  const expansion = {
    get: () => choices.get("call"),
    set: (value: boolean) => {
      choices.set("call", value);
    },
  };
  const loaded = render(
    <PiToolUse
      name="bash"
      state="succeeded"
      initiallyExpanded={false}
      expansion={expansion}
    >
      <p>Output</p>
    </PiToolUse>,
  );
  expect(loaded.queryByText("Output")).toBeNull();
  fireEvent.click(
    within(loaded.container).getByRole("button", { name: /bash/ }),
  );
  expect(loaded.getByText("Output")).toBeTruthy();
  loaded.unmount();
  const returned = render(
    <PiToolUse
      name="bash"
      state="succeeded"
      initiallyExpanded={false}
      expansion={expansion}
    >
      <p>Output</p>
    </PiToolUse>,
  );
  expect(returned.getByText("Output")).toBeTruthy();
  returned.unmount();
  const live = render(
    <PiToolUse name="bash" state="running" initiallyExpanded>
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
    <PiToolUse
      name="bash"
      state="running"
      initiallyExpanded
      expansion={carried}
    >
      <p>Running</p>
    </PiToolUse>,
  );
  expect(arriving.getByText("Running")).toBeTruthy();
  arriving.unmount();
  const saved = render(
    <PiToolUse
      name="bash"
      state="succeeded"
      initiallyExpanded={false}
      expansion={carried}
    >
      <p>Saved</p>
    </PiToolUse>,
  );
  expect(saved.getByText("Saved")).toBeTruthy();
});
