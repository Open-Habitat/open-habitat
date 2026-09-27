//go:build linux

package provision

import (
	"errors"
	"path/filepath"
	"testing"

	"golang.org/x/sys/unix"
)

// Model the whole ancestor chain without changing /etc, /home, or host UIDs.
// This exercises the same no-follow stat interpretation as the executor.
func TestProtectedConfigParentPolicy(t *testing.T) {
	const gatewayGID = 21003
	base := filepath.Join(t.TempDir(), "etc", "native-agent-host")
	stats := map[string]unix.Stat_t{}
	for p := base; ; p = filepath.Dir(p) {
		stats[p] = unix.Stat_t{Mode: unix.S_IFDIR | 0755, Uid: 0, Gid: 0}
		if p == "/" {
			break
		}
	}
	stats[base] = unix.Stat_t{Mode: unix.S_IFDIR | 0750, Uid: 0, Gid: gatewayGID}
	inspect := func(path string) (unix.Stat_t, error) {
		st, ok := stats[path]
		if !ok {
			return st, unix.ENOENT
		}
		return st, nil
	}
	if err := configParentPolicy(base, gatewayGID, inspect); err != nil {
		t.Fatal("protected root:gateway 0750 rejected:", err)
	}
	cases := []struct {
		name string
		path string
		stat unix.Stat_t
	}{
		{"wrong root owner", base, unix.Stat_t{Mode: unix.S_IFDIR | 0750, Uid: 1000, Gid: gatewayGID}},
		{"wrong gateway group", base, unix.Stat_t{Mode: unix.S_IFDIR | 0750, Uid: 0, Gid: 0}},
		{"world searchable", base, unix.Stat_t{Mode: unix.S_IFDIR | 0755, Uid: 0, Gid: gatewayGID}},
		{"group writable", base, unix.Stat_t{Mode: unix.S_IFDIR | 0770, Uid: 0, Gid: gatewayGID}},
		{"symlink config", base, unix.Stat_t{Mode: unix.S_IFLNK | 0750, Uid: 0, Gid: gatewayGID}},
		{"symlink ancestor", filepath.Dir(base), unix.Stat_t{Mode: unix.S_IFLNK | 0755, Uid: 0, Gid: 0}},
		{"group writable ancestor", filepath.Dir(base), unix.Stat_t{Mode: unix.S_IFDIR | 0775, Uid: 0, Gid: 0}},
		{"other writable ancestor", filepath.Dir(base), unix.Stat_t{Mode: unix.S_IFDIR | 0757, Uid: 0, Gid: 0}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			old := stats[tc.path]
			stats[tc.path] = tc.stat
			defer func() { stats[tc.path] = old }()
			if err := configParentPolicy(base, gatewayGID, inspect); err == nil {
				t.Fatal("accepted drift")
			}
		})
	}
	if err := configParentPolicy(base, gatewayGID, func(string) (unix.Stat_t, error) { return unix.Stat_t{}, errors.New("stat failed") }); err == nil {
		t.Fatal("accepted unavailable stat")
	}
	if err := configParentPolicy(base+"/../native-agent-host", gatewayGID, inspect); err == nil {
		t.Fatal("accepted noncanonical path")
	}
}
