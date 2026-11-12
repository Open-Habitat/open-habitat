//go:build linux

package integrations

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

// A fake rclone whose steady bisync pass is driven by $HOME/mode: hold
// reports stats and waits for $HOME/release, delete hits the --max-delete
// safeguard, ok commits the listings at once.
func passRclone(t *testing.T) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "rclone")
	script := `#!/bin/sh
set -u
[ "$1" = --config ]; shift 2
command=$1; shift
case "$command" in
about) echo '{"used":1,"total":10000}';;
bisync)
 work=''
 while [ "$#" -gt 0 ]; do
  case "$1" in --workdir) work=$2; shift;; --resync|--force) exit 91;; esac
  shift
 done
 [ -f "$work/pair.path1.lst" ] || exit 2
 case "$(cat "$HOME/mode")" in
 hold)
  echo '{"level":"notice","msg":"Transferred: 300 B / 1000 B","stats":{"bytes":300,"totalBytes":1000,"transfers":3,"totalTransfers":10}}' >&2
  while [ ! -f "$HOME/release" ]; do sleep 0.02; done
  rm "$HOME/release";;
 delete)
  echo '{"level":"error","msg":"Safety abort: too many deletes (>50%, 60 of 100) on Path1 \"/home/p/cloud/dropbox\". Run with --force if desired."}' >&2
  echo '{"level":"error","msg":"Bisync aborted. Error is retryable without --resync due to --resilient mode."}' >&2
  exit 1;;
 esac
 touch "$work/pair.path1.lst" "$work/pair.path2.lst";;
*) exit 90;;
esac
`
	if err := os.WriteFile(path, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	return path
}

// The card's sync truth comes from the passes themselves: the last
// successful time from rclone's committed listings (not the status check),
// the current pass's counters while it runs, and a fixed reason when a pass
// fails, kept until a pass succeeds again even though the loop restarts.
func TestSteadySyncPassesReachTheCard(t *testing.T) {
	interval := syncInterval
	syncInterval = 20 * time.Millisecond
	t.Cleanup(func() { syncInterval = interval })
	home := newHome(t)
	env := Env{Home: home, FixtureTools: true, Config: Config{Tools: map[string]string{"rclone": passRclone(t)}, Dropbox: &DropboxApp{ClientID: "app-key", ClientSecret: "app-secret"}}}
	address := "p@example.test"
	work := filepath.Join(home, dropboxWork(address))
	if err := os.MkdirAll(work, 0700); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(filepath.Join(home, dropboxDir, address+".conf"), []byte("[dropbox]\ntype = dropbox\n"), 0600)
	earlier := time.Date(2026, 10, 23, 4, 20, 0, 0, time.UTC)
	for _, side := range []string{"1", "2"} {
		p := filepath.Join(work, "pair.path"+side+".lst")
		os.WriteFile(p, nil, 0600)
		os.Chtimes(p, earlier, earlier.Add(time.Duration(side[0]-'1')*time.Minute))
	}
	setMode := func(mode string) {
		if err := os.WriteFile(filepath.Join(home, "mode"), []byte(mode), 0600); err != nil {
			t.Fatal(err)
		}
	}
	setMode("hold")
	c := New(env, []Entry{&dropbox{}}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }), WithSyncBackoff(20*time.Millisecond, 80*time.Millisecond))
	t.Cleanup(c.sync.stopAll)
	c.write.Lock()
	c.reconcile()
	c.write.Unlock()
	cmd, _ := (&dropbox{}).SyncCommand(env, address)
	assertBisyncSafety(t, cmd)
	h := c.Handler(allow)
	service := func() map[string]any {
		_, out, _ := call(t, h, "GET", ListPath, "", nil)
		return out["accounts"].([]any)[0].(map[string]any)["services"].([]any)[0].(map[string]any)
	}
	waitFor := func(what string, ok func(map[string]any) bool) map[string]any {
		t.Helper()
		deadline := time.Now().Add(5 * time.Second)
		for {
			s := service()
			if ok(s) {
				return s
			}
			if time.Now().After(deadline) {
				t.Fatalf("%s: %v", what, s)
			}
			time.Sleep(20 * time.Millisecond)
		}
	}

	s := waitFor("running pass", func(s map[string]any) bool {
		p, _ := s["progress"].(map[string]any)
		return p != nil && p["phase"] == "transferring"
	})
	p := s["progress"].(map[string]any)
	if s["state"] != string(StateOK) || p["service"] != "dropbox" || p["phase"] != "transferring" || p["files"] != 3.0 || p["total_files"] != 10.0 || p["bytes"] != 300.0 {
		t.Fatalf("pass progress: %v", s)
	}
	// The older of the two committed listings, not the time of this check.
	if s["last_synced_at"] != earlier.Format(time.RFC3339) {
		t.Fatalf("last synced: %v", s["last_synced_at"])
	}

	setMode("delete")
	os.WriteFile(filepath.Join(home, "release"), nil, 0600)
	s = waitFor("failed pass", func(s map[string]any) bool { return s["failure"] != nil })
	if s["state"] != string(StateSyncRestarting) || s["failure"] != DeleteLimit {
		t.Fatalf("failed pass: %v", s)
	}
	synced, err := time.Parse(time.RFC3339, s["last_synced_at"].(string))
	if err != nil || !synced.After(earlier) {
		t.Fatalf("successful pass before the failure not recorded: %v", s["last_synced_at"])
	}
	// The supervisor keeps restarting the loop; every retry fails the same
	// way and the reason must not flicker away between them.
	for range 10 {
		if s := service(); s["failure"] != DeleteLimit {
			t.Fatalf("reason lost between retries: %v", s)
		}
		time.Sleep(15 * time.Millisecond)
	}

	setMode("ok")
	waitFor("recovered pass", func(s map[string]any) bool { return s["failure"] == nil && s["state"] == string(StateOK) })
}

func TestPassOutputClassifiesOnlyItsOwnPass(t *testing.T) {
	feed := func(o *passObserver, lines ...string) *passOutput {
		w := o.output()
		w.Write([]byte(strings.Join(lines, "\n") + "\n"))
		return w
	}
	start, end := `{"open_habitat_pass":0}`, func(code string) string { return `{"open_habitat_pass":0,"exit":` + code + `}` }
	deletes := `{"level":"error","msg":"Safety abort: too many deletes (>50%, 60 of 100)"}`
	network := `{"level":"error","msg":"Get \"https://api.dropboxapi.com\": dial tcp: lookup api.dropboxapi.com: no such host"}`
	for _, tc := range []struct {
		name  string
		lines []string
		want  string
	}{
		{"safeguard outranks a later generic error", []string{start, deletes, network, end("1")}, DeleteLimit},
		{"network", []string{start, network, end("1")}, RemoteUnreachable},
		{"exit 2 is rclone's usage error, not a resync claim", []string{start, `{"level":"error","msg":"something else"}`, end("2")}, PassFailed},
		{"all files changed", []string{start, `{"level":"error","msg":"Safety abort: all files were changed on Path1 \"/home/p/cloud/dropbox/\". Run with --force if desired."}`, end("1")}, AllChanged},
		{"resync claim", []string{start, `{"level":"error","msg":"Bisync aborted. Must run --resync to recover."}`, end("7")}, NeedsResync},
		{"unclassified", []string{start, end("7")}, PassFailed},
		{"error outside a pass is not this pass's", []string{deletes, start, end("1")}, PassFailed},
		{"success", []string{start, deletes, end("0")}, ""},
		{"oversized line is dropped", []string{start, `{"level":"error","msg":"too many deletes` + strings.Repeat("x", 20000) + `"}`, end("1")}, PassFailed},
		{"marker for an unknown pass is ignored", []string{start, `{"open_habitat_pass":5,"exit":0}`, end("1")}, PassFailed},
	} {
		t.Run(tc.name, func(t *testing.T) {
			o := newPassObserver([]string{"w"})
			feed(o, tc.lines...)
			if got := o.snapshot()["w"]; got.Failure != tc.want || got.Running {
				t.Fatalf("got %+v, want %q", got, tc.want)
			}
		})
	}

	// A pass that dies without its end marker failed, unless the daemon
	// stopped it; and a failure survives the loop's restart until a pass succeeds.
	o := newPassObserver([]string{"w"})
	feed(o, start).exited(true)
	if got := o.snapshot()["w"]; got.Running || got.Failure != "" {
		t.Fatalf("stopped pass: %+v", got)
	}
	feed(o, start).exited(false)
	if got := o.snapshot()["w"]; got.Failure != PassFailed {
		t.Fatalf("killed pass: %+v", got)
	}
	feed(o, start)
	if got := o.snapshot()["w"]; !got.Running || got.Failure != PassFailed {
		t.Fatalf("retry hid the failure: %+v", got)
	}

	// Only a pass that ended in the all-files-changed abort is resumed with
	// --force, and only until it ends some other way.
	o = newPassObserver([]string{"w0", "w1", "w2"})
	changed := `{"level":"error","msg":"Safety abort: all files were changed on Path2 \"remote:\". Run with --force if desired."}`
	pass := func(i, code string, lines ...string) []string {
		return append(append([]string{`{"open_habitat_pass":` + i + `}`}, lines...), `{"open_habitat_pass":`+i+`,"exit":`+code+`}`)
	}
	feed(o, slices.Concat(pass("0", "1", changed), pass("1", "1", deletes), pass("2", "1", changed))...)
	if got := o.forced(); got != "0 2" {
		t.Fatalf("forced %q", got)
	}
	feed(o, slices.Concat(pass("0", "0"), pass("1", "1", deletes), pass("2", "1", network))...)
	if got := o.forced(); got != "" {
		t.Fatalf("forced again %q", got)
	}
}

// A critical bisync abort sets the committed listings aside as "-err". That
// is not an unfinished first sync: offering the initial choice again would
// resync and could bring back files deleted meanwhile.
func TestCriticalAbortIsNotAnUnfinishedFirstSync(t *testing.T) {
	env := dropboxEnv(t)
	address := "p@example.test"
	work := filepath.Join(env.Home, dropboxWork(address))
	if err := os.MkdirAll(work, 0700); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(filepath.Join(env.Home, dropboxDir, address+".conf"), []byte("[dropbox]\ntype = dropbox\n"), 0600)
	for _, side := range []string{"1", "2"} {
		os.WriteFile(filepath.Join(work, "pair.path"+side+".lst-err"), nil, 0600)
	}
	c := New(env, []Entry{&dropbox{}}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }))
	_, out, _ := call(t, c.Handler(allow), "GET", ListPath, "", nil)
	s := out["accounts"].([]any)[0].(map[string]any)["services"].([]any)[0].(map[string]any)
	if s["state"] != string(StateSyncFailed) || s["failure"] != NeedsResync {
		t.Fatalf("critical abort: %v", s)
	}
}
