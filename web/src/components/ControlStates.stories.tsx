import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, RefreshIconButton, TextField } from "./Primitives";
import { ControlButton, LinkRow } from "./ControlElements";
import { Menu, Disclosure } from "./Overlays";

const meta = {
  title: "Production/Interaction states",
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
        padding: 32,
        background: "var(--ah-bg)",
        color: "var(--ah-ink)",
        minHeight: "100vh",
        display: "grid",
        alignContent: "start",
        gap: 16,
      }}
    >
      <h1>Vuorovaikutustilat · {theme}</h1>
      <p>
        Tuotannon kontrollit: hover, painallus ja näppäimistöfokus ovat
        kokeiltavissa. Alla myös toistettava tilamatriisi molemmille teemoille
        ja kosketusleveydelle.
      </p>
      <section
        aria-label="Painikkeiden tilamatriisi"
        style={{ display: "grid", gap: 12, overflowX: "auto" }}
      >
        {(
          ["primary", "secondary", "quiet", "danger", "danger-subtle"] as const
        ).map((variant) => (
          <div
            key={variant}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <strong style={{ minWidth: 110 }}>{variant}</strong>
            {(["rest", "hover", "pressed", "focus"] as const).map((state) => (
              <ControlButton
                key={state}
                variant={variant}
                data-ah-state={state}
                onPress={noop}
              >
                {state}
              </ControlButton>
            ))}
          </div>
        ))}
      </section>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Button label="Lähetä" onPress={noop} />
        <Button label="Keskeytä" variant="quiet" onPress={noop} />
        <Button label="Poista" variant="danger-subtle" onPress={noop} />
        <Button
          label="Ei käytettävissä"
          availability={{ state: "disabled", reason: "Ei yhteyttä" }}
          onPress={noop}
        />
        <Button label="Odotetaan" pending onPress={noop} />
        <RefreshIconButton onPress={noop} />
      </div>
      <LinkRow href="/workspaces" kind="home" current>
        Etusivu (nykyinen)
      </LinkRow>
      <LinkRow href="/agents/example" kind="agent">
        Agentti
      </LinkRow>
      <LinkRow href="/agents/example" kind="return">
        Jatka keskustelua
      </LinkRow>
      <Menu
        label="Tilivalikko"
        items={[
          { id: "settings", label: "Asetukset" },
          { id: "theme", label: "Vaalea", selected: true, group: "theme" },
          {
            id: "blocked",
            label: "Estetty",
            availability: { state: "disabled", reason: "Ei yhteyttä" },
          },
        ]}
        onAction={noop}
      />
      <Disclosure label="Lisätiedot" expanded={false} onToggle={noop}>
        Sisältö
      </Disclosure>
      <TextField label="Nimi" value="Esimerkki" onChange={noop} />
    </div>
  );
}
export const Light: Story = { render: () => <Example theme="light" /> };
export const Dark: Story = { render: () => <Example theme="dark" /> };
