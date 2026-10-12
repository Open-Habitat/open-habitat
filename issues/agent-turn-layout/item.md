---
created: 2026-10-12
updated: 2026-10-12
type: improvement
status: open
priority: normal
lane: signin-fix
lane_seq: 11
collision: [web/]
---

# Agent turn repeats its author and hides short thinking

_Source: chat_

Jari, 2026-10-12, pilot.22, a Pi conversation with GPT-5.5 (OpenAI via Pi).

1. **Thinking blocks are one-line summaries.** Verified in the native session: every thinking block in the conversation is a single line of 31–51 characters such as `**Planning status table parsing with Python**`; the actual reasoning is only in the encrypted signature. Expanding "Ajattelu" therefore shows one bold-marked line in a code-styled box, with the Markdown asterisks visible. When a thinking block is a short single-line summary, show it directly on the "Ajattelu" row in the agent's work (Markdown rendered, no expansion). Keep the expandable form only for multi-line thinking from providers that send it.
2. **"PI · GPT-5.5" is repeated above every block** (thinking, tool calls, messages). Everything in the agent's work comes from the agent, so the author/model label is noise there. The "Sinä" messages keep their author treatment.
3. **The agent's actual reply gets a bubble** like the "Sinä" message, so it has a natural place for the copy button, and the author/model label appears at most once per reply, not on every block of the turn.

Check the design drafts (`design-system/drafts/Pi-keskustelun lohkot.dc.html`) and the design rule for icons (design.md), and verify in the lab on desktop and phone, including a turn with many tool calls.
