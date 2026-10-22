//go:build linux

package host

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

const maxPackageObservationBytes = 32 << 20

var errPackageObservation = errors.New("runtime_package_observation_unavailable")
var debArchitectureRE = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,63}$`)

// ObserveRuntimePackages reads the native Ubuntu dpkg database, without a solver,
// package writes, network access or version ordering. Only an authenticated lock
// can select expectations. This is a point-in-time observation, not activation
// approval: the executor must repeat it under its operation lock before writes.
// Database agreement does not prove executable bytes, closure or native startup.
func (r AuthenticatedRelease) ObserveRuntimePackages(ctx context.Context, profiles []string) (Check, error) {
	return r.observeRuntimePackages(ctx, profiles, queryRuntimePackages)
}

type packageQuery func(context.Context) ([]byte, error)

func (r AuthenticatedRelease) observeRuntimePackages(ctx context.Context, profiles []string, query packageQuery) (Check, error) {
	artifacts, err := r.Select(profiles)
	if err != nil {
		return Check{}, err
	}
	if err := ctx.Err(); err != nil {
		return Check{}, err
	}
	expected := map[string]string{}
	for _, a := range artifacts {
		for _, p := range a.Packages {
			expected[p.Name+":"+p.Architecture] = ""
		}
	}
	if len(expected) == 0 {
		return r.CheckRuntimePackages(profiles, nil)
	}
	// No selectors are passed to dpkg-query: after a successful nonempty
	// database read, an absent identity was observed missing. Per-name
	// queries use exit 1 for both missing packages and other errors and cannot
	// support that distinction safely by parsing localized diagnostics.
	output, err := query(ctx)
	if ctx.Err() != nil {
		return Check{}, ctx.Err()
	}
	unavailable := Check{"release.runtime_packages", "unavailable", "runtime_package_observation_required"}
	if err != nil {
		return unavailable, nil
	}
	observed, err := parseRuntimePackages(output)
	if err != nil {
		return unavailable, nil
	}
	for id := range expected {
		expected[id] = observed[id]
	}
	return r.CheckRuntimePackages(profiles, expected)
}

func queryRuntimePackages(ctx context.Context) ([]byte, error) {
	return queryRuntimePackagesAt(ctx, "/var/lib/dpkg")
}

// The alternate directory is an unexported native-test seam, never caller input.
func queryRuntimePackagesAt(ctx context.Context, admin string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	base := filepath.Join(admin, "status")
	before, err := packageDatabaseStat(base)
	if err != nil {
		return nil, errPackageObservation
	}
	cmd := exec.CommandContext(ctx, "/usr/bin/dpkg-query", "--admindir="+admin, "--show", "--showformat=${Package}\t${Architecture}\t${Version}\t${Status}\\n")
	// In particular DPKG_ROOT, DPKG_ADMINDIR, loader and locale overrides may not
	// redirect a privileged observation to an unrelated database or executable.
	cmd.Env = []string{"PATH=/usr/bin:/bin", "HOME=/nonexistent", "LANG=C", "LC_ALL=C"}
	cmd.Dir = "/"
	cmd.WaitDelay = time.Second
	output := &packageOutput{}
	cmd.Stdout = output
	cmd.Stderr = io.Discard
	if err := cmd.Run(); err != nil {
		return nil, errPackageObservation
	}
	after, err := packageDatabaseStat(base)
	if err != nil || !samePackageDatabase(before, after) {
		return nil, errPackageObservation
	}
	return output.data.Bytes(), nil
}

// dpkg-query permits a missing base status file and can still return matching
// rows from updates/*. Those rows cannot qualify a host whose base database was
// lost. Refuse links/special/empty/unreadable files and detect normal concurrent
// base replacement/change; this is not a lock against external package writers.
func packageDatabaseStat(path string) (unix.Stat_t, error) {
	var st unix.Stat_t
	f, err := os.OpenFile(path, os.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK, 0)
	if err != nil {
		return st, errPackageObservation
	}
	err = unix.Fstat(int(f.Fd()), &st)
	closeErr := f.Close()
	if err != nil || closeErr != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Size <= 0 {
		return unix.Stat_t{}, errPackageObservation
	}
	return st, nil
}

func samePackageDatabase(a, b unix.Stat_t) bool {
	return a.Dev == b.Dev && a.Ino == b.Ino && a.Size == b.Size && a.Mtim == b.Mtim && a.Ctim == b.Ctim
}

type packageOutput struct{ data bytes.Buffer }

func (b *packageOutput) Write(p []byte) (int, error) {
	if len(p) > maxPackageObservationBytes-b.data.Len() {
		return 0, errPackageObservation
	}
	return b.data.Write(p)
}

func parseRuntimePackages(output []byte) (map[string]string, error) {
	// dpkg-query also exits 0 when its status database is absent or empty.
	// A supported Ubuntu host has installed base packages; no rows is not a
	// trustworthy observation of their absence.
	if len(output) == 0 || len(output) > maxPackageObservationBytes || output[len(output)-1] != '\n' {
		return nil, errPackageObservation
	}
	observed := map[string]string{}
	for _, line := range strings.Split(string(output[:len(output)-1]), "\n") {
		fields := strings.Split(line, "\t")
		// dpkg can retain pre-multiarch/selection records without architecture
		// and accepts some non-policy version spellings with a warning. These
		// must not poison unrelated locks. An arch-less identity cannot satisfy
		// an amd64/all lock; versions are compared literally, never interpreted.
		if len(fields) != 4 || !packageRE.MatchString(fields[0]) || (fields[1] != "" && !debArchitectureRE.MatchString(fields[1])) {
			return nil, errPackageObservation
		}
		status := strings.Split(fields[3], " ")
		if len(status) != 3 || !debWant(status[0]) || (status[1] != "ok" && status[1] != "reinstreq") || !debState(status[2]) {
			return nil, errPackageObservation
		}
		id := fields[0] + ":" + fields[1]
		if _, duplicate := observed[id]; duplicate {
			return nil, errPackageObservation
		}
		observed[id] = ""
		// Residual config files and partially configured/broken packages are not
		// installed acceptance, even if their Version field still matches the lock.
		if (status[0] == "install" || status[0] == "hold") && status[1] == "ok" && status[2] == "installed" {
			if fields[2] == "" {
				return nil, errPackageObservation
			}
			observed[id] = fields[2]
		}
	}
	return observed, nil
}

func debWant(s string) bool {
	switch s {
	case "unknown", "install", "hold", "deinstall", "purge":
		return true
	}
	return false
}
func debState(s string) bool {
	switch s {
	case "not-installed", "config-files", "half-installed", "unpacked", "half-configured", "triggers-awaited", "triggers-pending", "installed":
		return true
	}
	return false
}
