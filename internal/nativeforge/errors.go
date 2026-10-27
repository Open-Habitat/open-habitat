// Package nativeforge holds what the native code-host adapters share
// (nativegitea for tea, nativegitlab for glab): the canonical HTTPS base, the
// egress-checked HTTP reads, Git's credential protocol, the Git helper
// registration and the safe lifecycle of a native file in a person's home. It
// is a library like egress, not a provider abstraction: each adapter keeps its
// own native file format, path rules, account model and API reads, because
// those are where the providers differ and where mistakes would hide behind a
// common interface. It holds no authority beyond the Unix user it runs as.
package nativeforge

// Error is a fixed failure. Callers map Code to their own surface; native
// error text, paths and token bytes never travel inside it.
type Error struct{ code string }

func (e *Error) Error() string { return "forge: " + e.code }

// Code is the stable failure name.
func (e *Error) Code() string { return e.code }

// NewError is a provider's own fixed failure beside the shared ones.
func NewError(code string) *Error { return &Error{code} }

var (
	// ErrInvalidAddress: the address is not a canonical HTTPS base.
	ErrInvalidAddress = &Error{"invalid_address"}
	// ErrInvalidToken: the token is empty, too long or not printable ASCII.
	ErrInvalidToken = &Error{"invalid_token"}
	// ErrForbiddenDestination: the destination resolved to an address class
	// a connection may never use (link-local, metadata, unspecified,
	// multicast, or loopback the person did not name).
	ErrForbiddenDestination = &Error{"forbidden_destination"}
	// ErrUnreachable: no connection could be made or it failed in transit.
	ErrUnreachable = &Error{"unreachable"}
	// ErrUntrustedTLS: the server's certificate did not verify against the
	// operator-approved system trust store.
	ErrUntrustedTLS = &Error{"tls_untrusted"}
	// ErrRedirect: the server answered with a redirect, which is never followed.
	ErrRedirect = &Error{"redirect_refused"}
	// ErrRejected: the server rejected the token (401).
	ErrRejected = &Error{"token_rejected"}
	// ErrScope: the token lacks the scope the read needs (403).
	ErrScope = &Error{"insufficient_scope"}
	// ErrProtocol: the answer was not the bounded shape the provider gives.
	ErrProtocol = &Error{"unexpected_response"}

	// ErrUnavailable: the native file is unsafe, malformed or ambiguous.
	// It is never reported as an empty list.
	ErrUnavailable = &Error{"native_unavailable"}
	// ErrBusy: the native tool's configuration lock stayed held past the
	// timeout.
	ErrBusy = &Error{"busy"}
	// ErrInUse: the daemon holds the login for an active job.
	ErrInUse = &Error{"in_use"}
	// ErrExists: the native file already has an entry for this account, this
	// token or (for a tool with one account per server) this server.
	ErrExists = &Error{"exists"}
	// ErrNameTaken: the owned login name belongs to a different entry.
	ErrNameTaken = &Error{"name_conflict"}
	// ErrNotFound: no entry has the requested name.
	ErrNotFound = &Error{"not_found"}
	// ErrChanged: the named entry no longer has the observed identity.
	ErrChanged = &Error{"changed"}
	// ErrAmbiguous: names or accounts are duplicated in the native file.
	ErrAmbiguous = &Error{"ambiguous"}
	// ErrUnsupported: the entry is not a token login the adapter can use.
	ErrUnsupported = &Error{"unsupported_entry"}
	// ErrAccountMismatch: the token authenticates a different account.
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
