# Result

The Google guide's OAuth client step (4/5) now shows "Use this client for an
AI-powered agent: valittu" beside Application type and Name, followed by one
sentence: only agents use this client, the choice grants nothing extra, and
some Google MCP services accept only a client marked as an agent.
`docs/operations.md` says the same where it describes creating the Desktop
client. Checked with the focused web area; focused self-review.

## Decisions for later review

- Shown as a `Val` row (console label, value "valittu", no copy button) rather
  than a sentence, so it reads like the other fields to set on the same console
  page. Alternative: a warning-styled paragraph; rejected because nothing goes
  wrong now if it is left unticked.
