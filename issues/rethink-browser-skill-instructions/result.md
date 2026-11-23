# Result

`internal/daemon/browser-skill/SKILL.md` was rewritten with
`/rethink-instructions`; about 9,000 bytes became about 6,800. The
frontmatter is unchanged. Facts were carried over as the original stated
them, not re-verified: fact-checking is a separate pass.

## How the reader meets it

The daemon embeds the file and writes it into the person's Pi skills when the
server browser is offered and the `remote-browser` experiment is on, so Pi
sees the description always and the body when it takes up a browser task.
`open-habitat skill print browser` prints the same text, for a conversation
that began before the skill was installed, and `skill install browser` writes
it for Claude, Pi and Codex. No test or script pins a phrase from the body;
`TestBrowserSkillPrintInstall` only compares the printed and installed copies.

## What the original was trying to do

- Keep the agent from acting in the person's name without their consent, and
  from treating page text as that consent.
- Keep passwords, codes and captchas out of the conversation and out of the
  agent's hands.
- Make the agent use the built-in CLI instead of installing a browser stack.
- Warn about traps the CLI does not reveal: load waits that say nothing about
  application work, uncertain timeouts, verbatim `type` input, downloads that
  return sign-in HTML or a printed viewer, files that stay on the server.
- Describe the handover to the person and what the control errors mean.

## What changed and why

- The consent rule is now a description of what is at stake (the person's
  accounts, their name) with the line between reading and acting, instead of
  a bold "ask first" list. One deliberate change of meaning: the original
  said to ask before any such action; the rewrite says to go ahead when the
  person has asked for that action in the conversation and to ask otherwise.
- The credential rules now carry a reason: the conversation keeps what is
  written in it. That reason is the rewriter's reading; the original gave none.
- "Tell the person rather than installing tools" now says why: the value is
  the signed-in session, which nothing the agent installs would have.
- The example command block, timeout range, text and link bounds, download
  size limit, file mode, profile path and lists of returned fields went;
  `open-habitat agent browser --help` and each command's `--help` carry them,
  and the skill names the commands and points there.
- The separate "Files and site settings" section was folded into the download
  section; the clipboard and password paragraphs into the handover section.

## Where Jari's knowledge is needed

- Whether an explicit request in the conversation ("book this") is consent
  enough for a purchase or message, as the rewrite now says, or whether the
  agent should still confirm at the moment of acting.
- The actual reason passwords must not be asked for in the conversation, if
  it is something other than the history keeping them.
- "Keep the password manager on the person's own device" is kept as a plain
  sentence; its reason (presumably that a manager in the server browser would
  be open to the agent) is not stated in the original and was not invented.
- Dropped without a known purpose: "PDFs normally open in Chrome; save a copy
  when the task needs a file", and "each command disconnects without stopping
  Chrome or closing the person's windows". Both read as reassurance.
