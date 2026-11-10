//go:build linux

package provision

import (
	"context"
	"encoding/json"
	"os"
	"os/user"
	"path/filepath"
	"testing"

	"github.com/open-habitat/open-habitat/internal/livelimits"
)

func liveWriter(t *testing.T) Writer {
	t.Helper()
	w, _ := writerFixture(t)
	put(t, w.Dir, "bindings.json", `{"version":1,"generation":7,"bindings":[{"id":"42","uid":2100,"username":"carol"},{"id":"43","uid":2101,"username":"dave"}]}`)
	account, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	// Ancestors must be writable by nobody else, as on a real host.
	base, err := os.MkdirTemp(account.HomeDir, "live-limits-test-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(base) })
	if err = os.Mkdir(filepath.Join(base, "opt"), 0755); err != nil {
		t.Fatal(err)
	}
	os.Chmod(base, 0755)
	os.Chmod(filepath.Join(base, "opt"), 0755)
	w.LiveLimitsFile = filepath.Join(base, "opt", "live-limits.json")
	return w
}

func live(w Writer, op, id string, limit *int) Reply {
	return w.Handle(context.Background(), Request{Version: 1, Operation: op, Provider: "github", ID: id, LiveLimit: limit})
}

func n(v int) *int { return &v }

func TestLiveLimitsWriteRootFileForTheBoundUID(t *testing.T) {
	w := liveWriter(t)
	r := live(w, OpLiveLimitList, "0", nil)
	if r.Failure != "" || r.LiveLimits == nil || r.LiveLimits.Default != 0 || len(r.LiveLimits.People) != 0 {
		t.Fatalf("empty list: %+v", r)
	}
	if _, err := os.Stat(w.LiveLimitsFile); !os.IsNotExist(err) {
		t.Fatal("a list must not create the file")
	}
	if r = live(w, OpLiveLimitSet, "0", n(12)); r.Failure != "" || r.LiveLimits.Default != 12 {
		t.Fatalf("default: %+v", r)
	}
	if r = live(w, OpLiveLimitSet, "43", n(40)); r.Failure != "" || len(r.LiveLimits.People) != 1 || r.LiveLimits.People[0] != (LiveLimitPerson{"43", 40}) {
		t.Fatalf("exception: %+v", r)
	}
	b, err := os.ReadFile(w.LiveLimitsFile)
	if err != nil || string(b) != `{"version":1,"default":12,"people":{"2101":40}}`+"\n" {
		t.Fatalf("file %q %v", b, err)
	}
	st, _ := os.Stat(w.LiveLimitsFile)
	if st.Mode().Perm() != 0644 {
		t.Fatalf("mode %v", st.Mode())
	}
	f, _ := livelimits.Parse(b)
	if got, source := f.For(2101); got != 40 || source != livelimits.SourceOwn {
		t.Fatal(got, source)
	}
	if got, source := f.For(2100); got != 12 || source != livelimits.SourceInstallation {
		t.Fatal(got, source)
	}
	// A subject without a committed binding names no UID.
	if r = live(w, OpLiveLimitSet, "99", n(5)); r.Failure != Denied {
		t.Fatalf("unbound: %+v", r)
	}
	if r = live(w, OpLiveLimitClear, "43", nil); r.Failure != "" || len(r.LiveLimits.People) != 0 {
		t.Fatalf("clear: %+v", r)
	}
	if r = live(w, OpLiveLimitClear, "0", nil); r.Failure != "" || r.LiveLimits.Default != 0 {
		t.Fatalf("clear default: %+v", r)
	}
	if b, _ = os.ReadFile(w.LiveLimitsFile); string(b) != `{"version":1}`+"\n" {
		t.Fatalf("cleared file %q", b)
	}
}

func TestLiveLimitsDropUnboundUIDsAndRefuseABrokenFile(t *testing.T) {
	w := liveWriter(t)
	if err := os.WriteFile(w.LiveLimitsFile, []byte(`{"version":1,"people":{"2100":3,"3000":9}}`), 0644); err != nil {
		t.Fatal(err)
	}
	os.Chmod(w.LiveLimitsFile, 0644)
	r := live(w, OpLiveLimitList, "0", nil)
	if r.Failure != "" || len(r.LiveLimits.People) != 1 || r.LiveLimits.People[0].ID != "42" {
		t.Fatalf("list: %+v", r)
	}
	if r = live(w, OpLiveLimitSet, "0", n(8)); r.Failure != "" {
		t.Fatal(r)
	}
	if b, _ := os.ReadFile(w.LiveLimitsFile); string(b) != `{"version":1,"default":8,"people":{"2100":3}}`+"\n" {
		t.Fatalf("file %q", b)
	}
	// Only root writes the file: one others may write is never trusted.
	os.Chmod(w.LiveLimitsFile, 0666)
	if r = live(w, OpLiveLimitList, "0", nil); r.Failure != StateUnavailable {
		t.Fatalf("writable: %+v", r)
	}
	os.Chmod(w.LiveLimitsFile, 0644)
	os.WriteFile(w.LiveLimitsFile, []byte(`{"version":1,"default":500}`), 0644)
	if r = live(w, OpLiveLimitSet, "0", n(8)); r.Failure != StateUnavailable {
		t.Fatalf("broken file must not be replaced: %+v", r)
	}
}

func TestLiveLimitWireIsStrict(t *testing.T) {
	for _, raw := range []string{
		`{"version":1,"operation":"live_limit_set","provider":"github","id":"0","live_limit":0}`,
		`{"version":1,"operation":"live_limit_set","provider":"github","id":"0","live_limit":129}`,
		`{"version":1,"operation":"live_limit_set","provider":"github","id":"0"}`,
		`{"version":1,"operation":"live_limit_list","provider":"github","id":"42"}`,
		`{"version":1,"operation":"live_limit_clear","provider":"github","id":"42","live_limit":3}`,
		`{"version":1,"operation":"live_limit_set","provider":"github","id":"42","live_limit":3,"actor":"x"}`,
		`{"version":1,"operation":"live_limit_set","provider":"github","id":"042","live_limit":3}`,
		`{"version":1,"operation":"quota_read","provider":"github","id":"42","live_limit":3}`,
	} {
		if _, err := ParseRequest([]byte(raw)); err == nil {
			t.Errorf("accepted %s", raw)
		}
	}
	if _, err := ParseRequest([]byte(`{"version":1,"operation":"live_limit_set","provider":"github","id":"42","live_limit":128}`)); err != nil {
		t.Fatal(err)
	}
	for _, raw := range []string{
		`{"version":1,"live_limits":{"default":0,"people":[{"id":"42","limit":200}]}}`,
		`{"version":1,"live_limits":{"people":[]}}`,
		`{"version":1,"live_limits":{"default":0,"people":[{"id":"42","limit":2},{"id":"42","limit":3}]}}`,
		`{"version":1,"live_limits":{"default":0,"people":[]},"generation":1}`,
		`{"version":1,"failure":"denied","live_limits":{"default":0,"people":[]}}`,
	} {
		if _, err := ParseReply([]byte(raw)); err == nil {
			t.Errorf("accepted %s", raw)
		}
	}
	good := Reply{Version: 1, LiveLimits: &LiveLimitPage{Default: 12, People: []LiveLimitPerson{{"42", 40}}}}
	b, err := EncodeReply(good)
	if err != nil {
		t.Fatal(err)
	}
	var back map[string]any
	if json.Unmarshal(b, &back) != nil || back["live_limits"] == nil {
		t.Fatal(string(b))
	}
}
