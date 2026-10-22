//go:build linux

package host

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/storagequota"
	"golang.org/x/sys/unix"
)

func TestMain(m *testing.M) {
	if len(os.Args) == 2 && os.Args[1] == "quota-probe-write" {
		os.Exit(storagequota.ProbeWrite())
	}
	os.Exit(m.Run())
}

func TestPrepareProbeCrashFences(t *testing.T) {
	for _, phase := range []string{"probe_reserved", "probe_armed", "probe_cleanup", "probe_verified"} {
		t.Run(phase, func(t *testing.T) {
			path, owner := operationFixture(t)
			l, err := openOperationLock(context.Background(), path, owner, time.Now)
			if err != nil {
				t.Fatal(err)
			}
			o, err := l.Begin("prepare", strings.Repeat("a", 64), Release{"0.1.0", strings.Repeat("b", 64)})
			if err != nil {
				t.Fatal(err)
			}
			home := filepath.Dir(path)
			fd, err := unix.Open(home, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
			if err != nil {
				t.Fatal(err)
			}
			defer unix.Close(fd)
			restored := false
			ops := quotaProbeOps{
				reserve: func(context.Context, int) (storagequota.ProbeRecord, error) {
					return storagequota.ProbeRecord{UID: 61000}, nil
				},
				write:   func(context.Context, int, *os.File, storagequota.ProbeRecord, string) error { return nil },
				restore: func(int, storagequota.ProbeRecord) error { restored = true; return nil },
				crash: func(p string) error {
					if p == phase {
						return fmt.Errorf("simulated loss")
					}
					return nil
				},
			}
			_, ev, err := prepareQuotaProbe(context.Background(), l, o, fd, "", ops)
			if err == nil {
				t.Fatal("crash escaped")
			}
			if restored != (phase == "probe_verified") {
				t.Fatal("unexpected cleanup", phase, restored)
			}
			raw, err := os.ReadFile(filepath.Join(path, o.ID+"-probe.json"))
			if err != nil {
				t.Fatal(err)
			}
			var evidence ProbeEvidence
			if json.Unmarshal(raw, &evidence) != nil || evidence.OperationID != o.ID || evidence.Reservation.UID != 61000 || evidence.Cleaned != (phase == "probe_verified") || evidence.EDQUOT != (phase == "probe_cleanup" || phase == "probe_verified") {
				t.Fatal(string(raw))
			}
			if ev.Directory != ".open-habitat-probe-"+o.ID {
				t.Fatal(ev)
			}
			if err = l.Close(); err != nil {
				t.Fatal(err)
			}
			l, err = openOperationLock(context.Background(), path, owner, time.Now)
			if err != nil {
				t.Fatal(err)
			}
			defer l.Close()
			if _, err = l.Begin("prepare", strings.Repeat("c", 64), o.Target); !errors.Is(err, ErrRecovery) {
				t.Fatal("crash lost fence", err)
			}
		})
	}
}

func TestPrepareProbeCancellationCleanup(t *testing.T) {
	path, owner := operationFixture(t)
	l, err := openOperationLock(context.Background(), path, owner, time.Now)
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	o, err := l.Begin("prepare", strings.Repeat("a", 64), Release{"0.1.0", strings.Repeat("b", 64)})
	if err != nil {
		t.Fatal(err)
	}
	fd, err := unix.Open(filepath.Dir(path), unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer unix.Close(fd)
	restored := false
	ops := quotaProbeOps{
		reserve: func(context.Context, int) (storagequota.ProbeRecord, error) {
			return storagequota.ProbeRecord{UID: 61000}, nil
		},
		write:   func(context.Context, int, *os.File, storagequota.ProbeRecord, string) error { return context.Canceled },
		restore: func(int, storagequota.ProbeRecord) error { restored = true; return nil },
	}
	o, ev, err := prepareQuotaProbe(context.Background(), l, o, fd, "", ops)
	if !errors.Is(err, context.Canceled) || !restored || ev.EDQUOT || !ev.Cleaned {
		t.Fatal(o, ev, err)
	}
	if _, err = os.Lstat(filepath.Join(filepath.Dir(path), ev.Directory)); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("residue", err)
	}
	// Cleanup is not whole-prepare completion and must not release the fence.
	if _, err = l.Begin("prepare", strings.Repeat("c", 64), o.Target); !errors.Is(err, ErrRecovery) {
		t.Fatal(err)
	}
}

// This test is opt-in and must run ONLY inside a disposable VM with its own
// separately mounted ext4 /home. It intentionally mutates that filesystem.
func TestPrepareProbeNativeVM(t *testing.T) {
	if os.Getenv("HOST_PREPARE_PROBE_VM") != "1" {
		t.Skip("disposable ext4 VM only")
	}
	if os.Geteuid() != 0 {
		t.Fatal("root required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	s := Site{Storage: Storage{HomeUUID: os.Getenv("HOST_PREPARE_HOME_UUID")}}
	src := productionSources()
	status, reason, ev := observeStorage(s, src)
	if status != "pass" || ev.format.Status != "pass" || ev.enforcement.Status != "pass" {
		t.Fatal(status, reason, ev)
	}
	if err := os.MkdirAll("/var/lib/open-habitat", 0700); err != nil {
		t.Fatal(err)
	}
	l, err := OpenOperationLock(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	o, err := l.Begin("prepare", strings.Repeat("a", 64), Release{"0.1.0", strings.Repeat("b", 64)})
	if err != nil {
		t.Fatal(err)
	}
	fd, err := unix.Open("/home", unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer unix.Close(fd)
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	o, evidence, err := prepareQuotaProbe(ctx, l, o, fd, exe, nativeQuotaProbeOps())
	if err != nil || !evidence.EDQUOT || !evidence.Cleaned {
		t.Fatal(o, evidence, err)
	}
	t.Logf("actual EDQUOT with UID %d; mount %d; cleanup verified; operation intentionally remains fenced", evidence.Reservation.UID, evidence.Reservation.MountID)
	if _, err = l.Begin("prepare", strings.Repeat("c", 64), o.Target); !errors.Is(err, ErrRecovery) {
		t.Fatal("incomplete preparation unfenced", err)
	}
	marker, err := json.Marshal(map[string]any{"evidence": evidence, "fenced": true})
	if err != nil {
		t.Fatal(err)
	}
	fmt.Printf("PROBE_RESULT=%s\n", marker)
}

func TestPrepareProbeJournalFailureRetainsIdentity(t *testing.T) {
	path, owner := operationFixture(t)
	l, err := openOperationLock(context.Background(), path, owner, time.Now)
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	o, err := l.Begin("prepare", strings.Repeat("a", 64), Release{"0.1.0", strings.Repeat("b", 64)})
	if err != nil {
		t.Fatal(err)
	}
	fd, err := unix.Open(filepath.Dir(path), unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer unix.Close(fd)
	wrote := false
	ops := quotaProbeOps{
		reserve: func(context.Context, int) (storagequota.ProbeRecord, error) {
			return storagequota.ProbeRecord{UID: 61000}, nil
		},
		write:   func(context.Context, int, *os.File, storagequota.ProbeRecord, string) error { wrote = true; return nil },
		restore: func(int, storagequota.ProbeRecord) error { t.Fatal("unexpected restore before arming"); return nil },
		crash: func(phase string) error {
			if phase == "probe_reserved" {
				return os.WriteFile(filepath.Join(path, "active.json.next"), []byte("interrupted"), 0600)
			}
			return nil
		},
	}
	got, _, err := prepareQuotaProbe(context.Background(), l, o, fd, "", ops)
	if !errors.Is(err, ErrRecovery) || got.ID != o.ID || got.Phase != "probe_reserved" || wrote {
		t.Fatal(got, err, wrote)
	}
}
