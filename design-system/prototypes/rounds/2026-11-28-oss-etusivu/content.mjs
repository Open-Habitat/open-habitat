// The page's words. Every claim rests on the product repository (README.md,
// docs/product.md, docs/operations.md, web/src/text/integrations.tsx,
// internal/experimental/catalog.json); a change there that a sentence here
// repeats changes the sentence. Written as plain sentences a person would say
// to a colleague, with features under their technical names.

export const REPO = 'https://github.com/Open-Habitat/open-habitat';
export const DOCS = '/docs/';
export const GUIDE = 'https://raw.githubusercontent.com/Open-Habitat/open-habitat/main/docs/operations.md';
export const RELEASES = `${REPO}/releases`;

export const eyebrow = 'Open source (MIT) · self-hosted on Ubuntu 24.04 · pre-release 0.1';
// The release line's caveat, said beside the line it qualifies.
export const releaseNote = ['0.1 is a pre-release line, published as v0.1.N on', 'GitHub Releases', '. Formats and interfaces still change.'];
export const hero = {
  h1: 'Coding-grade agents on a server for you and your team',
  lede: 'Open Habitat runs on a Linux server you control. Every person on the team is a Linux user there, and their agents run as that user with a shell, files, Git and the programs installed on the server. People work with their agents in a browser tab, so nobody needs a terminal.',
};

// Each box says only what README.md says.
export const core = [
  ['Parallel agents in Git worktrees', 'The agent splits a big job between workers, each in its own Git worktree, and brings their results back.'],
  ['One Linux user per person', 'Each person has their own files, credentials and agents on the server.'],
  ['Self-hosted, MIT licence', 'Everything runs on your own Ubuntu 24.04 server. There is no Open Habitat account or cloud service.'],
  ['Bring your own model', 'Each person connects a ChatGPT or Claude subscription or an API key, or the server provides one key for everyone.'],
  ['Browser and phone UI', 'It works the same on a laptop and on a phone, with nothing to install and no terminal.'],
  ['Sessions run on the server', 'An agent keeps working after you close the tab.'],
  ['Steer it while it works', 'You can add an instruction, queue the next message or stop the agent while it works.'],
  ['Plain files and Git', 'A conversation is Pi’s own session file in your home directory, so a terminal over SSH shows the same work.'],
];


// [anchor, heading, body, screen] — screen is a v1 block id, or a screen of our own (screens.mjs).
export const features = [
  ['linux', 'Agents run as your Linux user, with a real shell and tools', 'Every person has an account on the server, and their agents run under it with the shell, the person’s files, Git and the installed programs. If a job needs a program that is not there yet, the agent can install it into its own account.', 'alice-04-market-video'],
  ['workers', 'Parallel agents in Git worktrees', 'The agent can split a job between workers, each in its own Git worktree and branch, and bring their results back into the conversation. A conversation can also have helpers. A helper is a named agent that works in rounds in its own worktree, reports after each round and then waits for the next message. Messages to a helper and landing its rounds go through the main agent.', 'alice-08-returns-workers'],
  ['browser', 'Computer use in a real Chrome on the server', 'The agent runs a real Google Chrome on the server and uses it the way a person would: it opens pages, reads them, clicks, types, takes screenshots and downloads files. You can watch the same browser in Habitat’s Browser panel and take the controls at any time, and you enter passwords and MFA codes there yourself. That way the agent can work with services that have no API and no connector.', 'browser-demo'],
  ['server', 'Agents keep running on the server', 'The agent process runs on the server, and a conversation is Pi’s own session file in your home directory. You can close the tab or continue on your phone, and the sidebar shows which conversations are running and which are waiting for you.', 'alice-07-lunch-phone'],
  ['connect', 'Connectors for mail, calendars, files and work tools', 'Each person connects their own accounts in Settings, and their agent then works with those services as that person. The administrator registers the Google, Microsoft 365 and Dropbox apps once for the whole server. Jira, Confluence and Trello connect through Atlassian’s MCP server, and any other service that has an MCP server can be added the same way.', 'connectors'],
  ['history', 'Git history for every change, and undo for a single change', 'When the work lives in a repository, each change has an author, a time and a message that says why it was made. You can undo one change without touching the others, and the undo is recorded in the history too.', 'alice-10-undo-one-page'],
  ['services', 'Your own services on the server', 'Agents can write and run code, so a small internal tool or web page can run as a service in your account and keep running after the conversation has ended.', 'alice-11-wholesale-order-page'],
];
// Said under the browser feature: what it is today and what it cannot promise.
export const browserNotes = [
  ['Reading public pages', 'Every agent also has a headless Chromium that renders a page before reading it, so pages built with JavaScript can be read too. These reads start signed out and keep nothing.'],
  ['What it cannot promise', 'Captchas are yours to solve, like passwords. A site that blocks automated use can still stop the agent.'],
];

export const library = {
  h2: 'On a Linux server, thousands of open-source programs become skills for your agent and for your users’ agents',
  p: 'Ubuntu’s archive holds tens of thousands of open-source packages. Once a program is installed on the server, every person’s agent can run it the way someone at a terminal would. The administrator installs programs for everyone, and an agent can install one into its own account when a job needs it.',
};

export const installHead = 'Let your agent install it';
// The prompt for the operator's own coding agent; the guide is written for that agent (docs/operations.md opens by naming this URL).
export const installPrompt = `Please install Open Habitat for me on my server. Follow this guide: ${GUIDE}`;

export const footer = [['GitHub', REPO], ['Releases', RELEASES], ['Docs', DOCS], ['Security model', '/docs/security/'], ['Discussions', `${REPO}/discussions`]];
export const logoCredit = ['The logos come from Simple Icons (CC0) and are trademarks of their owners. Six of them use their projects’ own licences:', [['GIMP', 'CC BY-SA 4.0', 'https://gitlab.gnome.org/GNOME/gimp-data/-/blob/e62f1905dcef7ec831ea6c052bb035eb37eaa69e/images/logo/gimp-logo-unicolor.svg'], ['Inkscape', 'CC BY-SA 3.0', 'https://inkscape.org/gallery/=inkscape-branding/inkscape-brand-assets/'], ['Pandoc', 'CC BY-SA 4.0', 'https://github.com/tarleb/pandoc-logo'], ['R', 'CC BY-SA 4.0', 'https://www.r-project.org/logo/'], ['Rust', 'CC BY-SA 4.0', 'https://www.rust-lang.org'], ['Git', 'CC BY 3.0, Jason Long', 'https://git-scm.com/community/logos']]];
export const fontCredit = ['Fonts: Instrument Sans and JetBrains Mono,', 'SIL Open Font License', `${REPO}/tree/main/design-system/fonts`];
export const footNote = 'This page sets no cookies and loads nothing from other sites. Example Studio and the people in the screens are made up.';
