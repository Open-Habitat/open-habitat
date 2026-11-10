// Package nativegitlab adapts glab v1.124's native host logins for Habitat's
// fixed GitLab reads and Git's credential protocol (research
// gitlab-integration, recommendation A). glab's config.yml in the person's
// home is the only connection and secret store: this package keeps no
// account list, cache or token copy of its own, rereads the native file on
// every call and writes only the one host entry a person connects, under
// glab's own lock. glab keeps one account per server, so a connection is a
// server and the account its token authenticates. It holds no authority
// beyond the Unix user it runs as; what it shares with the Gitea adapter is
// nativeforge's.
package nativegitlab

import "github.com/open-habitat/open-habitat/internal/nativeforge"

type (
	Base              = nativeforge.Base
	Error             = nativeforge.Error
	CredentialRequest = nativeforge.CredentialRequest
	Credential        = nativeforge.Credential
	GitConfig         = nativeforge.GitConfig
	Outcome           = nativeforge.Outcome
)

var (
	ParseBase              = nativeforge.ParseBase
	ParseCredentialRequest = nativeforge.ParseCredentialRequest
	WriteCredential        = nativeforge.WriteCredential
)

// HelperArgs follow the executable in the registered helper command; Git
// appends get, store or erase.
const HelperArgs = "gitlab git-credential"

// HelperCommand is the Git helper value for an installed executable.
func HelperCommand(executable string) (string, error) {
	return nativeforge.HelperCommand(executable, HelperArgs)
}

// NewGitConfig edits home's global Git configuration for GitLab bases.
func NewGitConfig(home, configHome, git string) GitConfig {
	return GitConfig{Home: home, ConfigHome: configHome, Git: git, HelperArgs: HelperArgs}
}

var (
	ErrInvalidAddress       = nativeforge.ErrInvalidAddress
	ErrInvalidToken         = nativeforge.ErrInvalidToken
	ErrForbiddenDestination = nativeforge.ErrForbiddenDestination
	ErrUnreachable          = nativeforge.ErrUnreachable
	ErrUntrustedTLS         = nativeforge.ErrUntrustedTLS
	ErrRedirect             = nativeforge.ErrRedirect
	// ErrRejected: GitLab rejected the token (401): revoked, mistyped or
	// another server's.
	ErrRejected = nativeforge.ErrRejected
	// ErrExpired: GitLab says the token has expired (401, "Token is
	// expired"). The person creates a new one; nothing renews it.
	ErrExpired = nativeforge.NewError("token_expired")
	// ErrScope: the token lacks the scope the read needs (403), which for
	// the fixed reads is read_api.
	ErrScope    = nativeforge.ErrScope
	ErrProtocol = nativeforge.ErrProtocol

	// ErrUnavailable: glab's file is unsafe, malformed or ambiguous.
	ErrUnavailable = nativeforge.ErrUnavailable
	// ErrBusy: glab's config.lock stayed held past the timeout.
	ErrBusy  = nativeforge.ErrBusy
	ErrInUse = nativeforge.ErrInUse
	// ErrExists: glab already holds a login for this server (one account
	// per server) or this token.
	ErrExists          = nativeforge.ErrExists
	ErrNotFound        = nativeforge.ErrNotFound
	ErrChanged         = nativeforge.ErrChanged
	ErrAmbiguous       = nativeforge.ErrAmbiguous
	ErrUnsupported     = nativeforge.ErrUnsupported
	ErrAccountMismatch = nativeforge.ErrAccountMismatch
	ErrWriteFailed     = nativeforge.ErrWriteFailed
	ErrUncertain       = nativeforge.ErrUncertain

	ErrNoMatch        = nativeforge.ErrNoMatch
	ErrInvalidRequest = nativeforge.ErrInvalidRequest
	ErrHelperConflict = nativeforge.ErrHelperConflict
)
