import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import { InstructionsEditor } from "./InstructionsEditor";

const text = () =>
  (screen.getByTestId("editor-text") as HTMLTextAreaElement).value;
const edit = async (value: string) => {
  fireEvent.click(screen.getAllByRole("tab")[1]);
  fireEvent.change(await screen.findByTestId("editor-text"), {
    target: { value },
  });
};

describe("InstructionsEditor", () => {
  it("merges a change made meanwhile into the draft and saves nothing until asked again", async () => {
    const saved: string[] = [];
    let reply: { ok: true } | { conflict: string } = {
      conflict: "a\nb\nc\nd changed elsewhere\ne added\n",
    };
    const onSave = vi.fn(async (t: string) => {
      saved.push(t);
      return reply;
    });
    render(
      <InstructionsEditor value={"a\nb\nc\nd\n"} label="x" onSave={onSave} />,
    );
    await edit("a mine\nb\nc\nd\n");
    await act(async () => {
      fireEvent.click(screen.getByTestId("editor-save"));
    });
    expect(saved).toEqual(["a mine\nb\nc\nd\n"]);
    expect(screen.getByTestId("editor-merged")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("tab")[1]);
    expect(text()).toBe("a mine\nb\nc\nd changed elsewhere\ne added\n");
    reply = { ok: true };
    await act(async () => {
      fireEvent.click(screen.getByTestId("editor-save"));
    });
    expect(saved[1]).toBe("a mine\nb\nc\nd changed elsewhere\ne added\n");
    expect(screen.queryByTestId("editor-merged")).toBeNull();
  });

  it("blocks saving while the same line changed on both sides, until the person picks", async () => {
    const onSave = vi.fn(async () => ({ conflict: "a theirs\nb\n" }));
    render(<InstructionsEditor value={"a\nb\n"} label="x" onSave={onSave} />);
    await edit("a mine\nb\n");
    await act(async () => {
      fireEvent.click(screen.getByTestId("editor-save"));
    });
    expect(screen.getByTestId("conflict-mine").textContent).toContain("a mine");
    expect(
      (screen.getByTestId("editor-save") as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByTestId("pick-theirs"));
    expect(screen.queryByTestId("editor-conflict")).toBeNull();
    fireEvent.click(screen.getAllByRole("tab")[1]);
    // Taking theirs leaves the file as it is now: nothing to save.
    expect(text()).toBe("a theirs\nb\n");
    expect(screen.queryByTestId("editor-save")).toBeNull();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("keeps the draft and says why when a save fails", async () => {
    render(
      <InstructionsEditor
        value=""
        label="x"
        onSave={async () => ({ error: "not saved" })}
      />,
    );
    await edit("new\n");
    await act(async () => {
      fireEvent.click(screen.getByTestId("editor-save"));
    });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByTestId("editor-unsaved")).toBeTruthy();
  });

  it("merges a change made meanwhile with a note that is not on disk yet, keeping the answers", async () => {
    const saved: string[] = [];
    let reply: { ok: true } | { conflict: string } = {
      conflict: "# Mine changed\n\nkeep\n",
    };
    render(
      <InstructionsEditor
        value={"# Mine\n\nkeep\n\n## Note\n\nanswers\n"}
        origin={"# Mine\n\nkeep\n"}
        alwaysSavable
        label="x"
        onSave={async (t) => {
          saved.push(t);
          return reply;
        }}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("editor-save"));
    });
    fireEvent.click(screen.getAllByRole("tab")[1]);
    expect(text()).toBe("# Mine changed\n\nkeep\n\n## Note\n\nanswers\n");
    reply = { ok: true };
    await act(async () => {
      fireEvent.click(screen.getByTestId("editor-save"));
    });
    expect(saved[1]).toBe("# Mine changed\n\nkeep\n\n## Note\n\nanswers\n");
  });

  it("keeps the text unchangeable while a conflict waits for a choice", async () => {
    render(
      <InstructionsEditor
        value={"a\nb\n"}
        label="x"
        onSave={async () => ({ conflict: "a theirs\nb\n" })}
      />,
    );
    await edit("a mine\nb\n");
    await act(async () => {
      fireEvent.click(screen.getByTestId("editor-save"));
    });
    fireEvent.click(screen.getAllByRole("tab")[1]);
    expect(
      (screen.getByTestId("editor-text") as HTMLTextAreaElement).readOnly,
    ).toBe(true);
    fireEvent.click(screen.getByTestId("pick-mine"));
    expect(
      (screen.getByTestId("editor-text") as HTMLTextAreaElement).readOnly,
    ).toBe(false);
  });

  it("finishes a save under StrictMode", async () => {
    render(
      <StrictMode>
        <InstructionsEditor
          value=""
          label="x"
          onSave={async () => ({ error: "not saved" })}
        />
      </StrictMode>,
    );
    await edit("new\n");
    await act(async () => {
      fireEvent.click(screen.getByTestId("editor-save"));
    });
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
