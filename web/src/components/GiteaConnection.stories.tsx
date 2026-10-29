import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useEffect } from "react";
import type { GiteaConnection } from "../app/gitea";
import type { IntegrationList, Provider } from "../app/integrations";
import {
  GiteaDialog,
  GiteaDisconnectDialog,
  type GiteaStage,
} from "./GiteaConnection";
import { IntegrationsOverview } from "./Integrations";

// Synthetic states of the production Gitea components (ADR 0031): the
// approved "Lomake" connect form with its error at the top (connect-riff
// round 2) and tea's connections in Asetukset › Koodipalvelut. No daemon, tea
// or Gitea is involved, and no token is ever typed: the fields hold made-up
// placeholders only.

const intent = () => {};
const gitea: Provider = {
  id: "gitea",
  available: true,
  login: "personal_token",
  services: ["git"],
};
const ready: GiteaConnection = {
  id: "gitea_0123456789abcdef01234567",
  base_url: "https://git.example.test",
  user: "esimerkki",
  kind: "pat",
  owned: true,
  ambiguous: false,
  git: "registered",
};
const connections: GiteaConnection[] = [
  ready,
  {
    ...ready,
    id: "gitea_1123456789abcdef01234567",
    base_url: "https://code.example.test:3000/gitea",
    git: "absent",
  },
  {
    ...ready,
    id: "gitea_2123456789abcdef01234567",
    base_url: "https://other.example.test",
    git: "foreign",
  },
  {
    ...ready,
    id: "gitea_3123456789abcdef01234567",
    base_url: "https://git.example.test",
    user: "toinen",
    kind: "oauth",
    owned: false,
  },
  {
    ...ready,
    id: "gitea_4123456789abcdef01234567",
    base_url: "https://dup.example.test",
    ambiguous: true,
  },
];
const list = (c: GiteaConnection[]): IntegrationList => ({
  schema_version: 1,
  providers: [gitea],
  skill: "current",
  accounts: [],
  gitea: { state: "ok", connections: c },
});

/** Types made-up text into the form's fields and opens the token help, as a
 * person would before the stage under review, without a story-only prop on
 * the production component. */
function Typed({
  address,
  token,
  help,
  children,
}: {
  address?: string;
  token?: string;
  help?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    const type = (id: string, value?: string) => {
      const input = document.querySelector<HTMLInputElement>(
        `[data-testid="${id}"]`,
      );
      if (!input || value === undefined) return;
      const set = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    type("gitea-address", address);
    type("gitea-token", token);
    if (help)
      document
        .querySelector<HTMLButtonElement>('[data-testid="gitea-token-help"]')
        ?.click();
  }, [address, token, help]);
  return children;
}

const dialog =
  (
    stage: GiteaStage,
    typed: { address?: string; token?: string; help?: boolean } = {},
    replace?: GiteaConnection,
  ) =>
  () => (
    <Typed {...typed}>
      <GiteaDialog
        stage={stage}
        replace={replace}
        onSubmit={intent}
        onRepair={intent}
        onClose={intent}
      />
    </Typed>
  );

const meta = {
  title: "Production/Gitea",
  component: IntegrationsOverview,
  parameters: {
    docs: {
      description: {
        component:
          "Gitea Integraatioissa synteettisillä tiloilla: tea-kirjautumiset kortteina ja hyväksytty yhdistämislomake, jonka virhe on otsikon alla vierivän alueen ulkopuolella. Ei daemonia, teaa eikä Giteaa; kentissä on vain keksittyä tekstiä.",
      },
    },
  },
  args: {
    list: list(connections),
    checking: new Set<string>(),
    onCheck: intent,
    onConnect: intent,
    onSignInAgain: intent,
    onRemove: intent,
    onGitea: intent,
    giteaChecks: { [ready.id]: { api: "ok", push: "allowed" } },
  },
} satisfies Meta<typeof IntegrationsOverview>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Usable, Git not yet set up, another helper for the server, an OAuth
 * login and a duplicated one: only the first three can be used. */
export const Connections: Story = {};
export const CheckRejected: Story = {
  args: {
    list: list([ready]),
    giteaChecks: { [ready.id]: { api: "token_rejected" } },
  },
};
/** A token without write:repository: fetch works, push would meet 403. */
export const CheckReadOnly: Story = {
  args: {
    list: list([ready]),
    giteaChecks: { [ready.id]: { api: "ok", push: "read_only" } },
  },
};
export const CheckPushUnknown: Story = {
  args: {
    list: list([ready]),
    giteaChecks: { [ready.id]: { api: "ok", push: "unknown" } },
  },
};
export const NotOffered: Story = {
  args: { list: { ...list([]), providers: [{ ...gitea, available: false }] } },
};
export const TeaFileUnreadable: Story = {
  args: {
    list: { ...list([]), gitea: { state: "unavailable", connections: [] } },
  },
};

export const DialogEmpty: Story = { render: dialog({ stage: "form" }) };
export const DialogHelpOpen: Story = {
  render: dialog({ stage: "form" }, { help: true }),
};
export const DialogAddressMissing: Story = {
  render: dialog(
    {
      stage: "form",
      error: {
        field: "server",
        text: "Anna palvelimen HTTPS-osoite, esimerkiksi https://git.example.org.",
      },
    },
    { address: "", token: "esimerkkiteksti" },
  ),
};
export const DialogServerUnreachable: Story = {
  render: dialog(
    {
      stage: "form",
      error: {
        field: "server",
        text: "Palvelin ei vastaa. Tarkista osoite ja Habitatin verkkoyhteys palvelimeen.",
      },
    },
    { address: "https://git.exxample.org", token: "esimerkkiteksti" },
  ),
};
export const DialogTokenRejected: Story = {
  render: dialog(
    {
      stage: "form",
      error: {
        field: "token",
        text: "Tunnus hylättiin. Tarkista tunnus ja sen lukuoikeudet Giteassa.",
      },
    },
    { address: "https://git.example.test", token: "esimerkkiteksti" },
  ),
};
/** The approved geometry: on a short phone with the help open, the error
 * is whole at the top while the body below it scrolls. */
export const DialogTokenRejectedPhone: Story = {
  render: dialog(
    {
      stage: "form",
      error: {
        field: "token",
        text: "Tunnus hylättiin. Tarkista tunnus ja sen lukuoikeudet Giteassa.",
      },
    },
    {
      address: "https://git.example.test",
      token: "esimerkkiteksti",
      help: true,
    },
  ),
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
export const DialogChecking: Story = {
  render: dialog(
    { stage: "form", busy: true },
    { address: "https://git.example.test", token: "esimerkkiteksti" },
  ),
};
export const DialogConnected: Story = {
  render: dialog({ stage: "done", connection: ready, push: "allowed" }),
};
export const DialogConnectedReadOnly: Story = {
  render: dialog({ stage: "done", connection: ready, push: "read_only" }),
};
export const DialogConnectedGitAbsent: Story = {
  render: dialog({ stage: "done", connection: { ...ready, git: "absent" } }),
};
export const DialogUncertain: Story = {
  render: dialog({ stage: "uncertain" }),
};
export const DialogReplace: Story = {
  render: dialog({ stage: "form" }, {}, ready),
};
export const Disconnect: Story = {
  render: () => (
    <GiteaDisconnectDialog
      connection={ready}
      onConfirm={intent}
      onClose={intent}
    />
  ),
};
export const DisconnectDuringClone: Story = {
  render: () => (
    <GiteaDisconnectDialog
      connection={ready}
      error="Tämän yhteyden kloonaus on käynnissä. Keskeytä se tai odota sen valmistumista ja yritä sitten uudelleen."
      onConfirm={intent}
      onClose={intent}
    />
  ),
};
