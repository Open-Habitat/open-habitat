import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useState } from "react";
import { AgentTurn, ThinkingRow, type TurnStep } from "./AgentTurn";
import { BashToolCard } from "./BashToolCard";
import { ControlButton } from "./ControlElements";
import { UserMessage } from "./Conversation";
import { Markdown } from "./Markdown";
import { PiToolUse } from "./PiBlocks";

// Interim replies as stages (Vaiheet without the turn head, Jari 19.10.2026).
// The content is the prototype round's invented fleetrepo session.
const noop = () => {};
const meta = { title: "Production/Turn stages" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const think = (key: string, text: string): TurnStep => ({
  kind: "thinking",
  key,
  node: <ThinkingRow text={text} />,
});
const bash = (
  key: string,
  command: string,
  output: string,
  state: "succeeded" | "running" | "failed" | "cancelled" = "succeeded",
): TurnStep => ({
  kind: "tool",
  key,
  failed: state === "failed",
  node: (
    <PiToolUse name="bash" state={state} targetText={command}>
      <BashToolCard
        command={command}
        output={output}
        running={state === "running"}
      />
    </PiToolUse>
  ),
});
const say = (key: string, text: string): TurnStep => ({
  kind: "text",
  key,
  text,
  node: <Markdown text={text} />,
});

// Native history saves each step's entry when it is complete; the stories
// space them out so the stage rows show a range of elapsed times.
const started = Date.parse("2026-10-24T08:00:00Z");
const timed = (steps: TurnStep[]): TurnStep[] =>
  steps.map((step, index) => ({
    ...step,
    at: started + (index + 1) * (index + 1) * 2500,
  }));

const sync: TurnStep[] = [
  think("t1", "Checking the repository state before pulling"),
  bash("b1", "git status --short --branch", "## main...origin/main [behind 3]"),
  bash("b2", "git rev-list --count origin/main..HEAD", "0"),
  say(
    "s1",
    "Working tree on puhdas, ei paikallisia committeja — pelkkä pull riittää, pushattavaa ei ole.",
  ),
  bash("b3", "git pull --rebase", "Fast-forward\n 3 files changed"),
  think("t2", "Running the fleet doctor across machines"),
  bash(
    "b4",
    "fleetrepo fleet doctor",
    "alder ok\nbrunhild ok\nhauis unreachable",
  ),
  say(
    "s2",
    "Pull meni läpi, kolme uutta committia. Doctorin mukaan `rowan` ei vastaa — katson vielä, onko kone vain unessa vai oikeasti rikki.",
  ),
  bash("b5", "ping -c 2 -W 2 rowan.local", "2 packets transmitted, 0 received"),
  say(
    "f",
    "Fleetrepo on ajan tasalla: `main` on nyt `b81d0e3`.\n\n- `alder`, `maple`, `cedar` ja `willow` ovat konvergoituneet.\n- `rowan` ei vastaa SSH:hon eikä pingiin. Kone on todennäköisesti unessa; sitä ei ole todennettu, joten en merkitse sitä rikkinäiseksi.\n\nKun kone herää, aja `fleetrepo fleet doctor rowan`.",
  ),
];

const backup: TurnStep[] = [
  think("t1", "Finding the backup timer and its last run"),
  bash(
    "b1",
    "systemctl list-timers gitea-backup.timer",
    "Fri 03:00 gitea-backup.timer",
  ),
  bash(
    "b2",
    "journalctl -u gitea-backup --since today --no-pager",
    "waiting for lock (41 s)\nsnapshot 7c1e0a94 saved",
  ),
  say(
    "s1",
    "Ajo on tehty ja päättyi onnistuneesti, mutta lokissa on kaksi asiaa, jotka kannattaa tietää ennen kuin jatkan:\n\n1. **Lukko oli varattuna.** `maple` piti restic-repon lukkoa eilisillasta 22:14 asti, ja yön ajo joutui odottamaan 41 sekuntia. Todennäköisesti läppärin oma varmuuskopio jäi kesken, kun kansi suljettiin. Tämä ei rikkonut mitään, mutta jos lukko jää pysyväksi, seuraava ajo epäonnistuu.\n2. **Tilannevedos on pienempi kuin edellinen.** `7c1e0a94` on noin 180 Mt pienempi kuin perjantain vedos. Se voi olla siivottua LFS-sisältöä, mutta en oleta sitä.\n\nTarkistan seuraavaksi arkiston eheyden `restic check`illä ja vertaan vedoksia. Se kestää noin minuutin; en poista lukkoa enkä muuta mitään.",
  ),
  bash(
    "b3",
    "restic -r /srv/backup/gitea check --read-data-subset=5%",
    "no errors were found",
  ),
  bash(
    "b4",
    "restic -r /srv/backup/gitea diff 51d9f3b2 7c1e0a94 | tail -6",
    "removed: 276 MiB\nadded: 94 MiB",
  ),
  think("t2", "The removed data matches Friday's LFS cleanup"),
  say(
    "s2",
    "Eheystarkistus ei löytänyt virheitä, ja pienentyminen selittyy perjantain LFS-siivouksella (276 Mt pois, 94 Mt uutta).",
  ),
  say(
    "f",
    "Gitean varmuuskopio on kunnossa.\n\n- Yön ajo 03:00 onnistui, tilannevedos `7c1e0a94`.\n- `restic check` (5 % datasta luettu) ei löytänyt virheitä.\n- Pienempi koko johtuu perjantain LFS-siivouksesta, ei puuttuvasta datasta.\n\nYksi asia jää sinulle: `maple`in vanha lukko. Jos haluat sen pois ennen ensi yötä, aja läppärillä `restic unlock`. En tehnyt sitä täältä, koska lukko kuuluu toisen koneen prosessille.",
  ),
];

const plain: TurnStep[] = [
  think("t1", "Reading the status"),
  bash("b1", "git status --short", ""),
  say("f", "Työpuu on puhdas."),
];

function Thread({ children }: { children: ReactNode }) {
  return (
    <main style={{ maxWidth: 820, padding: 24, display: "grid", gap: 16 }}>
      {children}
    </main>
  );
}

/** Two interim replies, each closing a stage; the answer is the last card. */
export const SeveralInterimReplies: Story = {
  render: () => (
    <Thread>
      <UserMessage
        sourceText="Synkkaa fleetrepo originin kanssa ja aja fleet doctor."
        onCopy={noop}
      />
      <AgentTurn startedAt={started} steps={timed(sync)} />
    </Thread>
  ),
};

/** A long interim reply shown in full, and one right before the answer with
 * no work between them: that stage has no summary row. */
export const LongAndBackToBack: Story = {
  render: () => (
    <Thread>
      <UserMessage
        sourceText="Selvä. Tarkista vielä, että Gitean yöllinen varmuuskopio on ajettu ja ehjä."
        onCopy={noop}
      />
      <AgentTurn startedAt={started} steps={timed(backup)} />
    </Thread>
  ),
};

/** No interim reply: one stage row where the turn head used to be. */
export const NoInterimReply: Story = {
  render: () => (
    <Thread>
      <AgentTurn startedAt={started} steps={timed(plain)} />
    </Thread>
  ),
};

/** One interim reply and a failed command in the stage after it. */
export const OneInterimAndFailure: Story = {
  render: () => (
    <Thread>
      <AgentTurn
        steps={[
          bash("b1", "git fetch", ""),
          say("s1", "Haen ensin muutokset. Sen jälkeen ajan testit."),
          bash("b2", "npm test", "1 failing", "failed"),
          say("f", "Yksi testi epäonnistuu: `parses empty input`."),
        ]}
      />
    </Thread>
  ),
};

/** Jari's case (24.10.2026): the person stopped the turn while its command
 * ran, then wrote "Jatka". The stopped command is stopped, not failed, and
 * the turn ends in its quiet mark; the next turn answers normally. */
export const StoppedThenContinued: Story = {
  render: () => (
    <Thread>
      <UserMessage
        sourceText="Millainen on readmen githistoria"
        onCopy={noop}
      />
      <AgentTurn
        startedAt={started}
        stopped={{ at: started + 4000 }}
        steps={[
          {
            ...bash("b1", "git log --follow README.md", "", "cancelled"),
            at: started + 4000,
          },
        ]}
      />
      <UserMessage sourceText="Jatka" onCopy={noop} />
      <AgentTurn
        startedAt={started + 20000}
        steps={[
          {
            ...think("t1", "Continuing with the README history"),
            at: started + 26000,
          },
          {
            ...say(
              "f",
              "README on muuttunut kolmesti: luonti, asennusohje ja lisenssi.",
            ),
            at: started + 26000,
          },
        ]}
      />
    </Thread>
  ),
};

/** Stopped while the answer was streaming: the partial answer stays. */
export const StoppedMidAnswer: Story = {
  render: () => (
    <Thread>
      <AgentTurn
        stopped={{ at: started + 9000 }}
        steps={[
          think("t1", "Reading the status"),
          say("f", "Työpuussa on kaksi muutettua tiedostoa ja"),
        ]}
      />
    </Thread>
  ),
};

/** Running: an interim reply has been written and the next stage's command
 * runs in the information row's place. */
export const LiveAfterInterim: Story = {
  render: () => (
    <Thread>
      <AgentTurn
        working
        activity="Ajaa git pull --rebase --autostash"
        duration="0:31"
        steps={[
          think(
            "t1",
            "Tarkistan ensin työpuun ja haaran tilan. Jos jotain on kesken, en koske siihen ennen kuin tiedän, mitä se on.",
          ),
          bash("b1", "git status --short --branch", " M TODO.md\n?? notes.md"),
          bash("b2", "git log --oneline origin/main..HEAD", "a41c2e7\n9f0b1d2"),
          say(
            "s1",
            "Täällä on kesken kaksi asiaa: `TODO.md` on muokattu ja `notes.md` on uusi, eikä kumpikaan ole commitissa. Lisäksi `main` on kaksi committia originia edellä. En koske muokkauksiin — teen pullin `--autostash`illa ja pushaan vain nuo kaksi committia.",
          ),
          bash("b3", "git pull --rebase --autostash", "", "running"),
        ]}
      />
    </Thread>
  ),
};

/** Running: Pi is writing; whether it is an interim reply or the answer is
 * known only when the next step arrives. */
export const LiveStreaming: Story = {
  render: () => (
    <Thread>
      <AgentTurn
        working
        activity="Vastaa"
        duration="0:44"
        steps={[
          ...sync.slice(0, 4),
          bash("b3", "git pull --rebase", "Fast-forward"),
          say("s2", "Pull meni läpi, kolme uutta committia. Doctorin mukaan"),
        ]}
      />
    </Thread>
  ),
};

function CompletionPreview() {
  const [working, setWorking] = useState(true);
  return (
    <Thread>
      <ControlButton size="row" onPress={() => setWorking(!working)}>
        {working ? "Päätä vuoro" : "Näytä kirjoittaminen"}
      </ControlButton>
      <AgentTurn
        working={working}
        activity="Vastaa"
        duration="0:44"
        steps={plain}
      />
    </Thread>
  );
}

/** The shared pulsing mark stops with the turn; no completion notice is added. */
export const AnswerCompletion: Story = { render: () => <CompletionPreview /> };
