//go:build linux

package integrations

import (
	"regexp"
	"strings"
)

// A Microsoft connection is a user in one organisation, so its name is
// `<address>~<tenant GUID>`, lowercase: the address for people to read and
// the organisation the person chose. The name is one path segment and is
// what every store of the connection, its Pi entries' `--account`, the
// daemon's Microsoft endpoint and the catalog key it by. `~` is outside
// the address alphabet (ValidAddress), so a name is never read as an
// address or the reverse.
//
// The address is a label, chosen once at the first sign-in. Who signed in is
// decided by Microsoft's immutable identifiers (the pin in the entries), never
// by comparing it, so a later rename at Microsoft leaves the name as it was.
//
// A bare address is the form before names. The daemon renames such stores at
// the first check after an upgrade (microsoftMigrateNames); one whose tenant
// cannot be read from its own files stays under the address until it is
// removed or replaced by a new sign-in.
const microsoftNameSeparator = "~"

// microsoftTenantGUID is a tenant as a name carries it: a GUID, never an
// audience keyword such as common or organizations, nor a domain.
var microsoftTenantGUID = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// microsoftName is the connection's name, or "" when either part is invalid.
func microsoftName(address, tenant string) string {
	address, tenant = strings.ToLower(address), strings.ToLower(tenant)
	if !ValidAddress(address) || !microsoftTenantGUID.MatchString(tenant) {
		return ""
	}
	return address + microsoftNameSeparator + tenant
}

// microsoftSplitName returns a name's address and tenant.
func microsoftSplitName(name string) (address, tenant string, ok bool) {
	address, tenant, found := strings.Cut(name, microsoftNameSeparator)
	if !found || !ValidAddress(address) || !microsoftTenantGUID.MatchString(tenant) {
		return "", "", false
	}
	return address, tenant, true
}

// validMicrosoftName admits only a well-formed connection name.
func validMicrosoftName(name string) bool {
	_, _, ok := microsoftSplitName(name)
	return ok
}

// validMicrosoftAccount admits the catalog's keys for Microsoft: a name, or
// a bare address left from before names.
func validMicrosoftAccount(key string) bool {
	return validMicrosoftName(key) || ValidAddress(key)
}

// microsoftAddressOf is the address part of a key: what people read, and
// what synced directories and fetched files are named by.
func microsoftAddressOf(key string) string {
	if address, _, ok := microsoftSplitName(key); ok {
		return address
	}
	return key
}

// microsoftTenantOf is a name's tenant, "" for a bare address.
func microsoftTenantOf(key string) string {
	_, tenant, _ := microsoftSplitName(key)
	return tenant
}

// microsoftSameAccount says whether a sign-in that renewed requested ended
// in got: the same name, or a bare address's replacement under its name.
func microsoftSameAccount(requested, got string) bool {
	return requested == got || (ValidAddress(requested) && microsoftAddressOf(got) == requested && validMicrosoftName(got))
}
