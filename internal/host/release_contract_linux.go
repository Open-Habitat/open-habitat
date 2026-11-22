//go:build linux

package host

// RuntimeVerificationContract identifies runtime-release verify semantics, not
// a build, manifest schema, installation check, or trust credential. See AGENTS.md
// and TestVerificationContractSource for the deliberate bump/review rule.
const RuntimeVerificationContract = "runtime-release-v1"
