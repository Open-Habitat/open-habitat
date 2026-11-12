# Result

Microsoft accounts' Pi MCP servers are now `habitat-microsoft-<slug>`
(`aino.virtanen@contoso.test` → `habitat-microsoft-aino-virtanen-contoso-test`).
Code: `internal/daemon/integrations/microsoft_server_linux.go`; registrations
under the hex name move at the next daemon start or account check (Align),
which then rewrites the personal-data skill. The skill render in
`issues/m365-agent-file-search/personal-data-after.md` shows the new name.

Verified: focused Go tests for the integrations package (names: plain,
collision, non-ASCII, long; migration with Pi's OAuth file and the token
cache byte for byte unchanged, cancelled and half-done migration, register
and Remove with legacy entries; the full personal-data text), a `-race` run
of the Microsoft/Atlassian/Trello/catalog tests, and a test against the
pinned Pi 1.5.2 CLI that registers two colliding accounts, renames a legacy
entry and has Pi remove it under the new name. Not yet seen on the test
server (KOKEILTAVAA line).

Review: `/llm-review` (finder GPT-6 Astra, verifier Claude Fable 5.2) and
`/assess-findings`. Four confirmed findings, all fixed: an entry under the
readable name without the account's token cache was adopted (now never);
a rename followed by a failed tenant alignment left the skill naming the
removed server (the rename is now an Align step of its own and the catalog
rewrites the skill after every successful Align); Microsoft's `pi mcp`
changes did not share the lock with Atlassian/Trello's whole-file rewrites
(an existing race that could drop a new registration; now shared); Remove
failed when both readable names were held by others.

## Decisions for later review

- **Only Microsoft changes.** Atlassian (`open_habitat_atlassian`) and Trello
  (`open_habitat_trello`, `_2` …) names are already readable and are not
  derived from an address: Habitat learns no address for them, by design.
  Renaming them would mean moving Pi's OAuth state, which Pi keys by
  `mcp__<name>|<url>` in `mcp-auth.json`, i.e. Habitat copying tokens, which
  the architecture forbids. Google, Dropbox and Apple use no Pi MCP server.
  Alternative: give them `habitat-atlassian` etc. through a fresh sign-in.
- **Collision rule: first registered keeps the plain name.** Two of the
  person's accounts collide only when their addresses differ in punctuation
  (`a.b@x` vs `a-b@x`, or where `@` sits). The account that registers when
  the plain name is free gets it; one that finds the plain name held by an
  entry that is not its own gets `<plain>-<first 6 hex of SHA-256 of the
  address>`. An account keeps the name its entry has, so adding or removing
  another account never renames it. "Its own" means the entry's
  `MS365_MCP_TOKEN_CACHE_PATH` is the account's cache path; nothing decodes
  the name. A name Pi folds onto ours (`-` vs `_`) also holds it. No
  order-independent rule exists with the prescribed slug, because the `@`
  position is lost.
- **No trimming.** Pi 1.5.2 has no server-name length limit (only
  `^[A-Za-z0-9_-]+$`); a long name only makes Pi hash tool names, which the
  hex names already caused.
- **Rename writes mcp.json directly, not `pi mcp add` + `remove`.** One
  atomic rewrite keeps the entry byte for byte (including `toolExposure` or
  `enabled` the person set) and has no half-done state. The Microsoft
  server's sign-in is its token cache under the account directory; Pi keeps
  no OAuth state for a stdio server, so nothing keyed by the old name is
  left. A person's project-level `.pi/mcp.json` override under the old name
  would no longer apply; running Pi sessions keep the old server until they
  restart.
- **Uppercase and non-ASCII** become lowercase / `-` (addresses are already
  lowercase ASCII by `ValidAddress`).
