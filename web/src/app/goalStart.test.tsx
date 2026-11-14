import { render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { splitAttachments } from "../components/AttachmentChips";
import { readCommands, type StartGoal } from "./composerReads";
import {
  adoptGuide,
  creationGuideOwner,
  guideOwner,
  prepareGoalConversation,
  prepareInvocation,
  readGuide,
  setGuide,
  usePreparedField,
} from "./goalGuide";
import { adoptCreation, creationKeys, readHeld } from "./heldMessages";

vi.mock("./composerReads", () => ({ readCommands: vi.fn() }));

const goal: StartGoal = {
  title: "Korjaa havaittu virhe",
  when: "w",
  what: "x",
  steps: ["s"],
  prompt: "Selvitä syy.\n\n[kuvaile havainto]",
  skill: "korjaa",
};
const listed = (description: string) => ({
  answered_by: "helper" as const,
  commands: [
    {
      name: "skill:korjaa",
      source: "skill" as const,
      scope: "project" as const,
      description,
      terminal_only: false,
    },
  ],
});
const draftKey = creationKeys("person", "ws").draft;

afterEach(() => {
  sessionStorage.clear();
  setGuide(creationGuideOwner("person", "ws"), undefined);
  setGuide(guideOwner("person", "pi:new"), undefined);
  vi.mocked(readCommands).mockReset();
});

/** A composer field as the composer shows a draft: attachment reference
 * lines are chips, and so is the skill call once `chip` is set. */
function Field({
  owner,
  value,
  chip = false,
}: {
  owner: string;
  value: string;
  chip?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  usePreparedField(owner, root);
  return (
    <div ref={root}>
      <div className="ah-composer">
        <textarea
          data-testid="field"
          value={((text) => (chip ? text.replace(/^\/skill:\S+ /, "") : text))(
            splitAttachments(value).text,
          )}
          onChange={() => {}}
        />
      </div>
    </div>
  );
}
const selected = (field: HTMLTextAreaElement) =>
  field.value.slice(field.selectionStart, field.selectionEnd);

describe("a goal chosen on the workspace page", () => {
  it.each([
    {
      draft: "",
      prompt: "Complete request.",
      allowImmediate: true,
      sends: true,
    },
    {
      draft: "My draft",
      prompt: "Complete request.",
      allowImmediate: true,
      sends: false,
    },
    {
      draft: "",
      prompt: "Request [input]",
      allowImmediate: true,
      sends: false,
    },
    {
      draft: "",
      prompt: "Complete request.",
      allowImmediate: false,
      sends: false,
    },
  ])(
    "immediate start respects draft, placeholder and Explain mode: %j",
    async ({ draft, prompt, allowImmediate, sends }) => {
      vi.mocked(readCommands).mockResolvedValue(listed(goal.title));
      sessionStorage.setItem(draftKey, draft);
      await prepareGoalConversation({
        identity: "person",
        workspaceId: "ws",
        page: "Page",
        goal: { ...goal, prompt, start: "immediate" },
        signal: new AbortController().signal,
        allowImmediate,
        onStart: () => true,
      });
      const held = readHeld(creationKeys("person", "ws").held);
      expect(held).toHaveLength(sends ? 1 : 0);
      if (sends) {
        expect(held[0]).toMatchObject({
          text: "/skill:korjaa ",
          posted: false,
        });
        expect(sessionStorage.getItem(draftKey)).toBeNull();
        adoptCreation("person", "ws", "pi:new");
        adoptCreation("person", "ws", "pi:new");
        expect(readHeld("nah:person:held:pi:new")).toEqual(held);
      } else {
        expect(sessionStorage.getItem(draftKey)).toContain(draft);
      }
    },
  );
  it("leaves only a draft when creation is blocked or opens a model chooser", async () => {
    vi.mocked(readCommands).mockResolvedValue(listed(goal.title));
    const started = await prepareGoalConversation({
      identity: "person",
      workspaceId: "ws",
      page: "Page",
      goal: { ...goal, prompt: "Complete request.", start: "immediate" },
      signal: new AbortController().signal,
      onStart: () => false,
    });
    expect(started).toBe(false);
    expect(readHeld(creationKeys("person", "ws").held)).toEqual([]);
    expect(sessionStorage.getItem(draftKey)).toBe("/skill:korjaa ");
  });

  it("prepares the new conversation's draft and guide as Aloita would", async () => {
    vi.mocked(readCommands).mockResolvedValue(listed("Korjaa havaittu virhe"));
    sessionStorage.setItem(draftKey, "Oma ajatus.");
    const ok = await prepareGoalConversation({
      identity: "person",
      workspaceId: "ws",
      goal,
      page: "Aurinkokello",
      signal: new AbortController().signal,
    });
    expect(ok).toBe(true);
    expect(readCommands).toHaveBeenCalledWith(
      { workspaceId: "ws" },
      expect.anything(),
    );
    // The goal's own skill carries the request.
    expect(sessionStorage.getItem(draftKey)).toBe(
      "/skill:korjaa Oma ajatus.\n\n[kuvaile havainto]",
    );
    expect(readGuide(creationGuideOwner("person", "ws"))).toMatchObject({
      goal,
      page: "Aurinkokello",
    });
  });

  it("puts the request in as text when Pi does not list the skill", async () => {
    vi.mocked(readCommands).mockResolvedValue({
      answered_by: "helper",
      commands: [],
    });
    await prepareGoalConversation({
      identity: "person",
      workspaceId: "ws",
      goal,
      page: "Aurinkokello",
      signal: new AbortController().signal,
    });
    expect(sessionStorage.getItem(draftKey)).toBe(
      "Selvitä syy.\n\n[kuvaile havainto]",
    );
  });

  it("prepares nothing when the skill cannot be checked", async () => {
    vi.mocked(readCommands).mockRejectedValue(new Error("offline"));
    await expect(
      prepareGoalConversation({
        identity: "person",
        workspaceId: "ws",
        goal,
        page: "Aurinkokello",
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("offline");
    expect(sessionStorage.getItem(draftKey)).toBeNull();
    expect(readGuide(creationGuideOwner("person", "ws"))).toBeUndefined();
  });

  it("selects the placeholder while creating, after the chip appears and once created", async () => {
    vi.mocked(readCommands).mockResolvedValue(listed("Korjaa havaittu virhe"));
    await prepareGoalConversation({
      identity: "person",
      workspaceId: "ws",
      goal,
      page: "Aurinkokello",
      signal: new AbortController().signal,
    });
    const text = sessionStorage.getItem(draftKey) ?? "";
    const creating = creationGuideOwner("person", "ws");
    const view = render(<Field owner={creating} value={text} />);
    let field = view.getByTestId("field") as HTMLTextAreaElement;
    expect(document.activeElement).toBe(field);
    expect(selected(field)).toBe("[kuvaile havainto]");
    // The start page is read: the skill call becomes a chip.
    view.rerender(<Field owner={creating} value={text} chip />);
    expect(selected(field)).toBe("[kuvaile havainto]");
    view.unmount();
    // The created conversation takes over the draft and the selection.
    adoptGuide("person", "ws", "pi:new");
    const created = render(
      <Field owner={guideOwner("person", "pi:new")} value={text} chip />,
    );
    field = created.getByTestId("field") as HTMLTextAreaElement;
    expect(document.activeElement).toBe(field);
    expect(selected(field)).toBe("[kuvaile havainto]");
    // Once the person edits, their caret stays theirs.
    created.rerender(
      <Field owner={guideOwner("person", "pi:new")} value="Muu" chip />,
    );
    field.setSelectionRange(1, 1);
    created.rerender(
      <Field owner={guideOwner("person", "pi:new")} value={text} chip />,
    );
    expect(field.selectionStart).toBe(field.value.length);
  });

  it("selects the placeholder when the kept draft has an attachment", async () => {
    vi.mocked(readCommands).mockResolvedValue(listed("Korjaa havaittu virhe"));
    const shot =
      "![shot.png](/api/v1/attachments/11111111-1111-4111-8111-111111111111)";
    sessionStorage.setItem(draftKey, `Kesken\n${shot}`);
    await prepareGoalConversation({
      identity: "person",
      workspaceId: "ws",
      goal,
      page: "Aurinkokello",
      signal: new AbortController().signal,
    });
    const text = sessionStorage.getItem(draftKey) ?? "";
    expect(text).toContain(shot);
    const view = render(
      <Field owner={creationGuideOwner("person", "ws")} value={text} chip />,
    );
    const field = view.getByTestId("field") as HTMLTextAreaElement;
    expect(document.activeElement).toBe(field);
    expect(selected(field)).toBe("[kuvaile havainto]");
  });

  it("puts the caret after the start page invocation before a kept attachment", () => {
    const shot =
      "![shot.png](/api/v1/attachments/11111111-1111-4111-8111-111111111111)";
    sessionStorage.setItem(draftKey, `${shot}\nKesken`);
    prepareInvocation("person", "ws", "/skill:open-habitat-start-page ");
    const text = sessionStorage.getItem(draftKey) ?? "";
    const view = render(
      <Field owner={creationGuideOwner("person", "ws")} value={text} />,
    );
    const field = view.getByTestId("field") as HTMLTextAreaElement;
    expect(field.value.slice(0, field.selectionStart)).toBe(
      "/skill:open-habitat-start-page ",
    );
  });

  it("does not take focus from another control", () => {
    prepareInvocation("person", "ws", "/skill:open-habitat-start-page ");
    const other = document.createElement("button");
    document.body.append(other);
    other.focus();
    render(
      <Field
        owner={creationGuideOwner("person", "ws")}
        value="/skill:open-habitat-start-page "
      />,
    );
    expect(document.activeElement).toBe(other);
    other.remove();
  });

  it("writes the start page invocation ahead of an earlier draft", () => {
    sessionStorage.setItem(draftKey, "Kesken\n");
    prepareInvocation("person", "ws", "/skill:open-habitat-start-page ");
    expect(sessionStorage.getItem(draftKey)).toBe(
      "/skill:open-habitat-start-page \n\nKesken",
    );
    prepareInvocation("person", "ws", "/skill:open-habitat-start-page ");
    expect(sessionStorage.getItem(draftKey)).toBe(
      "/skill:open-habitat-start-page \n\nKesken",
    );
  });
});
