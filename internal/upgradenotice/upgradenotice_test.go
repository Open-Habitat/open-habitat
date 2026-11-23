//go:build linux

package upgradenotice

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func sample(now time.Time) Record {
	return Record{SchemaVersion: 1, ScheduleID: strings.Repeat("a", 32), Revision: 1, TargetVersion: "0.9.0", AnnouncedAt: now, Deadline: now.Add(DefaultLead), State: Announced, RenewedAt: now}
}

func TestStatusNeverReadsALostOwnerAsRestartNow(t *testing.T) {
	now := time.Date(2026, 11, 23, 12, 0, 0, 0, time.UTC)
	r := sample(now)
	cases := []struct {
		at      time.Time
		renewed time.Time
		state   string
		want    string
	}{
		{now.Add(time.Minute), now.Add(55 * time.Second), Announced, StatusCountdown},
		{now.Add(3 * time.Minute), now.Add(170 * time.Second), Announced, StatusStarting},
		// The owner died before the deadline: unknown, then nothing.
		{now.Add(time.Minute), now, Announced, StatusUnknown},
		{now.Add(5 * time.Minute), now, Announced, StatusUnknown},
		{now.Add(20 * time.Minute), now, Announced, ""},
		{now.Add(time.Minute), now.Add(time.Minute), Withdrawn, StatusWithdrawn},
		{now.Add(20 * time.Minute), now, Withdrawn, ""},
	}
	for i, c := range cases {
		r.RenewedAt, r.State = c.renewed, c.state
		if got := r.Status(c.at); got != c.want {
			t.Errorf("%d: %q, want %q", i, got, c.want)
		}
	}
}

func TestParseRefusesAnythingButTheRecord(t *testing.T) {
	now := time.Date(2026, 11, 23, 12, 0, 0, 0, time.UTC)
	b, err := Encode(sample(now))
	if err != nil {
		t.Fatal(err)
	}
	if r, err := Parse(b); err != nil || r.Key() != strings.Repeat("a", 32)+":1" {
		t.Fatal(r, err)
	}
	bad := []string{
		strings.Replace(string(b), `"state":"announced"`, `"state":"now"`, 1),
		strings.Replace(string(b), `"schema_version":1`, `"schema_version":2`, 1),
		strings.Replace(string(b), `"revision":1`, `"revision":1,"account":"x"`, 1),
		strings.Replace(string(b), `"target_version":"0.9.0"`, `"target_version":"../x"`, 1),
		string(b) + "{}",
	}
	long := sample(now)
	long.Deadline = now.Add(2 * time.Hour)
	if _, err := Encode(long); err == nil {
		t.Fatal("a lead beyond the maximum encoded")
	}
	for i, s := range bad {
		if _, err := Parse([]byte(s)); err == nil {
			t.Errorf("%d accepted", i)
		}
	}
}

func TestReadTrustsOnlyAnOwnerOnlyWritableRecord(t *testing.T) {
	base := t.TempDir()
	dir := filepath.Join(base, "opt")
	if err := os.Mkdir(dir, 0755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "upgrade-notice.json")
	owner := uint32(os.Getuid())
	if _, err := read(path, owner, base); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("missing record", err)
	}
	b, _ := Encode(sample(time.Now()))
	if err := os.WriteFile(path, b, 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := read(path, owner, base); err != nil {
		t.Fatal(err)
	}
	if _, err := read(path, owner+1, base); !errors.Is(err, ErrUntrusted) {
		t.Fatal("a record of another owner was trusted", err)
	}
	if err := os.Chmod(path, 0666); err != nil {
		t.Fatal(err)
	}
	if _, err := read(path, owner, base); !errors.Is(err, ErrUntrusted) {
		t.Fatal("a world-writable record was trusted", err)
	}
	if err := os.Chmod(path, 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(dir, 0777); err != nil {
		t.Fatal(err)
	}
	if _, err := read(path, owner, base); !errors.Is(err, ErrUntrusted) {
		t.Fatal("a record in a writable directory was trusted", err)
	}
	if err := os.Chmod(dir, 0755); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(dir, "link.json")
	if err := os.Symlink(path, link); err != nil {
		t.Fatal(err)
	}
	if _, err := read(link, owner, base); !errors.Is(err, ErrUntrusted) {
		t.Fatal("a symlink was followed", err)
	}
	if err := os.Link(path, filepath.Join(dir, "second")); err != nil {
		t.Fatal(err)
	}
	if _, err := read(path, owner, base); !errors.Is(err, ErrUntrusted) {
		t.Fatal("a hard-linked record was trusted", err)
	}
}
