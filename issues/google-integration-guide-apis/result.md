# Result

- The administrator guide's first Google step (Palvelinintegraatiot) lists
  Sheets, Docs and Slides beside Gmail, Calendar, Drive and People, and its
  one enable link turns on all seven in the project last selected.
- A configured Google app's *Tunnukset* menu has *Ota API:t käyttöön Google
  Cloudissa*, which opens the same enable flow with `&project=<number>` taken
  from the client id.
- `docs/operations.md` lists every API with a library link, the combined
  enable link, and what the "not enabled" error means.
- The generated personal-data skill names `gog sheets|docs|slides` and tells
  agents that an API "has not been used in project / is disabled / is not
  enabled for this OAuth project" error is an administrator action, with the
  project's enable link; not missing permission.

## Decisions for later review

- **Project from the client id.** The UI and daemon know only the client id,
  whose leading digits are the project number. Google's own "not enabled"
  errors link `?project=<number>`, so the links use that. Alternative: ask the
  administrator for the project id (another field to maintain). Before the
  client exists (the setup guide's first step) the link has no project and
  opens the last selected one, as before.
- **A menu item rather than a status check.** The host does not probe which
  APIs are enabled; a probe would need a person's token and a network call per
  API. The menu link and the agent's error explanation cover the pilot's case.
- **No error-code mapping.** The error surfaces through gog to the agent, not
  through the daemon's catalog, so only the skill text changed.
