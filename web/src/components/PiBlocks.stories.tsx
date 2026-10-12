import type { Meta, StoryObj } from "@storybook/react-vite";
import { timelineItems } from "../app/HistoryView";
import type { HistoryEntry } from "../app/history";
import { ConversationTimeline } from "./Conversation";

const meta = {
  title: "Production/Pi blocks",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const content = (text: string): HistoryEntry["content"] => ({
  media_type: "text/plain",
  text,
  complete: true,
});
const entries: HistoryEntry[] = [
  {
    entry_key: "u",
    kind: "user",
    content: content(
      "Tarkista README.md – vastaako asennusohje nykyistä rakennetta?",
    ),
    blocks: [
      {
        type: "text",
        text: "Tarkista README.md – vastaako asennusohje nykyistä rakennetta?",
      },
    ],
  },
  {
    entry_key: "a",
    kind: "assistant",
    model: "gpt-5-codex",
    content: content(""),
    blocks: [
      { type: "thinking", text: "Luen ensin ohjeen." },
      { type: "text", text: "Luen README:n." },
      {
        type: "toolCall",
        tool_call_id: "read-1",
        tool_name: "read",
        readable: false,
      },
    ],
  },
  {
    entry_key: "r",
    kind: "tool",
    tool_call_id: "read-1",
    content: content("read\n# Ohje"),
    blocks: [{ type: "text", text: "# Ohje\n\nAsenna Go 1.27.1." }],
  },
  {
    entry_key: "answer",
    kind: "assistant",
    content: content(""),
    blocks: [{ type: "text", text: "Ohje vastaa nykyistä rakennetta." }],
  },
  {
    entry_key: "bash-call",
    kind: "assistant",
    model: "gpt-5-codex",
    content: content(""),
    blocks: [
      { type: "thinking", text: "**Tarkistan tulosteen**" },
      {
        type: "toolCall",
        tool_call_id: "bash-1",
        tool_name: "bash",
        text: JSON.stringify({
          command: "cat <<EOF\nensimmäinen\ntoinen\nEOF",
        }),
      },
    ],
  },
  {
    entry_key: "bash-result",
    kind: "tool",
    tool_call_id: "bash-1",
    content: content(""),
    blocks: [
      {
        type: "text",
        text: Array.from({ length: 53 }, (_, i) => `rivi ${i + 1}`).join("\n"),
      },
    ],
  },
  {
    entry_key: "bash-reply",
    kind: "assistant",
    model: "gpt-5-codex",
    content: content("Tuloste tarkistettu."),
    blocks: [{ type: "text", text: "Tuloste tarkistettu." }],
  },
  {
    entry_key: "local",
    kind: "bash",
    exit_code: 1,
    output_truncated: true,
    content: content(""),
    blocks: [
      { type: "text", text: "go test ./..." },
      { type: "text", text: "FAIL  example" },
    ],
  },
  {
    entry_key: "summary",
    kind: "unknown",
    entry_type: "compaction",
    content: content(""),
    blocks: [{ type: "text", text: "Keskustelu tiivistettiin." }],
  },
  {
    entry_key: "future",
    kind: "unknown",
    content: content(""),
    blocks: [{ type: "unknown" }],
  },
];
const render = () => (
  <main style={{ maxWidth: 800, margin: "auto", padding: 24 }}>
    <h1>Pi · natiivihistorian näkyvät lohkot</h1>
    <ConversationTimeline
      state="ready"
      items={timelineItems(entries)}
      historyMode="pagedAccessible"
      onJumpToLatest={() => {}}
    />
  </main>
);
export const Light: Story = { render };
export const Dark: Story = { render, globals: { theme: "dark" } };
