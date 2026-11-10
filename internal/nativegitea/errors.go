// Package nativegitea adapts tea v0.16.0's native PAT logins for Habitat's
// fixed Gitea reads and Git's credential protocol (ADR 0031). tea's
// configuration file in the person's home is the only connection and secret
// store: this package keeps no account list, cache or token copy of its own,
// and rereads the native file on every call. It holds no authority beyond the
// Unix user it runs as. What it shares with the GitLab adapter (the base
// address, the egress-checked reads, Git's credential protocol and helper
// registration, the native file lifecycle) is nativeforge's.
package nativegitea

import "github.com/open-habitat/open-habitat/internal/nativeforge"

// The shared parts under the names this package has always used.
type (
	Base              = nativeforge.Base
	Error             = nativeforge.Error
	CredentialRequest = nativeforge.CredentialRequest
	Credential        = nativeforge.Credential
	GitConfig         = nativeforge.GitConfig
	HelperState       = nativeforge.HelperState
	Outcome           = nativeforge.Outcome
)

var (
	ParseBase              = nativeforge.ParseBase
	RemoteAuthority        = nativeforge.RemoteAuthority
	ParseCredentialRequest = nativeforge.ParseCredentialRequest
	WriteCredential        = nativeforge.WriteCredential
)

const (
	HelperRegistered = nativeforge.HelperRegistered
	HelperAbsent     = nativeforge.HelperAbsent
	HelperForeign    = nativeforge.HelperForeign
	HelperShadowed   = nativeforge.HelperShadowed

	Written   = nativeforge.Written
	Unchanged = nativeforge.Unchanged
	Absent    = nativeforge.Absent
)

// HelperArgs follow the executable in the registered helper command; Git
// appends get, store or erase.
const HelperArgs = "gitea git-credential"

// HelperCommand is the Git helper value for an installed executable.
func HelperCommand(executable string) (string, error) {
	return nativeforge.HelperCommand(executable, HelperArgs)
}

// NewGitConfig edits home's global Git configuration for Gitea bases.
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
	// ErrRejected: Gitea rejected the PAT (401).
	ErrRejected = nativeforge.ErrRejected
	// ErrScope: the PAT lacks the scope the read needs (403).
	ErrScope    = nativeforge.ErrScope
	ErrProtocol = nativeforge.ErrProtocol

	// ErrUnavailable: tea's native file is unsafe, malformed or ambiguous.
	ErrUnavailable = nativeforge.ErrUnavailable
	// ErrBusy: tea's configuration lock stayed held past the timeout.
	ErrBusy  = nativeforge.ErrBusy
	ErrInUse = nativeforge.ErrInUse
	// ErrExists: tea already has an entry for this account or this PAT.
	ErrExists          = nativeforge.ErrExists
	ErrNameTaken       = nativeforge.ErrNameTaken
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
	ErrGit            = nativeforge.ErrGit
)
