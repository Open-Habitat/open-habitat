import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { ConversationFrame, ConversationStream } from "./ConversationFrame";
import { AgentHeader, AppShell, WorkspaceRail } from "./Navigation";
import { Button } from "./Primitives";

const meta = {
  title: "Production/Shell scroll",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const noop = () => {};
const messages = Array.from({ length: 40 }, (_, i) => ({
  id: `message-${i}`,
  number: i + 1,
}));

function Example({
  theme,
  document = false,
}: {
  theme: "light" | "dark";
  document?: boolean;
}) {
  return (
    <MemoryRouter initialEntries={["/agents/pi:example"]}>
      <div data-theme={theme}>
        <AppShell
          mobileTitle="Keskustelu"
          rail={
            <WorkspaceRail
              collapsed={false}
              serverLabel="esimerkki.test"
              connectionLabel="Yhdistetty"
              connectionTone="success"
              runningCount={0}
              unreadReplyHrefs={[]}
              filterValue=""
              resultSummary="1 työtila"
              listState="ready"
              onToggle={noop}
              onFilter={noop}
              onRefresh={noop}
            >
              <p>esimerkki</p>
            </WorkspaceRail>
          }
          main={
            document ? (
              <section className="ah-state">
                <h1>Vieritettävä sivu</h1>
                {messages.map((message) => (
                  <p key={message.id}>
                    Osio {message.number}. Navigaatio pysyy näkyvissä myös
                    työtilalistalla ja asetuksissa.
                  </p>
                ))}
              </section>
            ) : (
              <div className="ah-state">
                <ConversationFrame>
                  <AgentHeader
                    title="Vieritä myös tekstin vierestä"
                    activityLabel="Valmis"
                    controlLabel="Vain luku"
                    detailsExpanded={false}
                    onToggleDetails={noop}
                    workspaceLabel="esimerkki"
                    workspaceHref="/workspaces"
                  />
                  <ConversationStream>
                    {messages.map((message) => (
                      <p key={message.id}>
                        Viesti {message.number}. Yläpalkki pysyy paikallaan, kun
                        vierität keskustelua tekstipalstan kummaltakin puolelta.
                      </p>
                    ))}
                  </ConversationStream>
                  <div className="ah-actions">
                    <Button size="row" label="Lähetä" onPress={noop} />
                  </div>
                </ConversationFrame>
              </div>
            )
          }
        />
      </div>
    </MemoryRouter>
  );
}

export const Light: Story = { render: () => <Example theme="light" /> };
export const Dark: Story = { render: () => <Example theme="dark" /> };

export const LongPageLight: Story = {
  render: () => <Example theme="light" document />,
};
export const LongPageDark: Story = {
  render: () => <Example theme="dark" document />,
};
