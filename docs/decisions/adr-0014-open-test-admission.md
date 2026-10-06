# ADR 0014: Open the test installation to GitHub sign-in

**Status:** Accepted

**Decision date:** 2026-10-06

## Context

The dedicated test installation previously admitted people through Cloudflare Access email verification before GitHub sign-in. Its root broker now supports `admission: "any"`, so it can create a separate Unix account for a GitHub identity without an operator-managed ID allowlist. Requiring an Access email first adds a step that Jari does not want for this disposable installation.

## Decision

Remove the Cloudflare Access application and tunnel Access requirement for the test hostname, and disable the gateway's optional `oauth.access` assertion verifier in that installation's config. Both layers must be changed together: leaving the verifier enabled after removing Access would prevent sign-in. Keep the broker in `admission: "any"` mode. An unauthenticated visitor reaches the product's GitHub sign-in; a verified GitHub numeric ID is bound by the broker to its own Unix account. A stranger who finds the address can create an account and run commands on the test VM. The address is not advertised, but obscurity is not an authorization control.

This is **only** the admission policy for the disposable test installation. It does not change the default broker allowlist, the optional Access verifier code, production admission, or the Unix-user separation between people. The gateway still verifies GitHub OAuth, the broker still accepts only the gateway's kernel-identified caller, and the test VM retains its restricted network route through the tunnel and its loopback-bound TLS origin. Avoid serving a partially changed policy during the transition.

This supersedes ADR 0004's test-installation requirement to verify a signed Cloudflare Access assertion before using allowlist-free broker admission. That requirement was a precaution for the previous, email-gated test policy, not an intrinsic coupling in the product. [The implementation issue](../../issues/open-test-installation/item.md) records the live verification and its limits.
