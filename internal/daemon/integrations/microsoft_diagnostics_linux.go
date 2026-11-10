//go:build linux

package integrations

import (
	"encoding/json"
	"errors"
)

// Graph messages may contain addresses, tenant IDs, URLs and even echoed input.
// Keep only exact, known non-identifying messages, never a scrubbed raw string.
func microsoftGraphError(data []byte) (code, message string) {
	var body struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	code, message = "redacted", "redacted"
	if json.Unmarshal(data, &body) != nil {
		return
	}
	switch body.Error.Code {
	case "accessDenied", "AccessDenied", "Authorization_RequestDenied", "InvalidAuthenticationToken", "itemNotFound", "ResourceNotFound", "BadRequest", "invalidRequest", "notSupported", "serviceNotAvailable", "generalException", "UnknownError", "unauthenticated", "TooManyRequests", "activityLimitReached":
		code = body.Error.Code
	}
	switch body.Error.Message {
	case "Access denied", "Access denied.", "Insufficient privileges to complete the operation.", "Unable to retrieve user's mysite URL.", "Tenant does not have a SPO license.", "The resource could not be found.", "The request is malformed or incorrect.":
		message = body.Error.Message
	}
	return
}

type microsoftResponseError struct {
	status        int
	code, message string
	err           error
}

func (e microsoftResponseError) Error() string { return string(ToolFailed) }
func (e microsoftResponseError) Unwrap() error { return e.err }

// All strings here are product constants or exact allowlisted provider values.
// No endpoint is logged: a site/drive URL contains the person's identifiers.
type microsoftDiscoveryError struct {
	step, tenantKind string
	// siteHost places a skipped site's host relative to the followed sites
	// that did open, as a constant (siteHostSame, ...); empty elsewhere.
	siteHost string
	// siteLookup is the lookup form that decided a skipped site
	// (siteLookupID, ...); empty for a root that is not a site.
	siteLookup string
	err        error
}

// A site is first opened by its composite ID; when that 404s and its webUrl
// is a plain site address, by the ID Graph resolves for the webUrl. The same
// ID back means the site exists but its libraries 404.
const (
	siteLookupID     = "composite_id"
	siteLookupWebURL = "web_url"
	siteLookupSameID = "web_url_same_id"
)

// A followed site whose host no reachable site shares is likely another
// organisation's (a Teams shared channel hosted there): this sign-in's token
// cannot open it. One on a shared host was deleted or is closed to the person.
const (
	siteHostSame    = "same_as_reachable_site"
	siteHostOther   = "other_than_reachable_sites"
	siteHostUnknown = "no_reachable_site"
)

func (e microsoftDiscoveryError) Error() string { return string(ToolFailed) }
func (e microsoftDiscoveryError) Unwrap() error { return e.err }
func (e microsoftDiscoveryError) diagnostic() []any {
	status, code, message := 0, "not_applicable", "not_applicable"
	var response microsoftResponseError
	if errors.As(e.err, &response) {
		status, code, message = response.status, response.code, response.message
	}
	attrs := []any{"step", e.step, "tool", "direct_http", "exit_status", "not_applicable", "http_status", status, "graph_code", code, "graph_message", message, "tenant_kind", e.tenantKind}
	if e.siteHost != "" {
		attrs = append(attrs, "site_host", e.siteHost)
	}
	if e.siteLookup != "" {
		attrs = append(attrs, "site_lookup", e.siteLookup)
	}
	return attrs
}
