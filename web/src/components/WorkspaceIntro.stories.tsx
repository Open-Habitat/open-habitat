import type { Meta, StoryObj } from "@storybook/react-vite";
import type { StartPage } from "../app/composerReads";
import { WorkspaceIntro } from "./WorkspaceIntro";
import "../app/WorkspacePage.css";

const authored: StartPage = {
  title: "Aurinkokello",
  body: "Komentorivityökalu ja pieni verkkosivu, jotka laskevat auringonnousun ja -laskun annetulle paikalle. Laskenta on `src/aurinko.py`:ssä, ja sivu käyttää samaa kirjastoa.\n\nTestit ajetaan komennolla `make test`. Älä muuta kaupunkilistaa käsin.",
  goals: [
    {
      title: "Korjaa havaittu virhe",
      when: "Laskettu aika on väärä tai komento kaatuu.",
      what: "Korjaus ja testi.",
      steps: ["Toista virhe.", "Korjaa juurisyy."],
      prompt: "Selvitä syy ja korjaa.\n\n[kuvaile havainto]",
      skill: "korjaa",
    },
    {
      title: "Lisää uusi kaupunki",
      when: "Haluat paikan, jota listassa ei vielä ole.",
      what: "Kaupunki listassa.",
      steps: ["Lisää koordinaatit."],
      prompt: "Lisää kaupunki [kaupunki] listaan.",
    },
    {
      title: "Paranna verkkosivua",
      when: "Sivun ulkoasu tai teksti kaipaa muutosta.",
      what: "Parempi sivu.",
      steps: ["Kuvaa muutos."],
      prompt: "Paranna verkkosivua.",
    },
    {
      title: "Valmistele julkaisu",
      when: "Muutokset ovat valmiita ja haluat uuden version.",
      what: "Julkaisu.",
      steps: ["Päivitä muutosloki."],
      prompt: "Valmistele julkaisu.",
    },
  ],
};

const meta = {
  title: "Production/WorkspaceIntro",
  component: WorkspaceIntro,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="ah-workspace-page">
        <Story />
      </div>
    ),
  ],
  args: {
    page: authored,
    state: "ready",
    onRetry: () => {},
    onGoal: () => {},
    onCreatePage: () => {},
  },
} satisfies Meta<typeof WorkspaceIntro>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Authored: Story = {};
export const Preparing: Story = {
  args: { preparing: authored.goals[0] },
};
export const Absent: Story = { args: { page: null } };
export const NeedsUpdate: Story = { args: { page: { state: "needs_update" } } };
export const Unavailable: Story = { args: { state: "error" } };
