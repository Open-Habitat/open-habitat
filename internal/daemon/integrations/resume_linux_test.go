//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync/atomic"
	"syscall"
	"testing"
	"time"
)

// interruptedDropbox leaves what a daemon stop leaves behind a chosen first
// Dropbox pass: a native login, the new listings and the pass's lock.
func interruptedDropbox(t *testing.T, env Env, address, lock string) string {
	t.Helper()
	work := filepath.Join(env.Home, dropboxWork(address))
	if err := os.MkdirAll(work, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(env.Home, dropboxDir, address+".conf"), []byte("[dropbox]\ntype = dropbox\n"), 0600); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"pair.path1.lst-new", "pair.path2.lst-new"} {
		os.WriteFile(filepath.Join(work, name), []byte("partial\n"), 0600)
	}
	if lock != "" {
		os.WriteFile(filepath.Join(work, "pair.lck"), []byte(lock), 0600)
	}
	return work
}

func lockJSON(work string, pid int) string {
	return fmt.Sprintf(`{"Session":%q,"PID":"%d","TimeRenewed":"2026-10-23T04:27:48Z","TimeExpires":"2099-01-01T00:00:00Z"}`, filepath.Join(work, "pair"), pid)
}

// deadPID is a PID that no process holds now.
func deadPID(t *testing.T) int {
	t.Helper()
	cmd := exec.Command("/bin/true")
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}
	return cmd.Process.Pid
}

func dropboxService(t *testing.T, c *Catalog) map[string]any {
	t.Helper()
	code, out, _ := call(t, c.Handler(allow), "GET", ListPath, "", nil)
	if code != 200 {
		t.Fatalf("list: %d %v", code, out)
	}
	return out["accounts"].([]any)[0].(map[string]any)["services"].([]any)[0].(map[string]any)
}

func waitFor(t *testing.T, what string, ok func() bool) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for !ok() {
		if time.Now().After(deadline) {
			t.Fatal("timed out waiting for", what)
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func exists(path string) bool {
	_, err := os.Lstat(path)
	return err == nil
}

func TestInterruptedResyncEvidence(t *testing.T) {
	env := Env{Home: newHome(t)}
	for _, tc := range []struct {
		name  string
		files []string
		want  bool
	}{
		{"stopped pass", []string{"s.path1.lst-new", "s.path2.lst-new", "s.lck"}, true},
		{"stopped while listing", []string{"s.path1.lst-new", "s.lck"}, true},
		{"stopped at once", []string{"s.lck"}, true},
		{"never started", nil, false},
		{"committed pair", []string{"s.path1.lst", "s.path2.lst", "s.path1.lst-new", "s.lck"}, false},
		// A pass that finished once, or failed critically, keeps sync history
		// a union would override. Only the person may resync it.
		{"previous listings", []string{"s.path1.lst-old", "s.path2.lst-old", "s.path1.lst-new", "s.lck"}, false},
		{"critical error", []string{"s.path1.lst-err", "s.path2.lst-err", "s.lck"}, false},
		{"two sessions", []string{"s.path1.lst-new", "t.path2.lst-new"}, false},
		{"unknown file", []string{"s.path1.lst-new", "s.lck", "notes.txt"}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			work := ".config/test-work/" + strings.ReplaceAll(tc.name, " ", "-")
			os.MkdirAll(filepath.Join(env.Home, work), 0700)
			for _, f := range tc.files {
				os.WriteFile(filepath.Join(env.Home, work, f), nil, 0600)
			}
			if got := interruptedResync(env, work); got != tc.want {
				t.Fatalf("interruptedResync = %v, want %v", got, tc.want)
			}
		})
	}
}

// A daemon restart during the person's chosen first pass resumes that pass
// with the same direction once the daemon starts, and steady sync follows.
func TestDaemonStartResumesInterruptedFirstPass(t *testing.T) {
	env := dropboxEnv(t)
	address := "p@example.test"
	os.MkdirAll(filepath.Join(env.Home, dropboxDir), 0700)
	work := interruptedDropbox(t, env, address, lockJSON(filepath.Join(env.Home, dropboxWork(address)), deadPID(t)))
	os.WriteFile(filepath.Join(env.Home, "hold-resync"), nil, 0600)
	c := New(env, []Entry{&dropbox{}}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }), WithSyncBackoff(20*time.Millisecond, 80*time.Millisecond), WithResumeTiming(20*time.Millisecond, 20*time.Millisecond, 80*time.Millisecond))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c.Start(ctx)
	defer c.sync.stopAll()

	waitFor(t, "resumed pass", func() bool { return exists(filepath.Join(env.Home, "resyncs")) })
	// The fake, like rclone, refuses a pair whose lock remains: the stale
	// lock of the killed pass was cleared first.
	if exists(filepath.Join(work, "pair.lck")) {
		t.Fatal("stale lock kept")
	}
	if s := dropboxService(t, c); s["state"] != string(StateSyncing) || s["failure"] != nil {
		t.Fatalf("card does not show the resumed pass: %v", s)
	}
	// The same explicit choice: a cloud-preferred union with local backups.
	cmd, _ := dropboxBisync(env, address)
	data, _ := os.ReadFile(filepath.Join(env.Home, "resyncs"))
	if strings.TrimSpace(string(data)) != filepath.Join(env.Home, dropboxWork(address)) || len(cmd.Args) == 0 {
		t.Fatalf("resumed pass: %q", data)
	}
	os.Remove(filepath.Join(env.Home, "hold-resync"))
	waitFor(t, "steady sync", func() bool { return exists(filepath.Join(env.Home, "passes")) })
	if s := dropboxService(t, c); s["state"] != string(StateOK) {
		t.Fatalf("completed resume not healthy: %v", s)
	}
}

// The resumed command is the chosen one, not an ordinary pass with --resync.
func TestResumeRunsTheChosenCommand(t *testing.T) {
	env := dropboxEnv(t)
	log := filepath.Join(t.TempDir(), "args")
	tool := filepath.Join(t.TempDir(), "rclone")
	os.WriteFile(tool, []byte("#!/bin/sh\nprintf '%s\\n' \"$@\" > "+log+"\n"), 0700)
	env.Config.Tools["rclone"] = tool
	address := "p@example.test"
	os.MkdirAll(filepath.Join(env.Home, dropboxDir), 0700)
	interruptedDropbox(t, env, address, "")
	works := (&dropbox{}).interruptedPasses(env, address)
	if err := (&dropbox{}).resumeInitial(context.Background(), env, address, works); err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(log)
	args := "\n" + string(data)
	for _, want := range []string{"\n--resync\n--resync-mode\npath2\n", "\n--backup-dir1\n" + filepath.Join(env.Home, ".local/share/rclone/dropbox-backups", address) + "\n", "\n--max-delete\n50\n"} {
		if !strings.Contains(args, want) {
			t.Fatalf("resume lacks %q: %s", want, data)
		}
	}
	if strings.Contains(args, "\n--force\n") {
		t.Fatal("resume forced")
	}
}

// A lock whose holder still runs is never removed and its pair never
// resynced; the resume starts only after the holder has gone.
func TestResumeNeverRemovesALiveLock(t *testing.T) {
	for _, tc := range []string{"names the work directory", "is an rclone process"} {
		t.Run(tc, func(t *testing.T) {
			env := dropboxEnv(t)
			address := "p@example.test"
			os.MkdirAll(filepath.Join(env.Home, dropboxDir), 0700)
			abs := filepath.Join(env.Home, dropboxWork(address))
			var holder *exec.Cmd
			if tc == "names the work directory" {
				holder = exec.Command("/bin/sh", "-c", "sleep 600; :", "holder", "--workdir", abs)
			} else {
				// Started with a relative work directory: only its lock's PID
				// and its name tie it to the pair.
				holder = exec.Command("/bin/sh", "-c", "sleep 600; :")
				holder.Args[0] = "/opt/tools/rclone"
			}
			if err := holder.Start(); err != nil {
				t.Fatal(err)
			}
			defer holder.Process.Kill()
			lock := lockJSON(abs, holder.Process.Pid)
			work := interruptedDropbox(t, env, address, lock)
			c := New(env, []Entry{&dropbox{}}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }), WithSyncBackoff(20*time.Millisecond, 80*time.Millisecond), WithResumeTiming(20*time.Millisecond, 20*time.Millisecond, 80*time.Millisecond))
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			c.Start(ctx)
			defer c.sync.stopAll()

			time.Sleep(300 * time.Millisecond)
			if data, err := os.ReadFile(filepath.Join(work, "pair.lck")); err != nil || string(data) != lock {
				t.Fatal("live lock touched", err)
			}
			if exists(filepath.Join(env.Home, "resyncs")) {
				t.Fatal("pair resynced under a live lock")
			}
			if s := dropboxService(t, c); s["state"] != string(StateSyncing) {
				t.Fatalf("queued resume not shown: %v", s)
			}
			holder.Process.Kill()
			holder.Wait()
			waitFor(t, "resume after the holder exits", func() bool { return exists(filepath.Join(env.Home, "passes")) })
		})
	}
}

// A provider not reachable at daemon start (a boot before the network) is
// retried; a pass that then fails on its own is named as a failed resume.
func TestResumeRetriesUnreachableAndNamesItsFailure(t *testing.T) {
	env := dropboxEnv(t)
	address := "p@example.test"
	os.MkdirAll(filepath.Join(env.Home, dropboxDir), 0700)
	interruptedDropbox(t, env, address, "")
	status := filepath.Join(env.Home, "status-error")
	os.WriteFile(status, []byte(`{"level":"error","msg":"dial tcp: network unreachable"}`+"\n"), 0600)
	os.WriteFile(filepath.Join(env.Home, "resync-fail"), nil, 0600)
	c := New(env, []Entry{&dropbox{}}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }), WithResumeTiming(20*time.Millisecond, 50*time.Millisecond, 50*time.Millisecond))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c.Start(ctx)
	defer c.sync.stopAll()

	waitFor(t, "a retry", func() bool {
		data, _ := os.ReadFile(filepath.Join(env.Home, "resyncs"))
		return strings.Count(string(data), "\n") >= 2
	})
	if s := dropboxService(t, c); s["state"] != string(StateUnreachable) {
		t.Fatalf("unreachable provider: %v", s)
	}
	os.Remove(status)
	waitFor(t, "the named failure", func() bool {
		s := dropboxService(t, c)
		return s["state"] == string(StateSyncFailed) && s["failure"] == InitialSyncResumeFailed
	})
	if interruptedResync(env, dropboxWork(address)) {
		t.Fatal("a failed resume was left for the next daemon start")
	}
	data, _ := os.ReadFile(filepath.Join(env.Home, "resyncs"))
	time.Sleep(200 * time.Millisecond)
	if again, _ := os.ReadFile(filepath.Join(env.Home, "resyncs")); string(again) != string(data) {
		t.Fatal("a failed resume was repeated without the person")
	}
}

// Removing the account stops the resumed pass before the login and the work
// directory go, so nothing keeps writing into a removed account.
func TestRemovalStopsTheResumedPass(t *testing.T) {
	env := dropboxEnv(t)
	address := "p@example.test"
	os.MkdirAll(filepath.Join(env.Home, dropboxDir), 0700)
	work := interruptedDropbox(t, env, address, "")
	os.WriteFile(filepath.Join(env.Home, "hold-resync"), nil, 0600)
	c := New(env, []Entry{&dropbox{}}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }), WithResumeTiming(20*time.Millisecond, 20*time.Millisecond, 80*time.Millisecond))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c.Start(ctx)
	defer c.sync.stopAll()
	waitFor(t, "resumed pass", func() bool { return exists(filepath.Join(env.Home, "resyncs")) })

	code, out, _ := call(t, c.Handler(allow), "DELETE", AccountsPath, "", map[string]any{"action": "remove", "provider": "dropbox", "address": address, "delete_directories": false})
	if code != 200 {
		t.Fatalf("remove during resume: %d %v", code, out)
	}
	if exists(filepath.Join(env.Home, dropboxDir, address+".conf")) {
		t.Fatal("login kept")
	}
	// The killed fake would have written listings had it survived.
	os.Remove(filepath.Join(env.Home, "hold-resync"))
	time.Sleep(200 * time.Millisecond)
	if entries, _ := os.ReadDir(work); len(entries) != 0 {
		t.Fatal("pass outlived removal", entries)
	}
}

// With the pinned rclone: a first pass killed midway, as a release restart
// kills it, completes after the next daemon start, keeps local-only files
// and leaves rclone a committed pair for steady sync.
func TestResumeWithNativeRclone(t *testing.T) {
	rclone := os.Getenv("OH_TEST_RCLONE")
	if rclone == "" {
		t.Skip("set OH_TEST_RCLONE to the pinned rclone 1.71.2")
	}
	// A restart right after the kill finds an unexpired lock, which the
	// daemon removes; a later one finds it expired, and rclone takes it over.
	for _, expired := range []bool{false, true} {
		t.Run(fmt.Sprint("expired=", expired), func(t *testing.T) { resumeWithNativeRclone(t, rclone, expired) })
	}
}

func resumeWithNativeRclone(t *testing.T, rclone string, expired bool) {
	env := dropboxEnv(t)
	env.Config.Tools["rclone"] = rclone
	address := "p@example.test"
	remote := t.TempDir()
	for i := range 20 {
		data := []byte(strings.Repeat(fmt.Sprint(i), 100000))
		os.WriteFile(filepath.Join(remote, fmt.Sprintf("f%02d", i)), data, 0600)
	}
	os.MkdirAll(filepath.Join(env.Home, dropboxDir), 0700)
	// The remote named dropbox is a local directory: no network.
	os.WriteFile(filepath.Join(env.Home, dropboxDir, address+".conf"), []byte("[dropbox]\ntype = alias\nremote = "+remote+"\n"), 0600)
	local := filepath.Join(env.Home, "cloud/dropbox", address)
	os.MkdirAll(local, 0700)
	os.WriteFile(filepath.Join(local, "local-only"), []byte("kept"), 0600)
	work := filepath.Join(env.Home, dropboxWork(address))
	os.MkdirAll(work, 0700)

	cmd, _ := dropboxBisync(env, address)
	first := env.command(context.Background(), Command{Path: cmd.Path, Args: append(cmd.Args, "--resync", "--resync-mode", "path2", "--bwlimit", "200k", "--transfers", "1")})
	if err := first.Start(); err != nil {
		t.Fatal(err)
	}
	waitFor(t, "first pass copying", func() bool {
		entries, _ := os.ReadDir(local)
		return len(entries) > 2
	})
	syscall.Kill(-first.Process.Pid, syscall.SIGKILL)
	first.Wait()
	if !interruptedResync(env, dropboxWork(address)) {
		entries, _ := os.ReadDir(work)
		t.Fatal("killed pass did not leave the live state", entries)
	}
	if expired {
		locks, _ := filepath.Glob(filepath.Join(work, "*.lck"))
		if len(locks) != 1 {
			t.Fatal("killed pass left no lock", locks)
		}
		data, _ := os.ReadFile(locks[0])
		var lock map[string]any
		if err := json.Unmarshal(data, &lock); err != nil {
			t.Fatal(err)
		}
		lock["TimeExpires"] = time.Now().Add(-time.Hour).UTC().Format(time.RFC3339Nano)
		data, _ = json.Marshal(lock)
		os.WriteFile(locks[0], data, 0600)
	}

	c := New(env, []Entry{&dropbox{}}, nil, WithQuota(func() Room { return Room{Free: 1 << 30, OK: true} }), WithResumeTiming(20*time.Millisecond, 20*time.Millisecond, 80*time.Millisecond))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c.Start(ctx)
	defer c.sync.stopAll()
	waitFor(t, "resumed pass", func() bool {
		_, ready := (&dropbox{}).SyncCommand(env, address)
		return ready
	})
	for i := range 20 {
		name := fmt.Sprintf("f%02d", i)
		a, _ := os.ReadFile(filepath.Join(remote, name))
		b, _ := os.ReadFile(filepath.Join(local, name))
		if len(a) == 0 || string(a) != string(b) {
			t.Fatal("cloud file missing locally", name)
		}
	}
	if data, _ := os.ReadFile(filepath.Join(remote, "local-only")); string(data) != "kept" {
		t.Fatal("local-only file lost")
	}
	filepath.WalkDir(local, func(path string, d fs.DirEntry, _ error) error {
		if strings.HasSuffix(path, ".partial") {
			t.Error("partial transfer left", path)
		}
		return nil
	})
	waitFor(t, "healthy card", func() bool { return dropboxService(t, c)["state"] == string(StateOK) })
}

// Only the library whose chosen pass was stopped runs again; a library that
// already syncs is never resynced, and one never started waits for a choice.
func TestMicrosoftResumesOnlyTheInterruptedLibrary(t *testing.T) {
	env := microsoftEnv(t)
	m := &microsoft{}
	address := "person@example.test"
	sp := "sp-" + strings.Repeat("ab", 12)
	other := "sp-" + strings.Repeat("cd", 12)
	os.MkdirAll(filepath.Join(env.Home, microsoftDir), 0700)
	config := fmt.Sprintf("[onedrive]\ndescription = cloud/onedrive/%[1]s\n\n[%[2]s]\ndescription = cloud/sharepoint/t--%[1]s/site/docs\n\n[%[3]s]\ndescription = cloud/sharepoint/t--%[1]s/site/other\n", address, sp, other)
	os.WriteFile(filepath.Join(env.Home, microsoftDir, address+".conf"), []byte(config), 0600)
	for remote, files := range map[string][]string{"onedrive": {"s.path1.lst-new", "s.lck"}, sp: {"s.path1.lst", "s.path2.lst"}} {
		work := filepath.Join(env.Home, microsoftWork(address, remote))
		os.MkdirAll(work, 0700)
		for _, f := range files {
			os.WriteFile(filepath.Join(work, f), nil, 0600)
		}
	}
	works := m.interruptedPasses(env, address)
	if len(works) != 1 || works[0] != microsoftWork(address, "onedrive") {
		t.Fatal(works)
	}
	// The fake refuses a locked pair, as rclone does; the catalog clears a
	// stale lock before resuming.
	os.Remove(filepath.Join(env.Home, microsoftWork(address, "onedrive"), "s.lck"))
	if err := m.resumeInitial(context.Background(), env, address, works); err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(filepath.Join(env.Home, "resyncs"))
	if strings.TrimSpace(string(data)) != filepath.Join(env.Home, microsoftWork(address, "onedrive")) {
		t.Fatalf("resynced %q", data)
	}
}

func TestBisyncLockJudgement(t *testing.T) {
	env := Env{Home: newHome(t)}
	now := time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)
	holder := exec.Command("/bin/sh", "-c", "sleep 600; :")
	holder.Args[0] = "/opt/tools/rclone"
	if err := holder.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { holder.Process.Kill(); holder.Wait() }()
	dead := deadPID(t)
	for _, tc := range []struct {
		name string
		lock func(abs string) string
		want lockState
	}{
		{"none", nil, lockAbsent},
		// Nobody can take an unexpired lock over: removing it is safe.
		{"unexpired, dead holder", func(abs string) string { return lockAt(abs, dead, now.Add(time.Minute)) }, lockStale},
		// rclone takes an expired lock over itself; removing it could race that.
		{"expired, dead holder", func(abs string) string { return lockAt(abs, dead, now.Add(-time.Minute)) }, lockExpired},
		{"about to expire", func(abs string) string { return lockAt(abs, dead, now.Add(5*time.Second)) }, lockHeld},
		{"unreadable", func(string) string { return "{\"Sess" }, lockStale},
		{"live rclone", func(abs string) string { return lockAt(abs, holder.Process.Pid, now.Add(time.Minute)) }, lockHeld},
		{"another pair", func(abs string) string { return lockAt(abs+"-other", dead, now.Add(time.Minute)) }, lockForeign},
	} {
		t.Run(tc.name, func(t *testing.T) {
			work := ".config/test-lock/" + strings.ReplaceAll(tc.name, " ", "-")
			abs := filepath.Join(env.Home, work)
			os.MkdirAll(abs, 0700)
			if tc.lock != nil {
				os.WriteFile(filepath.Join(abs, "pair.lck"), []byte(tc.lock(abs)), 0600)
			}
			if _, _, got := bisyncLock(env, work, now); got != tc.want {
				t.Fatalf("bisyncLock = %v, want %v", got, tc.want)
			}
		})
	}
}

func lockAt(work string, pid int, expires time.Time) string {
	return fmt.Sprintf(`{"Session":%q,"PID":"%d","TimeRenewed":"2026-10-23T04:27:48Z","TimeExpires":%q}`, filepath.Join(work, "pair"), pid, expires.Format(time.RFC3339Nano))
}

// A first pass the person stopped, or one that failed on its own, is not
// resumed by the next daemon start: only a daemon stop leaves one to resume.
func TestStoppedFirstPassIsNotResumed(t *testing.T) {
	for _, how := range []string{"cancelled", "failed"} {
		t.Run(how, func(t *testing.T) {
			env := dropboxEnv(t)
			email := "p@example.test"
			var exchanges atomic.Int32
			d := syntheticDropbox(t, &email, &exchanges)
			c := New(env, []Entry{d}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }), WithResumeTiming(20*time.Millisecond, 20*time.Millisecond, 80*time.Millisecond))
			ctx, cancel := context.WithCancel(context.Background())
			c.Start(ctx)
			h := c.Handler(allow)
			call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "dropbox"})
			view := waitState(t, h, ownerA, "open_url")
			id := view["attempt_id"].(string)
			call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": dropboxPaste(t, view)})
			waitState(t, h, ownerA, "choose_folders")
			work := filepath.Join(env.Home, dropboxWork(email))
			// The pass has listed both sides when it stops, as a real one has.
			os.MkdirAll(work, 0700)
			for _, name := range []string{"pair.path1.lst-new", "pair.path2.lst-new"} {
				os.WriteFile(filepath.Join(work, name), nil, 0600)
			}
			if how == "cancelled" {
				os.WriteFile(filepath.Join(env.Home, "hold-resync"), nil, 0600)
			} else {
				os.WriteFile(filepath.Join(env.Home, "resync-fail"), nil, 0600)
			}
			call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"all"}})
			if how == "cancelled" {
				waitFor(t, "first pass", func() bool { return exists(filepath.Join(env.Home, "resyncs")) })
				call(t, h, "DELETE", LoginPath, ownerA, map[string]any{"action": "cancel", "attempt_id": id})
			}
			waitState(t, h, ownerA, "failed")
			c.relay.mu.Lock()
			done := c.relay.a.done
			c.relay.mu.Unlock()
			<-done
			cancel()
			c.sync.stopAll()
			if interruptedResync(env, dropboxWork(email)) {
				t.Fatal("a stopped pass was left resumable")
			}
			os.Remove(filepath.Join(env.Home, "hold-resync"))
			os.Remove(filepath.Join(env.Home, "resync-fail"))
			before, _ := os.ReadFile(filepath.Join(env.Home, "resyncs"))

			// The next daemon start.
			next := New(env, []Entry{d}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }), WithResumeTiming(20*time.Millisecond, 20*time.Millisecond, 80*time.Millisecond))
			ctx, cancel = context.WithCancel(context.Background())
			defer cancel()
			next.Start(ctx)
			defer next.sync.stopAll()
			time.Sleep(200 * time.Millisecond)
			if after, _ := os.ReadFile(filepath.Join(env.Home, "resyncs")); string(after) != string(before) {
				t.Fatal("a stopped first pass was resumed")
			}
			if s := dropboxService(t, next); s["failure"] != InitialSyncIncomplete {
				t.Fatalf("card: %v", s)
			}
		})
	}
}

// An account that must wait does not hold up another account's resume.
func TestWaitingAccountDoesNotBlockOthers(t *testing.T) {
	env := dropboxEnv(t)
	os.MkdirAll(filepath.Join(env.Home, dropboxDir), 0700)
	held := filepath.Join(env.Home, dropboxWork("a@example.test"))
	holder := exec.Command("/bin/sh", "-c", "sleep 600; :", "holder", "--workdir", held)
	if err := holder.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { holder.Process.Kill(); holder.Wait() }()
	interruptedDropbox(t, env, "a@example.test", lockJSON(held, holder.Process.Pid))
	interruptedDropbox(t, env, "b@example.test", "")
	c := New(env, []Entry{&dropbox{}}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }), WithResumeTiming(20*time.Millisecond, 20*time.Millisecond, 80*time.Millisecond))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c.Start(ctx)
	defer c.sync.stopAll()
	waitFor(t, "the free account's resume", func() bool {
		_, ready := (&dropbox{}).SyncCommand(env, "b@example.test")
		return ready
	})
	if _, ready := (&dropbox{}).SyncCommand(env, "a@example.test"); ready {
		t.Fatal("held pair resumed")
	}
}

// A Microsoft library whose resume failed shows it, though the service's
// status probe alone reports an unready library as unknown or hides it
// behind a ready sibling.
func TestMicrosoftResumeOutcomeIsShownPerService(t *testing.T) {
	env := microsoftEnv(t)
	address := "person@example.test"
	sp := "sp-" + strings.Repeat("ab", 12)
	os.MkdirAll(filepath.Join(env.Home, microsoftDir), 0700)
	config := fmt.Sprintf("[onedrive]\ndescription = cloud/onedrive/%[1]s\n\n[%[2]s]\ndescription = cloud/sharepoint/t--%[1]s/site/docs\n", address, sp)
	os.WriteFile(filepath.Join(env.Home, microsoftDir, address+".conf"), []byte(config), 0600)
	work := filepath.Join(env.Home, microsoftWork(address, "onedrive"))
	os.MkdirAll(work, 0700)
	os.WriteFile(filepath.Join(work, "s.path1.lst-new"), nil, 0600)
	m := &microsoft{}
	affected := map[string]bool{}
	for _, w := range m.interruptedPasses(env, address) {
		affected[m.passService(w)] = true
	}
	for _, mark := range []resumeMark{resumeQueued, resumeFailed} {
		services := []Service{{ID: "onedrive", State: StateUnknown}, {ID: "sharepoint", State: StateOK}, {ID: "mail", State: StateOK}}
		resumeView(resumeNote{mark, affected}, services)
		want := Service{ID: "onedrive", State: StateSyncing}
		if mark == resumeFailed {
			want = Service{ID: "onedrive", State: StateSyncFailed, Failure: InitialSyncResumeFailed}
		}
		if services[0] != want || services[1].State != StateOK || services[2].State != StateOK {
			t.Fatalf("mark %v: %+v", mark, services)
		}
	}
	services := []Service{{ID: "onedrive", State: StateLoginExpired}}
	if resumeView(resumeNote{resumeFailed, affected}, services); services[0].State != StateLoginExpired {
		t.Fatal("a rejected login was hidden", services)
	}
}
