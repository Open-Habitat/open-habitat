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
	base := filepath.Join(t.TempDir(), "etc", "omega-habitat", "daemon", "user-mappings")
	stats := map[string]unix.Stat_t{}
	for p := base; ; p = filepath.Dir(p) {
		stats[p] = unix.Stat_t{Mode: unix.S_IFDIR | 0755, Uid: 0, Gid: 0}
		if p == "/" {
			break
		}
	}
	for _, p := range []string{base, filepath.Dir(base), filepath.Dir(filepath.Dir(base))} {
		stats[p] = unix.Stat_t{Mode: unix.S_IFDIR | 0711, Uid: 0, Gid: 0}
	}
	inspect := func(path string) (unix.Stat_t, error) {
		st, ok := stats[path]
		if !ok {
			return st, unix.ENOENT
		}
		return st, nil
	}
	if err := configParentPolicy(base, inspect); err != nil {
		t.Fatal("protected root:root 0711 rejected:", err)
	}
	cases := []struct {
		name string
		path string
		stat unix.Stat_t
	}{
		{"wrong owner", base, unix.Stat_t{Mode: unix.S_IFDIR | 0711, Uid: 1000}},
		{"wrong group", base, unix.Stat_t{Mode: unix.S_IFDIR | 0711, Gid: gatewayGID}},
		{"world readable", base, unix.Stat_t{Mode: unix.S_IFDIR | 0755}},
		{"group readable", filepath.Dir(base), unix.Stat_t{Mode: unix.S_IFDIR | 0751}},
		{"non-searchable", filepath.Dir(filepath.Dir(base)), unix.Stat_t{Mode: unix.S_IFDIR | 0700}},
		{"symlink config", base, unix.Stat_t{Mode: unix.S_IFLNK | 0711}},
		{"symlink ancestor", filepath.Dir(base), unix.Stat_t{Mode: unix.S_IFLNK | 0711}},
		{"group writable ancestor", filepath.Dir(base), unix.Stat_t{Mode: unix.S_IFDIR | 0731}},
		{"other writable ancestor", filepath.Dir(base), unix.Stat_t{Mode: unix.S_IFDIR | 0713}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			old := stats[tc.path]
			stats[tc.path] = tc.stat
			defer func() { stats[tc.path] = old }()
			if err := configParentPolicy(base, inspect); err == nil {
				t.Fatal("accepted drift")
			}
		})
	}
	if err := configParentPolicy(base, func(string) (unix.Stat_t, error) { return unix.Stat_t{}, errors.New("stat failed") }); err == nil {
		t.Fatal("accepted unavailable stat")
	}
	if err := configParentPolicy(base+"/../user-mappings", inspect); err == nil {
		t.Fatal("accepted noncanonical path")
	}
}
