import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { AlertDialog, Dialog, Menu, Tabs } from "./Overlays";
import { AccountShelf, AccountSettings } from "./Account";
import { LoginCard, LoginErrorNotice } from "./LoginCard";
import {
  Button,
  Checkbox,
  RadioGroup,
  TextArea,
  TextField,
} from "./Primitives";
import {
  AgentFacts,
  AgentHeader,
  AppShell,
  WorkspaceRail,
  WorkspaceSection,
} from "./Navigation";
import {
  AssistantMessage,
  CodeBlock,
  Composer,
  ConversationTimeline,
  DiffView,
  QueuePanel,
  SupportedQuestion,
  ToolGroup,
  ToolOutput,
  ToolRow,
  UncertainCommandCard,
  UnknownEvent,
  UserMessage,
} from "./Conversation";
import { CapabilityNotice, OperationProgress } from "./Operations";
import {
  ConnectionBanner,
  InlineNotice,
  StatusMark,
  ToastRegion,
} from "./Status";

const meta = {
  title: "Production/Catalog",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const noop = () => {};
export const Login: Story = {
  render: () => (
    <main className="ah-login-view">
      <LoginCard onLogin={noop} />
    </main>
  ),
};
export const LoginError: Story = {
  render: () => (
    <main className="ah-login-view">
      <LoginCard onLogin={noop} />
      <LoginErrorNotice />
    </main>
  ),
};

const hostile =
  "Erittäinpitkäyhdyssana_ilman_turvallista_katkaisukohtaa_1234567890 <script>alert('ei suoriteta')</script>";

function PrimitiveFixture() {
  const [text, setText] = useState("Täsmällinen arvo");
  const [checked, setChecked] = useState(true);
  const [theme, setTheme] = useState("system");
  return (
    <main>
      <h1>Yleiset kontrollit</h1>
      <div className="ah-actions">
        <Button label="Tallenna" onPress={noop} />
        <Button label="Toissijainen" variant="secondary" onPress={noop} />
        <Button
          label="Pitkä toiminto ei ole nyt käytettävissä"
          availability={{
            state: "disabled",
            reason: "Tuore palvelinhavainto puuttuu.",
          }}
          onPress={noop}
        />
        <Button label="Poista" variant="danger" onPress={noop} />
      </div>
      <TextField
        label="Workspacen nimi"
        value={text}
        hint="Kirjainkokoa tai välilyöntejä ei muuteta."
        onChange={setText}
      />
      <TextArea
        label="Tehtävä"
        value={`${text}\n${hostile}`}
        onChange={setText}
      />
      <Checkbox
        label="Näytä arkistoidut"
        hint="Valinta on vain tässä näkymässä."
        checked={checked}
        onChange={setChecked}
      />
      <RadioGroup
        label="Teema"
        value={theme}
        options={[
          { value: "system", label: "Järjestelmä" },
          { value: "light", label: "Vaalea" },
          { value: "dark", label: "Tumma" },
        ]}
        onChange={setTheme}
      />
      <StatusMark label="Tila ei tiedossa" tone="warning" />
      <InlineNotice
        title="Kirjoittaminen on estetty"
        description="Snapshot on vanhentunut. Sisältö säilyy luettavana."
        tone="warning"
      />
    </main>
  );
}
export const Primitives: Story = { render: () => <PrimitiveFixture /> };
export const PrimitivesDark: Story = {
  render: () => <PrimitiveFixture />,
  globals: { theme: "dark" },
};
export const LongContentForZoomReview: Story = {
  render: () => <PrimitiveFixture />,
  parameters: {
    docs: {
      description: {
        story:
          "Käytä selaimen 200 % zoomia; automaattinen 1280 px / 200 % overflow-tarkistus ajetaan Playwrightilla.",
      },
    },
  },
};
export const ReducedMotion: Story = {
  render: () => (
    <main>
      <h1>Vähennetty liike</h1>
      <p>
        Story käyttää samoja tuotantokomponentteja. Selaimen reduce-asetus
        poistaa animaation ja säilyttää tekstimuotoisen tilan.
      </p>
      <StatusMark label="Työskentelee" tone="info" animated="running" />
    </main>
  ),
};

function OverlayFixture() {
  const [tab, setTab] = useState("create");
  return (
    <main>
      <h1>Valikot ja dialogit</h1>
      <div className="ah-actions">
        <Menu
          label="Toiminnot"
          items={[
            { id: "rename", label: "Nimeä uudelleen" },
            {
              id: "delete",
              label: "Poista",
              description: "Vaatii tuoreen ennakkotarkistuksen",
              availability: {
                state: "disabled",
                reason: "Vaikutukset eivät ole tiedossa",
              },
              danger: true,
            },
          ]}
          onAction={noop}
        />
        <Dialog
          triggerLabel="Avaa tiedot"
          title="Agentin tiedot"
          description="Fokus pysyy dialogissa ja palautuu avaajaan."
        >
          <AgentFacts
            facts={[
              { label: "Prosessi", value: "Ei tiedossa", state: "unknown" },
              { label: "Ohjaus", value: "Vain luku", state: "confirmed" },
            ]}
          />
        </Dialog>
        <AlertDialog
          triggerLabel="Poista workspace"
          title="Poista workspace?"
          description="Toimintoa ei voi perua."
          actionLabel="Poista"
          actionAvailability={{
            state: "disabled",
            reason: "Manuaalinen worktree estää poiston.",
          }}
          onConfirm={noop}
        />
      </div>
      <Tabs
        label="Workspacen lähde"
        selected={tab}
        tabs={[
          { id: "create", label: "Luo uusi", panel: <p>Tyhjä workspace</p> },
          {
            id: "clone",
            label: "Hae GitHubista",
            panel: (
              <CapabilityNotice
                actionLabel="GitHubista haku"
                state="unknown"
                reason="Adapteria ei ole vielä todennettu."
              />
            ),
          },
        ]}
        onChange={setTab}
      />
    </main>
  );
}
export const Overlays: Story = { render: () => <OverlayFixture /> };

function NavigationFixture() {
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState("");
  const rail = (
    <WorkspaceRail
      collapsed={false}
      serverLabel="alder.example — Native Agent Host"
      connectionLabel="Yhteys toimii"
      attentionCount={2}
      filterValue={filter}
      resultSummary="2 agenttia"
      listState="ready"
      onToggle={noop}
      onFilter={setFilter}
      onRefresh={noop}
    >
      <WorkspaceSection
        workspaceId="w-1"
        name={`asiakkaan-${hostile}`}
        href="/workspaces/w-1"
        expanded={expanded}
        summary="Git-workspace"
        agents={[
          {
            agentId: "a-1",
            href: "/workspaces/w-1/agents/a-1",
            title:
              "Korjaa kirjautumisen epävarma paluu erittäin pitkällä otsikolla joka rivittyy saavutettavasti",
            activityLabel: "Työskentelee",
            controlLabel: "Selain ohjaa",
            attentionLabel: "Odottaa vastaustasi",
            selected: true,
          },
          {
            agentId: "a-2",
            href: "/workspaces/w-1/agents/a-2",
            title: "Vanha tutkimus",
            activityLabel: "Ei käynnissä",
            controlLabel: "Vain luku",
            stale: true,
          },
        ]}
        onToggle={() => setExpanded(!expanded)}
      />
    </WorkspaceRail>
  );
  return (
    <AppShell
      connection={<ConnectionBanner state="online" />}
      rail={rail}
      main={
        <>
          <AgentHeader
            title="Korjaa kirjautumisen epävarma paluu"
            titleState="Hostin otsikko"
            activityLabel="Työskentelee"
            activityAnimated
            controlLabel="Selain ohjaa"
            workspaceLabel="asiakkaan-projekti"
            workspaceHref="/workspaces/w-1"
            detailsExpanded
            onToggleDetails={noop}
            titleAction={{
              label: "Luo otsikko uudelleen",
              pending: false,
              onPress: noop,
            }}
          />
          <AgentFacts
            facts={[
              { label: "Historia", value: "Saatavilla", state: "confirmed" },
              { label: "Prosessi", value: "not_observed", state: "unknown" },
              { label: "Ohjaus", value: "owned", state: "confirmed" },
            ]}
          />
        </>
      }
    />
  );
}
export const Navigation: Story = { render: () => <NavigationFixture /> };
export const Account: Story = {
  render: () => (
    <main>
      <AccountShelf name="Oma tili" onSettings={noop} onLogout={noop} />
      <AccountSettings name="Oma tili" nativeState="connected" onBack={noop} />
    </main>
  ),
};
export const AccountPartial: Story = {
  render: () => (
    <main>
      <AccountSettings name="Oma tili" nativeState="partial" onBack={noop} />
    </main>
  ),
};

function ConversationFixture() {
  const [mode, setMode] = useState<"virtualized" | "pagedAccessible">(
    "virtualized",
  );
  const [composer, setComposer] = useState(
    "Lisää vielä yksi tarkistus jonoon.",
  );
  const items = [
    {
      id: "u",
      content: (
        <UserMessage
          sourceText={`Tarkista turvallisuus. ${hostile}`}
          deliveryState="Hyväksytty"
          onCopy={noop}
        />
      ),
    },
    {
      id: "a",
      content: (
        <AssistantMessage
          streamState="streaming"
          modelLabel="gpt-6"
          onCopy={noop}
        >
          <p>Tarkistan ensin komponenttien rajat ja näppäimistökäytön.</p>
          <CodeBlock
            text={'const safe = "<script>";\n'.repeat(8)}
            languageLabel="TypeScript"
            sourceState="continued"
            highlightState="pending"
            onCopy={noop}
            onLoadMore={noop}
          />
          <DiffView
            pathLabel="web/src/components/Primitives.tsx"
            unifiedText={"--- a/file\n+++ b/file\n-old\n+uusi"}
            parseState="ready"
            view="unifiedAccessible"
            onCopy={noop}
            onViewChange={noop}
          />
          <ToolGroup
            title="Työkalut"
            summary="1 valmis, 1 virhe"
            expanded
            containsException
            onToggle={noop}
          >
            <ToolRow
              name="Read"
              targetText="Primitives.tsx"
              statusLabel="Valmis"
              state="Onnistui"
              expanded
              onToggle={noop}
            >
              <ToolOutput
                text="Näkyvä turvallinen tekstipala"
                streamSemantics="replacement"
                sourceState="continued"
                onCopy={noop}
                onLoadMore={noop}
              />
            </ToolRow>
          </ToolGroup>
        </AssistantMessage>
      ),
    },
    {
      id: "unknown",
      content: (
        <UnknownEvent
          kindLabel="future.event"
          safeSummary="Tapahtumaa ei tunnisteta eikä siitä päätellä onnistumista."
          safePayloadText={'{"safe":"text"}'}
          onCopy={noop}
        />
      ),
    },
  ];
  return (
    <main>
      <h1>Keskustelu</h1>
      <ConversationTimeline
        state="ready"
        items={items}
        historyMode={mode}
        newContentCount={3}
        onJumpToLatest={noop}
        onHistoryModeChange={setMode}
      />
      <Composer
        value={composer}
        availability={{ state: "enabled" }}
        activity="working"
        selectedWorkingMode="follow_up"
        queueSummary="Jonossa 2"
        onChange={setComposer}
        onSendNow={noop}
        onSteer={noop}
        onFollowUp={noop}
        onModeChange={noop}
        onInterrupt={noop}
        onOpenQueue={noop}
      />
    </main>
  );
}
export const Conversation: Story = { render: () => <ConversationFixture /> };

export const UnhappyStates: Story = {
  render: () => (
    <main>
      <h1>Tuntemattomat, vanhentuneet ja osittaiset tilat</h1>
      <ConnectionBanner state="stale" lastConfirmedAt="10.42" onRetry={noop} />
      <UncertainCommandCard
        commandLabel="Lähetä viesti"
        textPreview="Sama viesti voi toteutua kahdesti."
        commandIdLabel="cmd_01JARIKORRELAATIO"
        explanation="Palvelin ei pystynyt vahvistamaan hyväksyntää."
        availability={{ state: "enabled" }}
        onReconcile={noop}
        onCopyText={noop}
        onSendAsNew={noop}
      />
      <QueuePanel
        steeringTexts={["Tarkista testit"]}
        followUpTexts={["Kirjoita yhteenveto"]}
        state="stale"
        clearAvailability={{
          state: "disabled",
          reason: "Tuoreen jonon revisionumero puuttuu.",
        }}
        onClearAll={noop}
      />
      <SupportedQuestion
        requestId="q-1"
        kind="select"
        prompt="Valitse turvallinen etenemistapa"
        choices={["Jatka", "Keskeytä"]}
        value="Jatka"
        state="pending"
        cancelAvailability={{
          state: "unsupported",
          reason: "Natiivia peruutusmappausta ei ole todennettu.",
        }}
        onChange={noop}
        onRespond={noop}
        onCancel={noop}
      />
      <OperationProgress
        operationId="op_01PARTIAL"
        kindLabel="Workspacen poisto"
        state="partial"
        observationAge="12 sekuntia sitten"
        stages={[
          { id: "preflight", label: "Ennakkotarkistus", state: "succeeded" },
          {
            id: "worktree",
            label: "Worktreen purku",
            state: "failed",
            detail: "Manuaalinen worktree jäi jäljelle.",
          },
          { id: "source", label: "Lähteen uusi havainto", state: "unknown" },
        ]}
        effects={[
          {
            kindLabel: "Hakemisto",
            stateLabel: "Säilyi",
            description: "Sisältöä ei poistettu.",
          },
          {
            kindLabel: "Annotaatio",
            stateLabel: "Poistettu",
            description: "Näyttönimi poistui.",
          },
        ]}
        retryAvailability={{
          state: "disabled",
          reason: "Tarvitaan tuore havainto.",
        }}
        onRetryFromFreshObservation={noop}
        onClose={noop}
      />
      <ToastRegion message="Teksti kopioitu" />
    </main>
  ),
};
