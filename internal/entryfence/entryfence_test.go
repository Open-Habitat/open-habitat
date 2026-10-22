package entryfence

import (
	"os"
	"path/filepath"
	"testing"
)

func TestUnpublishedDenialAndAmbiguousObjects(t *testing.T) {
	path := filepath.Join(t.TempDir(), "closed")
	if Closed(path) {
		t.Fatal("absent fence denied")
	}
	if e := os.WriteFile(path+".next", nil, 0600); e != nil {
		t.Fatal(e)
	}
	if !Closed(path) {
		t.Fatal("unpublished closure admitted mutation")
	}
	if e := os.Remove(path + ".next"); e != nil {
		t.Fatal(e)
	}
	if e := os.Symlink("missing", path+".next"); e != nil {
		t.Fatal(e)
	}
	if !Closed(path) {
		t.Fatal("ambiguous publication admitted mutation")
	}
}

func TestContinuousDenialAcrossPublicationRename(t *testing.T) {
	path := filepath.Join(t.TempDir(), "closed")
	if e := os.WriteFile(path+".next", []byte("closed\n"), 0600); e != nil {
		t.Fatal(e)
	}
	moved := false
	probe := func(name string) error {
		_, e := os.Lstat(name)
		if !moved {
			moved = true
			// The returned observation precedes this real rename. Final-first
			// probing misses both names; stage-first probing observes the denial.
			if err := os.Rename(path+".next", path); err != nil {
				t.Fatal(err)
			}
		}
		return e
	}
	if !closed(path, probe) {
		t.Fatal("continuous denial disappeared across atomic publication")
	}
}
