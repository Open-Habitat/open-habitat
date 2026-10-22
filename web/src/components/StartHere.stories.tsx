import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { goalDraft, StartHere } from "./StartHere";

function Preview({
  absent = false,
  needsUpdate = false,
  textOnly = false,
  state = "ready",
}: {
  absent?: boolean;
  needsUpdate?: boolean;
  textOnly?: boolean;
  state?: "ready" | "loading" | "error";
}) {
  const [draft, setDraft] = useState("Oma keskeneräinen ajatus.");
  return (
    <>
      <StartHere
        page={
          needsUpdate
            ? { state: "needs_update" }
            : absent
              ? null
              : {
                  title: "Tervetuloa projektiin",
                  body: "Tässä repossa rakennamme yhteistä palvelua.\n\nAloita **pienestä tehtävästä** tai kysy omin sanoin.",
                  goals: textOnly
                    ? []
                    : [
                        {
                          title: "Tutustu projektiin",
                          what: "Saat kartan repon rakenteesta ja yhden aloitustehtävän.",
                          steps: [
                            "Agentti lukee repon ohjeet.",
                            "Valitset ehdotetun aloitustehtävän.",
                          ],
                          when: "Kun aloitat tässä repossa.",
                          prompt: "Näytä projektin tärkeimmät osat.",
                        },
                      ],
                }
        }
        state={state}
        onRetry={() => {}}
        onGoal={(goal) => setDraft(goalDraft(goal, draft))}
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
export const AuthoredPage: Story = { render: () => <Preview /> };
export const TextOnly: Story = { render: () => <Preview textOnly /> };
export const NoPage: Story = { render: () => <Preview absent /> };
export const Unavailable: Story = { render: () => <Preview state="error" /> };
export const Loading: Story = { render: () => <Preview state="loading" /> };

export const NeedsUpdate: Story = { render: () => <Preview needsUpdate /> };
