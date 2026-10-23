# Planning result

[plan.md](plan.md) is the proposal for Jari: Finnish summary and decision question first, three alternatives, one recommendation, code-grounded authority analysis and a proposed host/admin split. Both sibling briefs were read; their visual choices remain theirs. No production code, schema, deployment or provider settings changed. The issue remains in-progress with preparation pending, awaiting Jari.

## Decisions for later review

These are proposal assumptions, not accepted architecture:

- Recommend split ownership rather than all-site or all-runtime: host owns security/delegation; gateway owns onboarding; broker owns invitations. Avoid competing browser overrides and declarative values.
- Browser invitations require explicit root-enabled delegation and trust in the gateway's administrator check. A compromised gateway gains admission power within that delegation; broker ownership of files alone does not remove that risk. Alternative: root approves every admission.
- Recommend broker-distinguished operator admission and delegated invitations. Host omission does not silently delete runtime invitations; disabling delegation revokes invitation-derived access without deleting accounts. Alternative: make the operator's admission list exhaustive, which prevents independent runtime invitations.
- Pending/accepted means invited/broker-bound, not email delivery or completed onboarding. Revoke means withdrawing that source of web admission, not deleting homes or terminating native work.
- Onboarding lives in runtime administration only; install automation sets it through admin after apply. Required integrations are deferrable onboarding tasks, not ongoing access gates, to preserve the sibling brief's way to continue. If required means blocking access, Jari must choose that separately.

## Validation and limits

- `python3 scripts/validate-project-view.py`: passed (10 pages, 10 navigation entries).
- `git diff --check`: passed.
- Source inspection: gateway administration/login/revocation, broker protocol/peer validation/admission writer/startup, host site parsing and convergence, operator guide, internal authority instructions, both sibling briefs.
- `issuectl doctor --json`: no schema violations or parse errors; existing attachment advisories are unrelated. No repairs applied.
- No Go/browser/VM/provider tests run: documentation-only proposal, no behavior changed. Its future validation requirements are listed in the plan; none is claimed proven by this work.
