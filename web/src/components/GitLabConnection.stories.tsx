import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useEffect } from "react";
import type { GitLabConnection } from "../app/gitlab";
import type { IntegrationList, Provider } from "../app/integrations";
import {
  GitLabDialog,
  GitLabDisconnectDialog,
  type GitLabStage,
  type GitLabTokenView,
} from "./GitLabConnection";
import { IntegrationsOverview } from "./Integrations";

// Synthetic states of the production GitLab components as the
// proto-gitlab-connect round specifies them: glab's connections in
// Asetukset › Koodipalvelut with what GitLab says about each token (push,
// expiry), and the connect form starting from gitlab.com. No daemon, glab or
// GitLab is involved, and no token is ever typed.

const intent = () => {};
const now = Date.parse("2026-10-27T10:00:00Z");
const gitlab: Provider = {
  id: "gitlab",
  available: true,
  login: "personal_token",
  services: ["git"],
};
const com: GitLabConnection = {
  id: "gitlab_0123456789abcdef01234567",
  base_url: "https://gitlab.com",
  user: "aino.virtanen",
  kind: "pat",
  ambiguous: false,
  git: "registered",
};
const own: GitLabConnection = {
  ...com,
  id: "gitlab_1123456789abcdef01234567",
  base_url: "https://gitlab.yritys.fi",
  user: "aino",
};
const keyring: GitLabConnection = {
  ...com,
  id: "gitlab_2123456789abcdef01234567",
  base_url: "https://gitlab.asiakas.fi",
  kind: "keyring",
};
const ok = (token: GitLabTokenView & { state: "ok" }) => token;
const tokens: Record<string, GitLabTokenView> = {
  [com.id]: ok({
    state: "ok",
    token: {
      push: "yes",
      scopes: ["read_api", "write_repository"],
      expires_at: "2027-10-27",
      fine: false,
    },
  }),
  [own.id]: ok({
    state: "ok",
    token: {
      push: "unknown",
      scopes: [],
      expires_at: "2026-11-05",
      fine: true,
    },
  }),
};
const list = (c: GitLabConnection[]): IntegrationList => ({
  schema_version: 1,
  providers: [gitlab],
  skill: "current",
  accounts: [],
  gitlab: { state: "ok", connections: c },
});

/** Types made-up text into the form's fields and opens the token help. */
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
    type("gitlab-address", address);
    type("gitlab-token-input", token);
    if (help)
      document
        .querySelector<HTMLButtonElement>('[data-testid="gitlab-token-help"]')
        ?.click();
  }, [address, token, help]);
  return children;
}

const dialog =
  (
    stage: GitLabStage,
    typed: { address?: string; token?: string; help?: boolean } = {},
    replace?: GitLabConnection,
  ) =>
  () => (
    <Typed {...typed}>
      <GitLabDialog
        stage={stage}
        replace={replace}
        taken={[com]}
        onSubmit={intent}
        onRepair={intent}
        onNewWorkspace={intent}
        onClose={intent}
      />
    </Typed>
  );

const meta = {
  title: "Production/GitLab",
  component: IntegrationsOverview,
  parameters: {
    docs: {
      description: {
        component:
          "GitLab Koodipalveluissa synteettisillä tiloilla: glab-kirjautumiset kortteina, joissa näkyy GitLabin kertoma pushin tila ja tunnuksen voimassaolo, ja yhdistämislomake gitlab.comista alkaen. Ei daemonia, glabia eikä GitLabia; kentissä on vain keksittyä tekstiä.",
      },
    },
  },
  args: {
    list: list([com, own, keyring]),
    checking: new Set<string>(),
    onCheck: intent,
    onConnect: intent,
    onSignInAgain: intent,
    onRemove: intent,
    onGitLab: intent,
    gitlabTokens: tokens,
    gitlabChecks: { [com.id]: "ok" as const },
    now,
  },
} satisfies Meta<typeof IntegrationsOverview>;
export default meta;
type Story = StoryObj<typeof meta>;

/** gitlab.com with push, a self-hosted GitLab whose fine-grained token
 * expires in nine days, and a keyring login shown but not used. */
export const Connections: Story = {};
export const ReadOnly: Story = {
  args: {
    list: list([com]),
    gitlabTokens: {
      [com.id]: {
        state: "ok",
        token: {
          push: "no",
          scopes: ["read_api"],
          expires_at: "2027-10-27",
          fine: false,
        },
      },
    },
  },
};
export const ApiScope: Story = {
  args: {
    list: list([com]),
    gitlabTokens: {
      [com.id]: {
        state: "ok",
        token: { push: "yes", scopes: ["api"], expires_at: null, fine: false },
      },
    },
  },
};
export const Expired: Story = {
  args: {
    list: list([com]),
    gitlabTokens: { [com.id]: { state: "failed", api: "token_expired" } },
    gitlabChecks: { [com.id]: "token_expired" as const },
  },
};
export const NotConnected: Story = { args: { list: list([]) } };
export const GlabFileUnreadable: Story = {
  args: {
    list: { ...list([]), gitlab: { state: "unavailable", connections: [] } },
  },
};

export const DialogEmpty: Story = { render: dialog({ stage: "form" }) };
export const DialogHelpOpen: Story = {
  render: dialog({ stage: "form" }, { help: true }),
};
export const DialogTLS: Story = {
  render: dialog(
    {
      stage: "form",
      error: {
        field: "server",
        text: "Palvelimen varmennetta ei voitu tarkistaa, eikä Habitat ohita tarkistusta. Jos GitLab käyttää yrityksen omaa varmentajaa, tämän palvelimen ylläpitäjä voi lisätä sen luotettaviin.",
      },
    },
    { address: "https://gitlab.yritys.fi", token: "esimerkkiteksti" },
  ),
};
export const DialogTLSPhone: Story = {
  ...DialogTLS,
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
export const DialogNoReadApi: Story = {
  render: dialog(
    {
      stage: "form",
      error: {
        field: "token",
        text: "Tunnukselta puuttuu read_api-oikeus, joten Habitat ei näe projektejasi. Luo tunnus oikeuksilla read_api ja write_repository.",
      },
    },
    { token: "esimerkkiteksti" },
  ),
};
export const DialogChecking: Story = {
  render: dialog({ stage: "form", busy: true }, { token: "esimerkkiteksti" }),
};
export const DialogConnected: Story = {
  render: dialog({
    stage: "done",
    connection: com,
    token: {
      push: "yes",
      scopes: ["read_api", "write_repository"],
      expires_at: "2027-10-27",
      fine: false,
    },
  }),
};
export const DialogConnectedReadOnly: Story = {
  render: dialog({
    stage: "done",
    connection: com,
    token: {
      push: "no",
      scopes: ["read_api"],
      expires_at: "2027-10-27",
      fine: false,
    },
  }),
};
export const DialogUncertain: Story = {
  render: dialog({ stage: "uncertain" }),
};
export const DialogReplace: Story = {
  render: dialog({ stage: "form" }, {}, own),
};
export const Disconnect: Story = {
  render: () => (
    <GitLabDisconnectDialog
      connection={com}
      onConfirm={intent}
      onClose={intent}
    />
  ),
};
