//go:build linux

package host

import (
	"strings"
)

const gatewayAccount = "open-habitat-gateway"

// Matching numeric IDs do not prove an exclusive service identity: another
// person's primary/supplementary group could otherwise expose gateway secrets.
// Fresh apply never adopts a pre-existing gateway account/group. Continuations
// and repeats accept only the dedicated identity that our sysusers declares.
func gatewayNSSSafe(s Site, fresh bool, db string, b []byte) error {
	for _, line := range strings.Split(strings.TrimSpace(string(b)), "\n") {
		f := strings.Split(line, ":")
		if db == "passwd" {
			if len(f) != 7 {
				return ErrTrust
			}
			if f[0] == gatewayAccount || f[2] == uintString(uint64(s.Gateway.UID)) {
				if fresh || f[0] != gatewayAccount || f[2] != uintString(uint64(s.Gateway.UID)) || f[3] != uintString(uint64(s.Gateway.GID)) || f[5] != "/nonexistent" || f[6] != "/usr/sbin/nologin" {
					return ErrImmutable
				}
			}
			if f[3] == uintString(uint64(s.Gateway.GID)) && f[0] != gatewayAccount {
				return ErrImmutable
			}
		} else {
			if len(f) != 4 {
				return ErrTrust
			}
			if f[0] == gatewayAccount || f[2] == uintString(uint64(s.Gateway.GID)) {
				if fresh || f[0] != gatewayAccount || f[2] != uintString(uint64(s.Gateway.GID)) || f[3] != "" {
					return ErrImmutable
				}
			}
			for _, member := range strings.Split(f[3], ",") {
				if member == gatewayAccount {
					return ErrImmutable
				}
			}
		}
	}
	return nil
}
