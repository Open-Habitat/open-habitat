---
created: 2026-11-24
updated: 2026-11-25
type: improvement
reporter: Jari
status: untriaged
priority: normal
provenance: chat
source_ref: chat:2026-11-24/release-mirror
lane: ai-providers
lane_seq: 2
blocked_by: ['@ai-provider-registry']
---

# Install and upgrade from a release mirror for servers that reach GitHub poorly

## Description

## What Jari asked (24.11.2026)

A mirror or an equivalent, so that Open Habitat can be installed and upgraded
from servers that reach GitHub poorly (mainland China).

## Why

Every release is downloaded from GitHub Releases: for v0.1.7 about 475 MB of
core runtime, 183 MB of integrations and 18 MB of product package per
architecture. From a mainland server such downloads are slow or fail;
`raw.githubusercontent.com`, which the "let your agent do it" install tip
points at, is the host most often reported blocked. Public accelerators
(gh-proxy and similar) come and go and are not something to document.

## What is already true

- The operator guide verifies SHA-256 digests, so a download from any mirror
  is safe as long as the digests come from GitHub (or a signed manifest), not
  from the mirror.
- A server in a Hong Kong or Singapore region of Alibaba Cloud or Tencent
  Cloud needs no ICP filing and reaches GitHub normally. A mainland-region
  server needs an ICP filing first (1-20 working days), because Open Habitat
  needs a DNS name and TLS. The first Chinese installations will most likely
  be in Hong Kong, where no mirror is needed.

## Direction

- The installer and the upgrade path accept a release base URL other than
  GitHub (for example a Gitee release mirror or an object-storage bucket in
  China) while the digests stay anchored to the GitHub release.
- A project-run mirror (Gitee releases or a China-region bucket) published by
  the release pipeline, if a mainland installation actually appears. Until
  then the documented route is the Hong Kong region.
- The agent-readable operator guide gets a copy reachable without
  `raw.githubusercontent.com` (for example on open-habitat.ai, which is served
  from GitHub Pages and shares its reachability, so this too needs a check
  from inside China).
