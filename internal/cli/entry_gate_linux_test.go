//go:build linux

package cli

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestEntryFenceFailsClosedAndReopens(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "maintenance")
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) })
	h := entryGateWithOwner(path, uint32(os.Geteuid()), next)
	check := func(want int) {
		t.Helper()
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", "https://example.invalid/", nil))
		if w.Code != want {
			t.Fatal(w.Code, want)
		}
	}
	check(204)
	if e := os.WriteFile(path, []byte("closed\n"), 0600); e != nil {
		t.Fatal(e)
	}
	check(503)
	if e := os.Remove(path); e != nil {
		t.Fatal(e)
	}
	check(204)
	if e := os.Symlink("missing", path); e != nil {
		t.Fatal(e)
	}
	check(503)
	if e := os.Remove(path); e != nil {
		t.Fatal(e)
	}
	if e := os.Chmod(dir, 0777); e != nil {
		t.Fatal(e)
	}
	check(503)
	if e := os.Chmod(dir, 0700); e != nil {
		t.Fatal(e)
	}
	alias := dir + "-alias"
	if e := os.Symlink(dir, alias); e != nil {
		t.Fatal(e)
	}
	defer os.Remove(alias)
	h = entryGateWithOwner(filepath.Join(alias, "maintenance"), uint32(os.Geteuid()), next)
	check(503)
}
