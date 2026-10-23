import type { Meta, StoryObj } from "@storybook/react-vite";
import { GoalGuide } from "./GoalGuide";

const meta = {
  title: "Production/GoalGuide",
  component: GoalGuide,
  parameters: { layout: "padded" },
  args: {
    goal: {
      title: "Korjaa havaittu ongelma",
      what: "Saat ongelman juurisyyn, rajatun korjauksen ja tiedon ajetuista testeistä. Lisää luonnokseen havainto ja toisto-ohje ennen lähettämistä.",
      when: "Kun löydät toistettavan virheen.",
      steps: [
        "Kuvaile havainto, odotettu tulos ja miten virhe toistuu.",
        "Agentti selvittää syyn ja tekee pienen toistavan testin.",
        "Agentti korjaa juurisyyn, ajaa testit ja kertoo tarkistamatta jääneen.",
      ],
      prompt:
        "Selvitä ongelman syy: [kuvaile havainto]. Tee ensin pieni toistava testi. Korjaa juurisyy ja aja aiheeseen liittyvät testit. Kerro, mitä tarkistit ja mikä jäi tarkistamatta.",
      skill: "korjaa",
    },
    onStart: () => {},
    onBack: () => {},
  },
} satisfies Meta<typeof GoalGuide>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Guide: Story = {};
export const PreparingSkill: Story = { args: { preparing: true } };
export const PanelContent: Story = { args: { onBack: undefined } };
export const LongRequest: Story = {
  args: {
    goal: {
      ...meta.args.goal,
      title: "Valmistele seuraava julkaisu",
      prompt: `${"Tarkista seuraavan julkaisun valmius ja listaa avoimet esteet.\n".repeat(22)}docs/esimerkit/erittain-pitka-synteettinen-julkaisun-valmistelun-tarkistuslistan-tiedostonimi.md`,
    },
  },
};
