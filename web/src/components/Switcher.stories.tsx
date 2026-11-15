import type { Meta, StoryObj } from "@storybook/react";
import { textNow } from "../i18n";
import { switcherText } from "../text/switcher";
import {
  SearchBand,
  SearchDoor,
  Switcher,
  type SwitcherItem,
} from "./Switcher";

const t = textNow(switcherText);
const many: SwitcherItem[] = [
  {
    kind: "conversation",
    key: "c-tiles",
    title: "Karttatiilten välimuisti",
    titleTerms: ["kart"],
    workspace: "retkiopas",
    mark: "working",
    ago: "tänään",
    line: {
      who: "Agentti",
      text: "Lisäsin reittinäkymään painikkeen ”Tallenna kartta”.",
      terms: ["kart"],
    },
    more: { count: 3, open: true },
  },
  {
    kind: "hit",
    key: "h-tiles-1",
    who: "Sinä",
    text: "Voisiko kartan tallentaa etukäteen koko reitin alueelta?",
    terms: ["kart"],
    ago: "tänään",
  },
  {
    kind: "conversation",
    key: "c-a11y",
    title: "Saavutettavuuskorjaukset",
    titleTerms: [],
    workspace: "kotisivu",
    mark: "waiting",
    ago: "tänään",
    line: {
      who: "Agentti",
      text: "Upotetulla kartalla ei ole tekstivaihtoehtoa.",
      terms: ["kart"],
    },
  },
  {
    kind: "conversation",
    key: "c-provider",
    title: "Karttapalvelun vaihto",
    titleTerms: ["kart"],
    workspace: "retkiopas",
    mark: "idle",
    archived: true,
    ago: "39 pv sitten",
  },
];

const meta = {
  title: "Production/Switcher",
  component: Switcher,
  args: {
    open: true,
    query: "kartta",
    items: many,
    foot: t.foot("Enter"),
    words: t,
    selected: 0,
    onQuery: () => {},
    onSelect: () => {},
    onChoose: () => {},
    onExpand: () => {},
    onClose: () => {},
  },
} satisfies Meta<typeof Switcher>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ManyHits: Story = {};
export const Recent: Story = {
  args: {
    query: "",
    heading: t.recent,
    items: [
      {
        ...(many[2] as Extract<SwitcherItem, { kind: "conversation" }>),
        line: undefined,
        previous: true,
      },
      { kind: "continue", key: "continue", label: t.continueSearch("kartta") },
    ],
  },
};
export const Building: Story = {
  args: { status: t.building(120, 363), items: many.slice(2) },
};
export const NoHits: Story = {
  args: { query: "laskutus", items: [], empty: t.empty("laskutus") },
};
export const BandAndDoor: Story = {
  render: () => (
    <div
      style={{ maxWidth: 640, margin: "24px auto", display: "grid", gap: 16 }}
    >
      <SearchDoor label={t.door} keyHint="Ctrl+K" onOpen={() => {}} />
      <SearchBand
        text={t.jump("kartta", t.who.assistant, t.ago(0))}
        keyHint={t.jumpBack("Ctrl+K")}
        closeLabel={t.close}
        onClose={() => {}}
      />
    </div>
  ),
};
