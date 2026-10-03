import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import { Button, RefreshIconButton, TextField } from "./Primitives";
import { LinkRow } from "./ControlElements";
import { Menu, Disclosure } from "./Overlays";

// Provisional palette values: hover=surface-2/accent-soft, pressed=accent-soft/accent-line,
// focus=accent outline, selection=accent-soft, disabled=line/muted, pending=muted opacity.
// design-control-states decides the final values for both themes. Hover, press and tab
// here: these are production controls, not static mock states.
const meta = {
  title: "Production/Interaction states",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const noop = () => {};
function Example({ theme }: { theme: "light" | "dark" }) {
  return (
    <MemoryRouter initialEntries={["/workspaces"]}>
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
          Väliaikaiset palettiarvot designerin tilamatriisiin: hover (surface-2
          / accent-soft), painettu (accent-soft / accent-line), fokus
          (accent-ääriviiva), valittu (accent-soft), estetty (line / muted),
          odottava (opacity). Kokeile hiirellä ja näppäimistöllä.
        </p>
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
    </MemoryRouter>
  );
}
export const Light: Story = { render: () => <Example theme="light" /> };
export const Dark: Story = { render: () => <Example theme="dark" /> };
