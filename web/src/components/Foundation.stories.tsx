import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConversationFrame, ConversationStream } from "./ConversationFrame";
import { Icon } from "./Icon";
import { AgentHeader } from "./Navigation";
import { Button } from "./Primitives";
import { StatusMark } from "./Status";

const meta = {
  title: "Production/V2 foundation",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const noop = () => {};
function Example({ theme }: { theme: "light" | "dark" }) {
  return (
    <div
      data-theme={theme}
      style={{
        height: 700,
        background: "var(--ah-bg)",
        color: "var(--ah-ink)",
      }}
    >
      <ConversationFrame>
        <AgentHeader
          title="Muistutuksen testaus"
          activityLabel="Työskentelee"
          activityAnimated
          controlLabel="Selainohjaus"
          workspaceLabel="aurinkokello"
          workspaceHref="/workspaces"
          detailsExpanded={false}
          onToggleDetails={noop}
        />
        <ConversationStream>
          <p>Keskustelun sisältö</p>
          <StatusMark kind="success" label="Vuoro valmis" />
          <StatusMark kind="error" label="Virhe" tone="danger" />
          <StatusMark kind="unknown" label="Ei tiedossa" />
          <StatusMark kind="read-only" label="Vain luku" />
          <StatusMark kind="pill" label="Jonossa 2" />
        </ConversationStream>
        <div className="ah-actions">
          <Button size="row" label="Lähetä" onPress={noop} />
          <Button size="row" label="Keskeytä" variant="quiet" onPress={noop} />
          <Button
            size="row"
            label="Ei käytettävissä"
            availability={{ state: "unknown", reason: "Odotetaan yhteyttä." }}
            onPress={noop}
          />
          <Icon name="copy" />
        </div>
      </ConversationFrame>
    </div>
  );
}
export const Light: Story = { render: () => <Example theme="light" /> };
export const Dark: Story = { render: () => <Example theme="dark" /> };

export const TitleGenerating: Story = {
  render: () => (
    <AgentHeader
      title="CI-ajon aikakatkaisu, joka toistuu vain maanantaiaamuisin"
      titlePending
      activityLabel="Odottaa sinua"
      controlLabel="Selainohjaus"
      workspaceLabel="aurinkokello"
      workspaceHref="/workspaces"
      detailsExpanded={false}
      onToggleDetails={noop}
      titleAction={{
        label: "Luo uusi otsikko",
        availability: { state: "enabled" },
        onPress: noop,
      }}
    />
  ),
};
