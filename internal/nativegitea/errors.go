// Package nativegitea adapts tea v0.16.0's native PAT logins for Habitat's
// fixed Gitea reads and Git's credential protocol (ADR 0031). tea's
// configuration file in the person's home is the only connection and secret
// store: this package keeps no account list, cache or token copy of its own,
// and rereads the native file on every call. It holds no authority beyond the
// Unix user it runs as.
package nativegitea

// Error is a fixed failure. Callers map Code to their own surface; native
// error text, paths and token bytes never travel inside it.
type Error struct{ code string }

func (e *Error) Error() string { return "gitea: " + e.code }

// Code is the stable failure name.
func (e *Error) Code() string { return e.code }

var (
	// ErrInvalidAddress: the address is not a canonical HTTPS Gitea base.
	ErrInvalidAddress = &Error{"invalid_address"}
	// ErrInvalidToken: the PAT is empty, too long or not printable ASCII.
	ErrInvalidToken = &Error{"invalid_token"}
	// ErrForbiddenDestination: the destination resolved to an address class
	// a Gitea connection may never use (link-local, metadata, unspecified,
	// multicast, or loopback the person did not name).
	ErrForbiddenDestination = &Error{"forbidden_destination"}
	// ErrUnreachable: no connection could be made or it failed in transit.
	ErrUnreachable = &Error{"unreachable"}
	// ErrUntrustedTLS: the server's certificate did not verify against the
	// operator-approved system trust store.
	ErrUntrustedTLS = &Error{"tls_untrusted"}
	// ErrRedirect: the server answered with a redirect, which is never followed.
	ErrRedirect = &Error{"redirect_refused"}
	// ErrRejected: Gitea rejected the PAT (401).
	ErrRejected = &Error{"token_rejected"}
	// ErrScope: the PAT lacks the scope the read needs (403).
	ErrScope = &Error{"insufficient_scope"}
	// ErrProtocol: the answer was not the bounded shape a Gitea gives.
	ErrProtocol = &Error{"unexpected_response"}

	// ErrUnavailable: tea's native file is unsafe, malformed or ambiguous.
	// It is never reported as an empty list.
	ErrUnavailable = &Error{"native_unavailable"}
	// ErrBusy: tea's configuration lock stayed held past the timeout.
	ErrBusy = &Error{"busy"}
	// ErrInUse: the daemon holds the login for an active job.
	ErrInUse = &Error{"in_use"}
	// ErrExists: tea already has an entry for this account or this PAT.
	ErrExists = &Error{"exists"}
	// ErrNameTaken: the owned login name belongs to a different entry.
	ErrNameTaken = &Error{"name_conflict"}
	// ErrNotFound: no entry has the requested name.
	ErrNotFound = &Error{"not_found"}
	// ErrChanged: the named entry no longer has the observed identity.
	ErrChanged = &Error{"changed"}
	// ErrAmbiguous: names or accounts are duplicated in tea's file.
	ErrAmbiguous = &Error{"ambiguous"}
	// ErrUnsupported: the entry is not a PAT login this adapter can use.
	ErrUnsupported = &Error{"unsupported_entry"}
	// ErrAccountMismatch: the PAT authenticates a different Gitea account.
	ErrAccountMismatch = &Error{"account_mismatch"}
	// ErrWriteFailed: nothing was replaced; the previous bytes are intact.
	ErrWriteFailed = &Error{"write_failed"}
	// ErrUncertain: the replacement may or may not be durable. Reread; never
	// replay the write.
	ErrUncertain = &Error{"write_uncertain"}

	// ErrNoMatch: no unique login matches the Git request.
	ErrNoMatch = &Error{"no_match"}
	// ErrInvalidRequest: the Git credential request is malformed.
	ErrInvalidRequest = &Error{"invalid_request"}
	// ErrHelperConflict: Git configuration in the helper's scope is not ours.
	ErrHelperConflict = &Error{"helper_conflict"}
	// ErrGit: running Git itself failed.
	ErrGit = &Error{"git_failed"}
)
