---
created: 2026-11-21
updated: 2026-11-21
type: bug
reporter: jari
status: open
priority: normal
lane: workspace-icons
lane_seq: 1
preparation: ready
---

# Icon suggestions refuse another workspace's logo

## Observed

Jari 21.11.2026 on the test installation: in the workspace icon editor's "Ehdotuksia mallilta", asking for the logo of another of his workspaces (the product repository's logo, for a sibling development workspace) gets a refusal: "Voin ehdottaa vain emojia, kirjaimia tai repositorion omaa logoa; logopolku ei ole tiedoissa, joten tässä lähimmät vaihtoehdot." It then offers emojis and letters. The person had to argue with it and still could not get the logo.

## Expected

When the person asks for a logo or image that exists in their own workspaces (another repository under their workspaces, a file they name, or an image they attach with Liitä), the suggestions include it as an icon candidate, within the same safety rules as the workspace's own logo (the person's own files only, image types and size limits as today).
