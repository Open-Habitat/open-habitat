import type { SettingsSection } from "../app/settingsIndex";

type Rows<S extends SettingsSection> = {
  [R in S["rows"][number] as R["id"]]: R extends { group: string }
    ? { label: string; desc: string; group: string }
    : { label: string; desc: string };
};

/** English names of every settings section and row. The Finnish ones are in
 * app/settingsIndex.ts, which also owns the ids and search synonyms; a
 * section or row added there is a compile error here until it is named. */
export type SettingsIndexEnglish = {
  [S in SettingsSection as S["id"]]: (S extends { intro: string }
    ? { label: string; intro: string }
    : { label: string }) & { rows: Rows<S> };
};

export const settingsIndexEnglish: SettingsIndexEnglish = {
  tili: {
    label: "Account",
    rows: {
      account: {
        label: "Profile and signing out",
        desc: "Your name and picture from GitHub. Sign out of this browser.",
      },
      "git-identity": {
        label: "Git identity",
        desc: "The author of commits. Saved in the global ~/.gitconfig file.",
      },
      "view-links": {
        label: "View and file addresses",
        desc: "Your views' and files' addresses: open, copy, make private or remove them for good.",
      },
    },
  },
  laitteet: {
    label: "Devices",
    rows: {
      "device-link": {
        label: "Sign in on a phone",
        desc: "Show a code and open Habitat on another device without signing in to GitHub again.",
      },
      sessions: {
        label: "Signed-in devices",
        desc: "Browsers and phones where you are signed in. A device can be signed out.",
      },
    },
  },
  avaimet: {
    label: "Keys",
    intro:
      "The account's public SSH and age keys, which an administrator needs for access or secrets.",
    rows: {
      "account-keys": {
        label: "Account public keys",
        desc: "The public parts and fingerprints of the SSH and age keys. A missing key can be created for the account.",
      },
    },
  },
  tekoaly: {
    label: "AI",
    intro:
      "The models your agents use, and the subscriptions or keys that provide them.",
    rows: {
      "default-model": {
        label: "Default model",
        desc: "The model and thinking level of new conversations.",
      },
      "agent-work": {
        label: "Agent's work",
        desc: "Thinking and tools in the conversation by default.",
      },
      chatgpt: {
        label: "ChatGPT subscription",
        group: "Subscriptions",
        desc: "Sign in with a ChatGPT subscription (Codex) to bring its models into the model picker.",
      },
      claude: {
        label: "Claude subscription",
        group: "Subscriptions",
        desc: "Sign in with a Claude subscription to bring its models into the model picker.",
      },
      "api-keys": {
        label: "API keys",
        group: "API keys",
        desc: "Your own key for a provider. Use is billed to the key's owner.",
      },
    },
  },
  tilannekatsaus: {
    label: "Recap",
    intro:
      "A short recap of where a conversation stands when you come back to it. It is saved in the conversation's history but does not enter the agent's memory.",
    rows: {
      "recap-automatic": {
        label: "Automatic recap",
        desc: "Make recaps automatically or turn automatic recaps off.",
      },
      "recap-delay": {
        label: "Quiet time before a recap",
        desc: "The card appears above the conversation by itself once the conversation has been quiet this long.",
      },
      "recap-model": {
        label: "Model",
        desc: "The model that makes the recap. Never a Fable or Opus model.",
      },
      "recap-level": {
        label: "Recap scope",
        group: "Scope",
        desc: "How much the recap reads and writes.",
      },
      "recap-messages": {
        label: "Messages read",
        group: "Scope",
        desc: "Your latest messages and the agent's replies.",
      },
      "recap-history": {
        label: "History read at most",
        group: "Scope",
        desc: "The oldest messages are left out when the limit is reached.",
      },
      "recap-message": {
        label: "At most from one message",
        group: "Scope",
        desc: "The beginning of a long message is read.",
      },
      "recap-turns": {
        label: "First recap at the earliest",
        group: "Scope",
        desc: "When the conversation has this many questions and answers.",
      },
      "recap-words": {
        label: "Recap length",
        group: "Scope",
        desc: "One or a few sentences about what was done.",
      },
      "recap-next": {
        label: "Next line",
        group: "Scope",
        desc: "One next step or obstacle.",
      },
      "recap-response": {
        label: "Response limit",
        group: "Scope",
        desc: "The model's response is cut here.",
      },
    },
  },
  sanelu: {
    label: "Dictation",
    rows: {
      "speech-key": {
        label: "Soniox key",
        desc: "Your own or the administrator's key, with which dictation writes your speech into the message field.",
      },
    },
  },
  koodipalvelut: {
    label: "Code hosts",
    intro: "The services workspaces are cloned from and that agents push to.",
    rows: {
      github: {
        label: "GitHub",
        desc: "The sign-in with which workspaces are cloned and agents push.",
      },
      gitea: { label: "Gitea", desc: "An access token for your Gitea server." },
      gitlab: { label: "GitLab", desc: "An access token for a GitLab server." },
      workspaces: {
        label: "Imported workspaces",
        group: "Imported workspaces",
        desc: "Which service's credentials each workspace synchronizes with.",
      },
    },
  },
  tiedot: {
    label: "Data for agents",
    intro: "Email, calendars, contacts and files your agents may use.",
    rows: {
      google: { label: "Google", desc: "Gmail, Calendar, Contacts and Drive." },
      atlassian: {
        label: "Atlassian",
        desc: "Jira and Confluence. Enable the experimental feature first.",
      },
      trello: {
        label: "Trello",
        desc: "Trello boards and cards. Enable the experimental feature first.",
      },
      microsoft: {
        label: "Microsoft 365",
        desc: "Outlook, calendar, contacts, OneDrive and SharePoint.",
      },
      apple: {
        label: "Apple (iCloud)",
        desc: "iCloud Mail, Calendar and Contacts with an app-specific password.",
      },
      dropbox: {
        label: "Dropbox",
        desc: "Files are synchronized into your home directory.",
      },
      imap: {
        label: "Email (IMAP)",
        desc: "A mail server with a username and password.",
      },
      caldav: {
        label: "Calendar (CalDAV)",
        desc: "A calendar from elsewhere, for example Fastmail or Nextcloud.",
      },
      carddav: {
        label: "Contacts (CardDAV)",
        desc: "Contacts from elsewhere, for example Fastmail or Nextcloud.",
      },
    },
  },
  omatkoneet: {
    label: "Own machines",
    intro:
      "An agent can use your own computer over SSH through your own Tailscale network.",
    rows: {
      "own-machines-tailscale": {
        label: "Tailscale",
        desc: "Habitat's own device in your Tailscale network: connect or disconnect.",
      },
      "own-machines": {
        label: "Machines",
        desc: "The machines an agent can reach: add, renew access or remove.",
      },
    },
  },
  ulkoasu: {
    label: "Appearance",
    rows: {
      theme: {
        label: "Theme",
        desc: "System follows the device's setting. Applies to this browser.",
      },
      language: {
        label: "Language",
        desc: "The interface language. Applies to all your devices.",
      },
    },
  },
  editori: {
    label: "Editor",
    rows: {
      editor: {
        label: "Workspace editor",
        desc: "Always CodeMirror 6 on a phone.",
      },
    },
  },
  tila: {
    label: "Storage",
    rows: {
      usage: {
        label: "Usage",
        desc: "How much your home directory takes and how much space is left.",
      },
      trash: {
        label: "Trash",
        group: "Trash",
        desc: "Deleted workspaces that can be restored.",
      },
    },
  },
  kokeelliset: {
    label: "Experimental features",
    intro:
      "Unfinished features you can already try. The choices apply to all your devices.",
    rows: {
      "explain-mode": {
        label: "Explain mode",
        desc: "Dim the screen and see what any part of it does.",
      },
      "rewind-conversation": {
        label: "Go back here",
        desc: "Go back to an earlier message of yours in the same conversation and, if you want, restore the files the agent changed.",
      },
      "shares-page": {
        label: "Shares",
        desc: "View and file addresses on their own page, grouped by conversation.",
      },
      "agent-resources-view": {
        label: "Agent resources",
        desc: "Browse everything your agents use, by kind: what is included, what is not and what the agent may do.",
      },
      "remote-browser": {
        label: "Your own server browser",
        desc: "Your own browser on the server: sign in to a service, and the agent uses the same browser, which you see live.",
      },
      "conversation-context-view": {
        label: "Context view and compaction",
        desc: "See what fills the conversation's context and compact the conversation with your own instruction.",
      },
      "atlassian-connect": {
        label: "Atlassian connection",
        desc: "Connect Jira and Confluence for your agents to use.",
      },
      "trello-connect": {
        label: "Trello connection",
        desc: "Connect Trello for your agents to use.",
      },
      "named-workers": {
        label: "Helpers",
        desc: "Named workers work in rounds and wait for the main agent's next message.",
      },
      "turn-changes": {
        label: "Turn changes",
        desc: "A line under a finished turn about which files the agent changed.",
      },
      "terminal-copy-on-select": {
        label: "Copy on select in the terminal",
        desc: "Text selected in the terminal goes straight to the clipboard.",
      },
      "terminal-open-urls": {
        label: "Terminal addresses in the browser",
        desc: "An address a program in the terminal opens shows in Habitat and opens in a new tab.",
      },
    },
  },
  palvelin: {
    label: "Server",
    rows: {
      "server-name": {
        label: "Server name",
        desc: "Shown to everyone in the sidebar.",
      },
      "server-language": {
        label: "Default language",
        desc: "The language for people who have not chosen their own.",
      },
      "server-version": {
        label: "Version",
        desc: "The version now running on the server.",
      },
    },
  },
  palvelinintegraatiot: {
    label: "Server integrations",
    rows: {
      "server-google": {
        label: "Google",
        desc: "Whether people can use the service on this server.",
      },
      "server-microsoft": {
        label: "Microsoft 365",
        desc: "Whether people can use the service on this server.",
      },
      "server-apple": {
        label: "Apple (iCloud)",
        desc: "Whether people can use the service on this server.",
      },
      "server-imap": {
        label: "Email (IMAP)",
        desc: "Whether people can use the service on this server.",
      },
      "server-caldav": {
        label: "Calendar (CalDAV)",
        desc: "Whether people can use the service on this server.",
      },
      "server-carddav": {
        label: "Contacts (CardDAV)",
        desc: "Whether people can use the service on this server.",
      },
      "server-dropbox": {
        label: "Dropbox",
        desc: "Whether people can use the service on this server.",
      },
    },
  },
  aiavain: {
    label: "AI key",
    rows: {
      "site-key": {
        label: "Site AI key",
        desc: "A key for people who have no subscription or key of their own.",
      },
      "site-key-copies": {
        label: "Already joined",
        desc: "People who joined before the key or received an earlier key.",
      },
    },
  },
  saneluavain: {
    label: "Dictation key",
    rows: {
      "site-speech-key": {
        label: "Shared Soniox key",
        desc: "Everyone without a key of their own dictates with this.",
      },
    },
  },
  kayttoonotto: {
    label: "Onboarding",
    rows: {
      "onboarding-route": {
        label: "Onboarding steps",
        desc: "What a new person goes through at their first sign-in.",
      },
      "onboarding-preview": {
        label: "The person's view",
        desc: "Onboarding as a new person sees it.",
      },
    },
  },
  kayttajat: {
    label: "Users and access",
    rows: {
      "access-add": {
        label: "Allow a GitHub account",
        desc: "Who may sign in to the server.",
      },
      "access-people": {
        label: "People",
        desc: "Joined, not yet signed in and removed people.",
      },
      "view-links-admin": {
        label: "Shared links",
        desc: "View links people have shared; remove one that is misused.",
      },
    },
  },
  keskustelut: {
    label: "Conversations",
    rows: {
      "live-limit-memory": {
        label: "Memory",
        desc: "The server's memory and how much the limits could use.",
      },
      "live-limit-default": {
        label: "Limit per person",
        desc: "How many conversations one person can have working at once.",
      },
      "live-limit-people": {
        label: "People",
        desc: "A limit of their own for a person.",
      },
    },
  },
  levy: {
    label: "Disk space",
    rows: {
      disk: { label: "Disk", desc: "The disk of the home directories." },
      "default-limit": {
        label: "Default limit",
        desc: "The limit for new users. Does not change existing ones.",
      },
      "user-limits": {
        label: "User limits",
        desc: "Each user's storage and limit.",
      },
    },
  },
};
