# Navigation and shell visual notes

Synthetic lab (Alice, invented workspaces and histories; not reviewed by Jari). Desktop 1440 × 900 and narrow 390 × 900. These images document the navigation-shell work only; they do not implement or resolve the parent issue's separate agent-status design decision.

| View | Before | After |
| --- | --- | --- |
| Workspace landing, desktop | [before](nav-before.png) | [after](nav-after.png) |
| Workspace landing, narrow | [before](nav-before-narrow.png) | [after](nav-after-narrow.png) |

The landing page now offers direct links to each discovered workspace and conversation instead of an empty instruction; the rail exposes conversations without first expanding every workspace. The host's workspace write state no longer produces a connection warning. Nonfunctional workspace creation is not presented as an action. The account menu's arrow is drawn in CSS so it does not depend on a missing glyph. At narrow widths the navigation starts folded, keeping the content visible, and can be reopened. Conversation titles still read “Uusi keskustelu” in this fixture; title generation belongs to the conversation worker. No recency ordering is claimed because the snapshot has no trustworthy conversation timestamps.

Validation: synthetic host-backed lab, not separate-UID or live-host evidence. Not yet visually reviewed by Jari.
