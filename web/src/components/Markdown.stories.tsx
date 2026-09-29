import type { Meta, StoryObj } from "@storybook/react-vite";
import { AssistantMessage, UserMessage } from "./Conversation";
import { Markdown } from "./Markdown";

const meta = { title: "Production/Markdown" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const noop = () => {};

export const Conversation: Story = {
  render: () => (
    <div className="ah-feed">
      <UserMessage
        sourceText="Voitko tarkistaa `asetukset.json`?"
        onCopy={noop}
      />
      <AssistantMessage streamState="complete" onCopy={noop}>
        <Markdown
          text={
            '## Tarkistus\n\nTiedosto sisältää **kelvollisen** JSONin.\n\n```json\n{"nimi": "Ääkköset 🦊 中", "ok": true}\n```\n\n| Kenttä | Tila |\n| --- | --- |\n| nimi | valmis |\n\n[Ohje](https://example.org)'
          }
        />
      </AssistantMessage>
    </div>
  ),
};
export const HostileAndNarrow: Story = {
  render: () => (
    <div style={{ width: "min(100%, 390px)" }} className="ah-feed">
      <AssistantMessage streamState="complete" onCopy={noop}>
        <Markdown
          text={
            "<script>alert(1)</script>\n\n[ei avata](javascript:alert(1))\n\n```text\n" +
            "Ä🦊中" +
            "x".repeat(3800) +
            "\n```"
          }
        />
      </AssistantMessage>
    </div>
  ),
};
