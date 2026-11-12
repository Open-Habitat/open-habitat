import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AssistantMessage,
  ConversationTimeline,
  UserMessage,
  WaitingMessage,
} from "./Conversation";
import { Markdown } from "./Markdown";

describe("untrusted conversation Markdown", () => {
  it("marks transcript rows by kind without erasing exceptional or tool content", () => {
    const { container } = render(
      <ConversationTimeline
        state="ready"
        items={[
          {
            id: "u",
            kind: "user",
            content: <UserMessage sourceText="Hei" onCopy={() => {}} />,
          },
          { id: "tool", kind: "tool", content: <pre>Työkalun tulos</pre> },
          {
            id: "unknown",
            kind: "unknown",
            content: <p>Tuntematon tapahtuma</p>,
          },
        ]}
        historyMode="pagedAccessible"
        onJumpToLatest={() => {}}
      />,
    );
    expect(
      Array.from(container.querySelectorAll(".ah-feed > li"), (row) =>
        row.getAttribute("data-kind"),
      ),
    ).toEqual(["user", "tool", "unknown"]);
    expect(screen.getByText("Työkalun tulos")).toBeTruthy();
    expect(screen.getByText("Tuntematon tapahtuma")).toBeTruthy();
  });
  it.each([
    [
      "sent",
      (text: string) => <UserMessage sourceText={text} onCopy={() => {}} />,
    ],
    [
      "held",
      (text: string) => (
        <WaitingMessage text={text} state="waiting" onCopy={() => {}} />
      ),
    ],
  ])(
    "formats the person's %s message as safe Markdown, one line per typed line",
    async (_, view) => {
      const text =
        "**worker** First\nSecond\nThird\n\n- item\n\n<script>bad()</script>";
      const { container } = render(view(text));
      const content = screen.getByTestId("user-content");
      await waitFor(
        () =>
          expect(content.querySelector("strong")?.textContent).toBe("worker"),
        { timeout: 10000 },
      );
      expect(content.querySelector("ul > li")?.textContent).toBe("item");
      // A typed newline must stay a line break, not a soft break that joins
      // the lines into one paragraph.
      const lines = content.querySelector("p");
      expect(lines?.querySelectorAll("br")).toHaveLength(2);
      expect(lines?.textContent).toBe("worker First\nSecond\nThird");
      expect(container.querySelector("script")).toBeNull();
    },
  );
  it("formats GFM, code and copy controls without interpreting raw HTML", async () => {
    const { container } = render(
      <Markdown
        text={
          '**Vahva** ~~pois~~\n\n```json\n{"ok": true}\n```\n\n<script>alert(1)</script>'
        }
      />,
    );
    // The lazy renderer chunk can take longer than Testing Library's 1 s
    // default to load while the clean gate is installing/building in parallel.
    expect(
      (await screen.findByText("Vahva", {}, { timeout: 10000 })).tagName,
    ).toBe("STRONG");
    expect(screen.getByText("pois").tagName).toBe("DEL");
    expect(screen.getByTestId("output-copy")).toBeTruthy();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).not.toContain("alert(1)");
  });

  it("detects only a closed unlabelled fence, not a growing partial fence", async () => {
    const code = 'def hello():\n  return "hello"\n'.repeat(8);
    const { container, rerender } = render(<Markdown text={`~~~\n${code}`} />);
    await screen.findByTestId("output-copy");
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(container.querySelector(".hljs-keyword")).toBeNull();
    rerender(<Markdown text={`~~~\n${code}~~~`} />);
    await waitFor(() =>
      expect(container.querySelector(".hljs-keyword")).not.toBeNull(),
    );
  });

  it("rejects dangerous URLs and retains only safe external links", async () => {
    const { container } = render(
      <Markdown
        text={
          "[bad](javascript:alert%281%29) [data](data:text/html,hi) [safe](https://example.org) [relative](/help) ![image](https://example.org/a.png)"
        }
      />,
    );
    await screen.findByText("safe");
    const links = Array.from(container.querySelectorAll("a"));
    expect(links).toHaveLength(4);
    expect(links[0].hasAttribute("href")).toBe(false);
    expect(links[1].hasAttribute("href")).toBe(false);
    expect(links[2].getAttribute("href")).toBe("https://example.org");
    expect(links[2].getAttribute("rel")).toBe("noopener noreferrer");
    expect(links[3].getAttribute("href")).toBe("/help");
    expect(container.querySelector("img")).toBeNull();
  });

  it("keeps long Unicode, nested lists and wide tables within a scrollable layout", async () => {
    const text = `Ä🦊中${"x".repeat(65000)}\n\n${"> ".repeat(20)}teksti\n\n| A | B |\n| --- | --- |\n| pitkä | arvo |`;
    const { container } = render(
      <ConversationTimeline
        state="ready"
        items={[
          {
            id: "long",
            content: (
              <AssistantMessage onCopy={() => {}}>
                <Markdown text={text} />
              </AssistantMessage>
            ),
          },
        ]}
        historyMode="pagedAccessible"
        onJumpToLatest={() => {}}
      />,
    );
    await waitFor(() =>
      expect(container.querySelector(".ah-markdown-table table")).toBeTruthy(),
    );
    expect(container.querySelector(".ah-feed > li .ah-message")).toBeTruthy();
    expect(container.textContent).toContain("Ä🦊中");
  });

  it("keeps short table cells whole and names the scroll wrapper", async () => {
    const { container } = render(
      <Markdown
        text={
          "| Pvm | h | Kuvaus |\n| --- | ---: | --- |\n| 11-10 | 8,25 | Työpäivä Contosoilla: suunnittelusäännöt ja agentin käyttöönotto |\n"
        }
      />,
    );
    const region = await screen.findByRole("group", { name: "Taulukko" });
    expect(region.querySelector("table")).toBeTruthy();
    const short = Array.from(
      container.querySelectorAll(".ah-markdown-cell-short"),
    ).map((cell) => cell.textContent);
    expect(short).toEqual(["Pvm", "h", "Kuvaus", "11-10", "8,25"]);
    const hours = Array.from(container.querySelectorAll("td")).find(
      (cell) => cell.textContent === "8,25",
    );
    expect(hours?.style.textAlign).toBe("right");
  });
});
