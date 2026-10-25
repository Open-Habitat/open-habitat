# Result

Host apply now records a site.json administrator without a binding as
pending in the gateway (root control operation `role_declared`), and the
OAuth callback grants exactly that subject after the broker's `authorize`
recheck confirms the binding. The receipt outcome stays
`deferred_until_bound`; `admin settings show` lists
`pending_administrators`. The gateway still never reads site.json, and an
undeclared subject can only become administrator through root's `role`
operation, as before. Apply withdraws an obsolete pending subject with a role
removal, which also removes a grant a concurrent sign-in made from it (found
by the review).

Evidence: `TestDeclaredAdministratorGrantedAtBindingSignIn` (gateway: grant
at the binding sign-in, undeclared subject not granted, persistence,
withdrawal) and `TestApplyDeclaresUnboundAdministratorsForSignIn` (host
convergence calls). Review: critical-rigor `/llm-review`, one must-fix race
confirmed and fixed, verifier found no remaining grant path.

## Decisions for later review

- An installation whose declared administrator was still unbound before this
  release gets the pending entry only from its next apply that converges, not
  from a `no_change` repeat: verification requires every pending entry to be
  declared, but does not require every unbound declaration to be pending,
  so existing installations and upgrade verification are unaffected.
- A failure to persist the grant during sign-in does not refuse the login.
  It is logged as `administrator_grant_failed`, and the declaration stays
  pending for the next sign-in or apply.
- Declaring an already bound subject through `role_declared` grants the role
  at once. That closes the race in which the binding appears between apply's
  observation and the declaration.
