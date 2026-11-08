import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useState } from "react";
import type { FilePreview, TreeFolder } from "../../app/composerReads";
import { textNow } from "../../i18n";
import { composerText } from "../../text/composer";
import { fieldListText } from "../../text/fieldList";
import { type ChoiceGroup, ChoiceList } from "./ChoiceList";
import { CommandRun } from "./CommandRun";
import { Composer, type ComposerSources } from "./Composer";
import { FieldList } from "./FieldList";
import { searchChoices, treeChoices, unfolded } from "./fieldTree";
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
    matched: 4,
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

const pending = () => new Promise<never>(() => {});
const pendingSpeech = {
  mint: pending,
  microphone: pending,
  capture: pending,
  socket: () => {
    throw new Error("no stream in a story");
  },
  now: () => Date.now(),
  setInterval: (run: () => void, ms: number) => window.setInterval(run, ms),
  clearInterval: (id: number) => window.clearInterval(id),
};

function Live({
  initial = "",
  activity = "idle",
  mode = "steer",
  queue,
  running,
  model,
  stopState,
  mic,
}: {
  initial?: string;
  activity?: "idle" | "working";
  stopState?: "pending" | "uncertain" | "rejected";
  mode?: "steer" | "follow_up";
  queue?: { steering: string[]; followUp: string[] };
  running?: boolean;
  model?: boolean;
  /** A mic whose stream never opens, so a press shows the dictation bar
   * listening. */
  mic?: boolean;
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
      stopState={stopState}
      queue={queue}
      onRestoreQueue={noop}
      sources={sources}
      csrf={mic ? "story" : undefined}
      speech={mic ? { onOpenSettings: noop, deps: pendingSpeech } : undefined}
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

export const BangSpacingAndFocus: Story = {
  render: () => (
    <>
      {(["light", "dark"] as const).map((theme) => (
        <div
          key={theme}
          data-theme={theme}
          style={{ background: "var(--ah-bg)", padding: 16 }}
        >
          <Frame>
            <Live initial="!git status" />
            <Live initial="!!ls" />
          </Frame>
          <Frame narrow>
            <Live initial="!git status" />
            <Live initial="!!ls" />
          </Frame>
        </div>
      ))}
    </>
  ),
};

export const Idle: Story = {
  render: () => (
    <Frame>
      <Live />
    </Frame>
  ),
};
// Storybook has no host, so the synthetic attachment images do not load;
// the chips and the dialog still show their layout and file facts.
const shot =
  "![CleanShot 2026-10-24 at 08.53.52@2x.png](/api/v1/attachments/6f82a1c4-1111-4111-8111-111111111111)";
const notes =
  "[mittaukset-lokakuu.csv](/api/v1/attachments/6f82a1c4-2222-4222-8222-222222222222)";
/** Attachments are chips above the field; the field keeps only the text. */
export const WithAttachments: Story = {
  render: () => (
    <>
      <Frame>
        <Live initial={`Mikä tässä on vialla?\n${shot}\n${notes}`} />
      </Frame>
      <Frame narrow>
        <Live initial={`${shot}\n${notes}`} />
      </Frame>
    </>
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
/** Stop pressed: progress shows on Stop itself, so the composer does not move. */
export const PiStopping: Story = {
  render: () => (
    <Frame>
      <Live
        activity="working"
        initial="Päivitä myös README"
        stopState="pending"
      />
    </Frame>
  ),
};
/** Pi refused the stop and keeps working: said once, and Stop works again. */
export const PiStopRefused: Story = {
  render: () => (
    <Frame>
      <Live activity="working" stopState="rejected" />
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

// The lists in the toolbar's language; a language change remounts the story.
const t = () => textNow(composerText);
const commandGroups = (): ChoiceGroup[] => [
  {
    label: t().agentAtStart,
    choices: [
      {
        type: "command",
        name: "review",
        description: "Review the working-tree diff before committing",
        tag: `${t().sources.prompt} · ${t().scopes.user}`,
        tone: "prompt",
      },
      {
        type: "command",
        name: "skill:git-commit",
        description: "Stage and commit working-tree changes.",
        tag: `${t().sources.skill} · ${t().scopes.user}`,
        tone: "skill",
      },
      {
        type: "command",
        name: "mcp",
        description: "Manage MCP servers",
        tag: `${t().sources.extension} · ${t().scopes.builtin}`,
        tone: "extension",
        terminalOnly: true,
      },
    ],
  },
];
const fileGroups = (): ChoiceGroup[] => [
  {
    label: t().changed,
    choices: [
      { type: "file", path: "scripts/status_rows.py", git: "modified" },
      { type: "file", path: "notes/2026-10-13-status.md", git: "untracked" },
    ],
  },
  {
    label: t().files,
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
        <div className="ah-choice-head">{t().commandsAndSkills}</div>
        <ChoiceList
          id="story-cmds"
          label={t().commandsAndSkills}
          groups={commandGroups()}
          selected={0}
          emptyText={t().noMatches("")}
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
        <div className="ah-choice-head">{t().commandsAndSkills}</div>
        <ChoiceList
          id="story-loading"
          label={t().commandsAndSkills}
          groups={[
            {
              label: t().agent,
              choices: [
                {
                  type: "status",
                  text: t().commandsLoading,
                  loading: true,
                },
              ],
            },
          ]}
          selected={-1}
          emptyText={t().noMatches("")}
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
        <div className="ah-choice-head">{t().filesIn("aurinkokello")}</div>
        <ChoiceList
          id="story-files"
          label={t().files}
          groups={fileGroups()}
          selected={0}
          emptyText={t().noMatches("")}
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
      groups={[fileGroups()[0]]}
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

// The lists inside the field (experimental composer-lists-in-field): the
// folder tree with the changed folder open, the search by name, and two
// marked paths, each in the field box between the text and the row.
const ft = () => textNow(fieldListText);
const listings = new Map<string, TreeFolder>([
  [
    "",
    {
      path: "",
      entries: [
        { kind: "folder", path: "docs/" },
        { kind: "folder", path: "scripts/", changed: 1 },
        { kind: "folder", path: "tests/", changed: 1 },
        { kind: "file", path: "AGENTS.md" },
        { kind: "file", path: "README.md", git: "added" },
      ],
      truncated: false,
    },
  ],
  [
    "scripts/",
    {
      path: "scripts/",
      entries: [
        { kind: "file", path: "scripts/status_rows.py", git: "modified" },
      ],
      truncated: false,
    },
  ],
  [
    "tests/",
    {
      path: "tests/",
      entries: [
        { kind: "file", path: "tests/AGENTS.md" },
        { kind: "file", path: "tests/test_status_rows.py", git: "untracked" },
      ],
      truncated: false,
    },
  ],
]);
const treeGroups = (): ChoiceGroup[] => [
  {
    label: "",
    choices:
      treeChoices(listings, unfolded, {
        loading: ft().folderLoading,
        more: ft().folderMore,
        failed: t().filesFailed,
        failedFolders: new Set(),
      }) ?? [],
  },
];
function InField({
  query = "",
  groups,
  selected,
  marks = [],
}: {
  query?: string;
  groups: ChoiceGroup[];
  selected: number;
  marks?: string[];
}) {
  return (
    <Frame>
      <div className="ah-cbox ah-cbox-listing">
        <textarea
          className="ah-cbox-field"
          aria-label={t().messageToAgent}
          defaultValue="Katso "
          rows={1}
        />
        <FieldList
          listId="story-in-field"
          kind="file"
          from="button"
          head={t().filesIn("aurinkokello")}
          note={query ? ft().matchCount(3) : ft().changedCount(3)}
          query={query}
          groups={groups}
          selected={selected}
          marks={marks}
          searchInput
          emptyText={t().noMatches(query)}
          preview={preview}
          onQuery={noop}
          onKeyDown={noop}
          onPick={noop}
          onHover={noop}
          onMark={noop}
          onClearMarks={noop}
          onAdd={noop}
        />
      </div>
    </Frame>
  );
}
export const FieldListTree: Story = {
  render: () => <InField groups={treeGroups()} selected={2} />,
};
export const FieldListSearch: Story = {
  render: () => (
    <InField
      query="AGENTS"
      groups={[
        {
          label: "",
          choices: searchChoices([
            { path: "AGENTS.md" },
            { path: "tests/AGENTS.md" },
          ]),
        },
      ]}
      selected={0}
    />
  ),
};
export const FieldListTwoMarked: Story = {
  render: () => (
    <InField
      groups={treeGroups()}
      selected={2}
      marks={["scripts/status_rows.py", "tests/"]}
    />
  ),
};

/** Sanele and Send at the right in fixed slots, Ohjaa and Stop born left
 * of them. Press Sanele to see the listening bar and Valmis in Sanele's
 * place; × or Esc cancels. */
export const DictationBar: Story = {
  render: () => (
    <>
      {(["light", "dark"] as const).map((theme) => (
        <div
          key={theme}
          data-theme={theme}
          style={{ background: "var(--ah-bg)", padding: 16 }}
        >
          <Frame>
            <Live mic />
            <Live mic activity="working" initial="Päivitä myös README" />
          </Frame>
          <Frame narrow>
            <Live mic />
            <Live mic activity="working" mode="follow_up" />
          </Frame>
        </div>
      ))}
    </>
  ),
};
