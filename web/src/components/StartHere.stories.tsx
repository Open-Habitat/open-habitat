import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { type CatalogueSkill, skillDraft, StartHere } from "./StartHere";

const skills: CatalogueSkill[] = [
  {
    name: "skill:tests",
    source: "skill",
    scope: "project",
    terminal_only: false,
    description: "Investigate slow tests with measurements.",
    discovery: {
      repository: true,
      title: "Selvitä testien hitaus",
      topic: "Koodi ja testit",
      when: "Kun testiajo hidastaa työtä eikä syy ole selvillä.",
      example: "Selvitä tämän repon testien hitaus. Ehdota ensin mittausta.",
      start: 1,
      added: {
        author: "Fixture Author",
        at: "2026-10-20T12:00:00Z",
        commit: "a".repeat(40),
      },
    },
  },
  {
    name: "skill:review",
    source: "skill",
    scope: "project",
    terminal_only: false,
    description: "Review a focused change.",
    discovery: {
      repository: true,
      title: "Tarkista muutos",
      topic: "Koodi ja testit",
      start: 2,
    },
  },
  {
    name: "skill:meeting",
    source: "skill",
    scope: "user",
    terminal_only: false,
    description: "Summarize a meeting transcript.",
    discovery: { repository: false, topic: "Kirjoittaminen" },
  },
];
function Preview({
  noGoals = false,
  returning = false,
  state = "ready",
}: {
  noGoals?: boolean;
  returning?: boolean;
  state?: "ready" | "loading" | "error";
}) {
  const [draft, setDraft] = useState("Oma keskeneräinen ajatus.");
  const [cutoff, setCutoff] = useState<number | undefined>(
    returning ? Date.parse("2026-10-19T12:00:00Z") : undefined,
  );
  return (
    <>
      <StartHere
        skills={noGoals ? skills.filter((s) => s.scope === "user") : skills}
        state={state}
        cutoff={cutoff}
        onOpen={() => {}}
        onRetry={() => {}}
        onAcknowledge={() => setCutoff(Date.now())}
        onTry={(s) => setDraft(skillDraft(s, draft))}
      />
      <label>
        Luonnos
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} />
      </label>
    </>
  );
}
const meta = {
  title: "Production/StartHere",
  component: Preview,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const FirstVisit: Story = { render: () => <Preview /> };
export const Returning: Story = { render: () => <Preview returning /> };
export const NoStartingGoals: Story = { render: () => <Preview noGoals /> };
export const Unavailable: Story = { render: () => <Preview state="error" /> };
export const Loading: Story = { render: () => <Preview state="loading" /> };
