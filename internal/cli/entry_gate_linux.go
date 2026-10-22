//go:build linux

package cli

import (
	"golang.org/x/sys/unix"
	"net/http"
	"os"
)

// This root-owned fence controls HTTP entry points only. Private root control
// stays available for quota/role/revocation convergence while admission is shut.
// Any failure to establish absence fails closed, including parent permission
// loss. The gateway can neither create nor remove the fence.
func entryGate(path string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var parent unix.Stat_t
		if unix.Lstat("/etc/open-habitat", &parent) != nil || parent.Uid != 0 || parent.Mode&0022 != 0 || parent.Mode&unix.S_IFMT != unix.S_IFDIR {
			http.Error(w, "maintenance", http.StatusServiceUnavailable)
			return
		}
		if _, e := os.Lstat(path); !os.IsNotExist(e) {
			http.Error(w, "maintenance", http.StatusServiceUnavailable)
			return
		}
		next.ServeHTTP(w, r)
	})
}
