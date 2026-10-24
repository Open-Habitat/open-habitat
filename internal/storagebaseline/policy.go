package storagebaseline

import (
	"encoding/json"
	"regexp"
	"strings"
)

// Policy is the installed storage contract shared by preparation and boot.
// Canonical encoding lets the fixed reader reject ambiguous JSON spellings.
// UserQuota false is an installation without per-user limits: homes share the
// declared filesystem and nothing stops one person filling it. Only root's
// preparation writes it; runtimes read it and never infer the mode themselves.
type Policy struct {
	SchemaVersion int    `json:"schema_version"`
	HomeUUID      string `json:"home_uuid"`
	UserQuota     bool   `json:"user_quota"`
}

var uuid = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

func PolicyBytes(homeUUID string, userQuota bool) []byte {
	b, _ := json.Marshal(Policy{1, homeUUID, userQuota})
	return append(b, '\n')
}
func ParsePolicy(b []byte) (Policy, bool) {
	var p Policy
	if json.Unmarshal(b, &p) != nil {
		return p, false
	}
	canonical, _ := json.Marshal(p)
	return p, strings.TrimSpace(string(b)) == string(canonical) && p.SchemaVersion == 1 && uuid.MatchString(p.HomeUUID)
}
