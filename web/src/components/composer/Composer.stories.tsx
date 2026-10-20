import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useState } from "react";
import type { FilePreview } from "../../app/composerReads";
import { type ChoiceGroup, ChoiceList } from "./ChoiceList";
import { CommandRun } from "./CommandRun";
import { Composer, type ComposerSources } from "./Composer";
import { Palette } from "./Palette";

// Production components only, with synthetic data. The lists open from typing
// or a button in the app; here each list state is also shown on its own.

const meta = {
  title: "Production/Composer area (Rivillä)",
  parameters: {
    docs: {
      description: {
        component:
          "Kirjoituskenttä alariveineen: Komennot, Tiedosto, viestin tapa, Pysäytä ja Lähetä. Ei yhteyttä Pi:hin; lähteet ovat synteettisiä.",
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({
    answered_by: "running",
    commands: [
      {
        name: "skill:git-commit",
        description: "Stage and commit working-tree changes.",
        source: "skill",
        scope: "user",
        terminal_only: false,
      },
      {
        name: "review",
        description: "Review the working-tree diff before committing",
        source: "prompt",
        scope: "user",
        terminal_only: false,
      },
      {
        name: "mcp",
        description: "Manage MCP servers",
        source: "extension",
        scope: "builtin",
        terminal_only: true,
      },
    ],
  }),
  files: async () => ({
    files: [
      { path: "scripts/status_rows.py", git: "modified" },
      { path: "notes/2026-10-13-status.md", git: "untracked" },
      { path: "README.md" },
      { path: "Makefile" },
    ],
    truncated: false,
  }),
  workspaceName: "aurinkokello",
};

function Frame({
  children,
  narrow,
}: {
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <main
      className="ah-conversation-frame"
      style={{
        maxWidth: narrow ? 390 : 780,
        paddingTop: 220,
        display: "grid",
        gap: 20,
      }}
    >
      {children}
    </main>
  );
}

function Live({
  initial = "",
  activity = "idle",
  mode = "steer",
  queue,
  running,
  model,
}: {
  initial?: string;
  activity?: "idle" | "working";
  mode?: "steer" | "follow_up";
  queue?: { steering: string[]; followUp: string[] };
  running?: boolean;
  model?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [working, setWorking] = useState(mode);
  return (
    <Composer
      value={value}
      onChange={setValue}
      activity={activity}
      selectedWorkingMode={working}
      onModeChange={setWorking}
      onSendNow={noop}
      onSteer={noop}
      onFollowUp={noop}
      onInterrupt={activity === "working" ? noop : undefined}
      queue={queue}
      onRestoreQueue={noop}
      sources={sources}
      modelPicker={
        model ? (
          <button type="button" className="md-pill">
            Agentin oletus · medium
          </button>
        ) : undefined
      }
      shell={{
        workspaceLabel: "~/src/aurinkokello",
        onRun: noop,
        onStop: noop,
        running: running
          ? {
              command: "make serve",
              excludeFromContext: false,
              state: "running",
              startedAt: Date.now() - 5000,
            }
          : undefined,
      }}
    />
  );
}

export const Idle: Story = {
  render: () => (
    <Frame>
      <Live />
    </Frame>
  ),
};
export const NewConversationWithModel: Story = {
  render: () => (
    <Frame>
      <Live model />
    </Frame>
  ),
};
export const PiWorkingWithDraft: Story = {
  render: () => (
    <Frame>
      <Live activity="working" initial="Päivitä myös README" />
    </Frame>
  ),
};
export const QueuedSteerAndFollowUp: Story = {
  render: () => (
    <Frame>
      <Live
        activity="working"
        initial="Päivitä myös README"
        queue={{
          steering: ["Älä muuta testien odotusarvoja."],
          followUp: [
            "Kun olet valmis, aja koko testisarja ja näytä yhteenveto.",
          ],
        }}
      />
    </Frame>
  ),
};
export const FollowUpModeChosen: Story = {
  render: () => (
    <Frame>
      <Live activity="working" mode="follow_up" />
    </Frame>
  ),
};
export const ShellCommandTyped: Story = {
  render: () => (
    <Frame>
      <Live initial="!make serve" />
      <Live initial="!!git status" />
    </Frame>
  ),
};
export const ShellCommandRunning: Story = {
  render: () => (
    <Frame>
      <CommandRun
        command="make serve"
        excludeFromContext={false}
        state="running"
        startedAt={Date.now() - 5000}
        output={
          "python3 -m http.server 8000 --directory docs\nServing HTTP on 0.0.0.0 port 8000 ...\n"
        }
      />
      <Live running />
    </Frame>
  ),
};
export const CommandBlockStates: Story = {
  render: () => (
    <Frame>
      <CommandRun
        command="pytest -q"
        excludeFromContext={false}
        state="finished"
        exitCode={1}
        output={"..........F.\n1 failed, 11 passed in 0.84s\n"}
      />
      <CommandRun
        command="git status"
        excludeFromContext
        state="cancelled"
        output={"On branch main\n"}
      />
      <CommandRun
        command="ls"
        excludeFromContext={false}
        state="held"
        output=""
      />
    </Frame>
  ),
};
export const PhoneWhilePiWorks: Story = {
  render: () => (
    <Frame narrow>
      <Live
        activity="working"
        queue={{ steering: ["Älä muuta testejä."], followUp: [] }}
      />
      <Live running />
    </Frame>
  ),
};

const commandGroups: ChoiceGroup[] = [
  {
    label: "Agentti · lisätään viestin alkuun, ajetaan lähetettäessä",
    choices: [
      {
        type: "command",
        name: "review",
        description: "Review the working-tree diff before committing",
        tag: "Pohja · oma",
        tone: "prompt",
      },
      {
        type: "command",
        name: "skill:git-commit",
        description: "Stage and commit working-tree changes.",
        tag: "Taito · oma",
        tone: "skill",
      },
      {
        type: "command",
        name: "mcp",
        description: "Manage MCP servers",
        tag: "Laajennus · Pi",
        tone: "extension",
        terminalOnly: true,
      },
    ],
  },
];
const fileGroups: ChoiceGroup[] = [
  {
    label: "Muutetut",
    choices: [
      { type: "file", path: "scripts/status_rows.py", git: "modified" },
      { type: "file", path: "notes/2026-10-13-status.md", git: "untracked" },
    ],
  },
  {
    label: "Tiedostot",
    choices: [
      { type: "file", path: "README.md" },
      { type: "file", path: "pyproject.toml" },
    ],
  },
];

function Pop({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: "relative", height: 340 }}>
      <div className="ah-choice-pop" style={{ left: 0, bottom: 0 }}>
        {children}
      </div>
    </div>
  );
}

export const CaretCommandList: Story = {
  render: () => (
    <Frame>
      <Pop>
        <div className="ah-choice-head">Komennot ja taidot</div>
        <ChoiceList
          id="story-cmds"
          label="Komennot ja taidot"
          groups={commandGroups}
          selected={0}
          emptyText="Ei osumia."
          onPick={noop}
        />
      </Pop>
    </Frame>
  ),
};
export const CommandListWhileHelperLoads: Story = {
  render: () => (
    <Frame>
      <Pop>
        <div className="ah-choice-head">Komennot ja taidot</div>
        <ChoiceList
          id="story-loading"
          label="Komennot ja taidot"
          groups={[
            {
              label: "Pi",
              choices: [
                {
                  type: "status",
                  text: "Haetaan agentin komennot ja taidot työtilasta…",
                  loading: true,
                },
              ],
            },
          ]}
          selected={-1}
          emptyText="Ei osumia."
          onPick={noop}
        />
      </Pop>
    </Frame>
  ),
};
export const CaretFileList: Story = {
  render: () => (
    <Frame>
      <Pop>
        <div className="ah-choice-head">Tiedostot · aurinkokello</div>
        <ChoiceList
          id="story-files"
          label="Tiedostot"
          groups={fileGroups}
          selected={0}
          emptyText="Ei osumia."
          onPick={noop}
        />
      </Pop>
    </Frame>
  ),
};

const preview = async (path: string): Promise<FilePreview> => ({
  path,
  kind: "diff",
  text: '@@ -1,3 +1,4 @@\n-def select(rows, since):\n+def select(rows, since, today):\n+    """Rows from since to today."""\n     return rows\n',
  truncated: false,
});
export const PalettePickingTwoFiles: Story = {
  render: () => (
    <Palette
      listId="story-palette"
      tab="changed"
      query=""
      groups={[fileGroups[0]]}
      selected={0}
      marks={new Set(["scripts/status_rows.py", "notes/2026-10-13-status.md"])}
      shell={false}
      changedCount={2}
      preview={preview}
      onQuery={noop}
      onTab={noop}
      onPick={noop}
      onHover={noop}
      onKeyDown={noop}
      onClose={noop}
    />
  ),
};
