//go:build linux

package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestNativeStatsBoundAndRedaction(t *testing.T) {
	var got []SyncProgress
	w := &statsOutput{emit: func(p SyncProgress) { got = append(got, p) }, started: time.Now().Add(-5 * time.Second)}
	// Split writes, oversized diagnostics, malformed JSON and credential-bearing
	// messages must not leak or prevent a subsequent valid native observation.
	w.Write([]byte(strings.Repeat("private", 10000) + "\nnot-json\n"))
	w.Write([]byte(`{"msg":"secret/path","stats":{"bytes":12,"totalBytes":120,`))
	w.Write([]byte("\"transfers\":2,\"totalTransfers\":10}}\n"))
	w.Write([]byte("{\"stats\":{\"bytes\":9007199254740992}}\n"))
	if len(got) != 1 || got[0].Bytes != 12 || got[0].Files != 2 || got[0].TotalFiles != 10 || got[0].TotalBytes != 120 || got[0].Phase != "transferring" || got[0].ElapsedSeconds < 5 {
		t.Fatal(got)
	}
	if len(w.line) > 16384 {
		t.Fatal("unbounded native output")
	}
}

func TestInitialPassUsesNativeOutputAndExit(t *testing.T) {
	env := Env{Home: newHome(t)}
	var got []SyncProgress
	ctx := context.WithValue(context.Background(), syncProgressKey{}, func(p SyncProgress) { got = append(got, p) })
	err := env.runInitialSync(ctx, Command{Path: "/bin/sh", Args: []string{"-c", `printf '%s\n' '{"stats":{"bytes":50,"totalBytes":100,"transfers":1,"totalTransfers":2}}' >&2; exit 7`}}, "drive")
	if err == nil || len(got) != 2 || got[0].Phase != "preparing" || got[1].Bytes != 50 {
		t.Fatal(err, got)
	}
}

type stalledListingEntry struct{ syncScriptEntry }

func (e stalledListingEntry) Folders(ctx context.Context, _ Env, _ string) ([]Folder, error) {
	<-ctx.Done()
	return nil, ToolFailed
}
func TestPostPasteListingIsBounded(t *testing.T) {
	s := &scriptEntry{provider: Google, kind: PastedRedirect, signsIn: "new@example.test", sync: true}
	e := stalledListingEntry{syncScriptEntry{s}}
	c := testCatalog(t, newHome(t), []Entry{e})
	c.signInWait = 60 * time.Millisecond
	h := c.Handler(allow)
	call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "google"})
	v := waitState(t, h, ownerA, "open_url")
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": v["attempt_id"], "redirect_url": "http://127.0.0.1:1/?state=s1&code=x"})
	v = waitState(t, h, ownerA, "failed")
	if v["failure"] != "expired" {
		t.Fatal(v)
	}
	select {
	case <-c.relay.current().done:
	case <-time.After(3 * time.Second):
		t.Fatal("expired listing worker did not finish")
	}
	if accounts, _ := e.Accounts(c.env); len(accounts) != 0 {
		t.Fatal("expired sign-in left a new account", accounts)
	}
}

type failedInitialEntry struct{ syncScriptEntry }

func (e failedInitialEntry) ChooseFolders(ctx context.Context, env Env, address string, ids []string) error {
	// Simulate native listing pairs surviving a failed pass: their presence
	// must not start a steady refresher before the failed job is addressed.
	if err := e.syncScriptEntry.ChooseFolders(ctx, env, address, ids); err != nil {
		return err
	}
	return env.runInitialSync(ctx, Command{Path: "/bin/sh", Args: []string{"-c", `printf '%s\n' '{"stats":{"bytes":42,"totalBytes":100}}' >&2; exit 7`}}, "drive")
}
func TestFailedNativeInitialPassRemainsVisibleWithoutResync(t *testing.T) {
	s := &scriptEntry{provider: Google, kind: PastedRedirect, signsIn: "new@example.test", sync: true, folders: []Folder{{ID: "own", Name: "Own", Bytes: 1}}}
	e := failedInitialEntry{syncScriptEntry{s}}
	c := testCatalog(t, newHome(t), []Entry{e})
	h := c.Handler(allow)
	call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "google"})
	v := waitState(t, h, ownerA, "open_url")
	id := v["attempt_id"]
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": "http://127.0.0.1:1/?state=s1&code=x"})
	waitState(t, h, ownerA, "choose_folders")
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"own"}})
	waitState(t, h, ownerA, "failed")
	account := c.check(context.Background(), e, s.signsIn)
	service := account.Services[0]
	if service.State != StateSyncFailed || service.Progress == nil || service.Progress.Bytes != 42 {
		t.Fatal(account)
	}
	if accounts, _ := e.Accounts(c.env); len(accounts) != 1 {
		t.Fatal("failed account vanished", accounts)
	}
	if c.sync.supervised(key{Google, s.signsIn}) {
		t.Fatal("failed first pass was automatically retried")
	}
}

func TestDeviceInventoryDeadlineIsNotNativeToolFailure(t *testing.T) {
	s := &scriptEntry{provider: Microsoft, kind: DeviceCode, signsIn: "new@example.test", sync: true}
	e := stalledListingEntry{syncScriptEntry{s}}
	home := newHome(t)
	c := testCatalog(t, home, []Entry{e})
	c.signInWait = 60 * time.Millisecond
	if err := os.WriteFile(filepath.Join(home, "approve"), nil, 0600); err != nil {
		t.Fatal(err)
	}
	h := c.Handler(allow)
	call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "microsoft"})
	v := waitState(t, h, ownerA, "failed")
	if v["failure"] != "expired" {
		t.Fatal("native ToolFailed masked the inventory deadline", v)
	}
}

type unreadyLibraryEntry struct{ syncScriptEntry }

func (e unreadyLibraryEntry) Services() []string { return []string{"onedrive", "sharepoint"} }
func (e unreadyLibraryEntry) Directories(Env, string) []SyncDirectory {
	return []SyncDirectory{{Service: "onedrive", Path: "cloud/onedrive/person@example.test"}}
}
func TestNativeProgressBelongsToTheCurrentLibrary(t *testing.T) {
	e := unreadyLibraryEntry{syncScriptEntry{&scriptEntry{provider: Microsoft}}}
	c := New(Env{}, []Entry{e}, nil)
	c.relay.put(&attempt{provider: Microsoft, address: "person@example.test", syncing: true, state: "completing", progress: &SyncProgress{Service: "sharepoint", Phase: "transferring", Bytes: 42}})
	account := c.check(context.Background(), e, "person@example.test")
	if account.Services[0].Progress != nil {
		t.Fatal("SharePoint counters attributed to OneDrive", account)
	}
	if account.Services[1].Progress == nil || account.Services[1].Progress.Bytes != 42 || account.Services[1].State != StateSyncing {
		t.Fatal("unready native library lost progress", account)
	}
}

// countedEntry is a provider with files and other services whose tool counts
// how often it is asked.
type countedEntry struct {
	syncScriptEntry
	asked *atomic.Int32
}

func (e countedEntry) Services() []string { return []string{"drive", "mail", "calendar"} }
func (e countedEntry) Check(context.Context, Env, string) []Service {
	e.asked.Add(1)
	return []Service{{ID: "drive", State: StateOK}, {ID: "mail", State: StateOK}, {ID: "calendar", State: StateOK}}
}

// While a first pass holds the provider's native sign-in, the services it
// does not copy are neither asked nor reported as a failed check: this
// account's and another account's of the same provider wait for the pass.
func TestServicesBesideFirstPassWaitForIt(t *testing.T) {
	asked := &atomic.Int32{}
	e := countedEntry{syncScriptEntry{&scriptEntry{provider: Microsoft}}, asked}
	c := New(Env{Home: t.TempDir()}, []Entry{e}, nil)
	pass := &attempt{provider: Microsoft, address: "person@example.test", syncing: true, state: "completing", progress: &SyncProgress{Service: "drive", Phase: "transferring", Bytes: 42}}
	c.relay.put(pass)
	states := func(a Account) map[string]ServiceState {
		out := map[string]ServiceState{}
		for _, s := range a.Services {
			out[s.ID] = s.State
		}
		return out
	}
	own := states(c.check(context.Background(), e, "person@example.test"))
	if own["drive"] != StateSyncing || own["mail"] != StatePendingFirstSync || own["calendar"] != StatePendingFirstSync {
		t.Fatal("account in its first pass", own)
	}
	other := states(c.check(context.Background(), e, "other@example.test"))
	for id, s := range other {
		if s != StatePendingFirstSync {
			t.Fatal("another account beside the provider's first pass", id, s)
		}
	}
	if n := asked.Load(); n != 0 {
		t.Fatal("tool asked beside the native pass", n)
	}
	c.relay.mu.Lock()
	pass.state = "completed"
	c.relay.mu.Unlock()
	after := states(c.check(context.Background(), e, "person@example.test"))
	if asked.Load() != 1 || after["mail"] != StateOK || after["calendar"] != StateOK {
		t.Fatal("services not checked after the pass", after, asked.Load())
	}
}

// The synthetic provider owns half a million files, but choice never asks for
// recursive inventory. Slow inventory starts only after approval, survives the
// request, and never starts copying when fresh quota admission refuses it.
type measuredScriptEntry struct{ syncScriptEntry }

func (e measuredScriptEntry) Folders(ctx context.Context, env Env, address string) ([]Folder, error) {
	return (&dropbox{}).Folders(ctx, env, address)
}
func (e measuredScriptEntry) MeasureFolders(ctx context.Context, env Env, _ string, _ []string) (uint64, error) {
	return env.measureSize(ctx, Command{Path: "/bin/sh", Args: []string{"-c", `touch "$HOME/inventory-started"; while [ ! -f "$HOME/inventory-release" ]; do sleep 0.02; done; echo '{"count":500000,"bytes":5000000000}'`}}, "dropbox")
}
func TestChoicePrecedesLargeInventoryAndFreshQuota(t *testing.T) {
	for _, mode := range []string{"fits", "too-large", "quota-unavailable", "cancel"} {
		t.Run(mode, func(t *testing.T) {
			s := &scriptEntry{provider: Dropbox, kind: PastedRedirect, signsIn: "new@example.test", sync: true}
			e := measuredScriptEntry{syncScriptEntry{s}}
			c := testCatalog(t, newHome(t), []Entry{e})
			// Availability is intentionally unknown while signing in. It must not
			// prevent a person reaching the choice or be represented as zero bytes.
			var room atomic.Pointer[Room]
			room.Store(&Room{})
			c.quota = func() Room { return *room.Load() }
			h := c.Handler(allow)
			call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "dropbox"})
			v := waitState(t, h, ownerA, "open_url")
			id := v["attempt_id"]
			started := time.Now()
			call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": "http://127.0.0.1:1/?state=s1&code=x"})
			v = waitState(t, h, ownerA, "choose_folders")
			if time.Since(started) > 2*time.Second {
				t.Fatal("choice waited for recursive inventory")
			}
			if _, err := os.Stat(filepath.Join(c.env.Home, "inventory-started")); !os.IsNotExist(err) {
				t.Fatal("inventory before approval")
			}
			f := v["folders"].([]any)[0].(map[string]any)
			if _, ok := f["bytes"]; ok {
				t.Fatal("unknown size became zero")
			}
			code, _, _ := call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"all", "all"}})
			if code != 400 {
				t.Fatal("duplicate choice accepted", code)
			}
			code, _, _ = call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"all"}})
			if code != 200 {
				t.Fatal(code)
			}
			v = waitState(t, h, ownerA, "completing")
			deadline := time.Now().Add(3 * time.Second)
			for {
				_, v, _ = call(t, h, "GET", LoginPath, ownerA, nil)
				if p, ok := v["progress"].(map[string]any); ok && p["phase"] == "inventory" {
					break
				}
				if time.Now().After(deadline) {
					t.Fatal("missing inventory progress", v)
				}
				time.Sleep(10 * time.Millisecond)
			}
			// Changes between choice and completion must be observed after counting.
			if mode == "fits" {
				room.Store(&Room{OK: true, Free: 6000000000})
			} else if mode == "too-large" {
				room.Store(&Room{OK: true, Free: 1})
			}
			if mode == "cancel" {
				call(t, h, "DELETE", LoginPath, ownerA, map[string]any{"action": "cancel", "attempt_id": id})
			}
			if err := os.WriteFile(filepath.Join(c.env.Home, "inventory-release"), nil, 0600); err != nil {
				t.Fatal(err)
			}
			want := "failed"
			if mode == "fits" {
				want = "completed"
			}
			v = waitState(t, h, ownerA, want)
			select {
			case <-c.relay.current().done:
			case <-time.After(3 * time.Second):
				t.Fatal("background worker did not settle")
			}
			if mode == "fits" {
				if len(s.chosen) == 0 {
					t.Fatal("admitted copy not run")
				}
			} else {
				if len(s.chosen) > 0 {
					t.Fatal("copy ran despite failed admission")
				}
				failure := map[string]string{"too-large": "quota_insufficient", "quota-unavailable": "quota_unavailable", "cancel": "cancelled"}[mode]
				if v["failure"] != failure {
					t.Fatal(v)
				}
				if mode != "cancel" {
					account := c.check(context.Background(), e, s.signsIn)
					if len(account.Services) != 1 || account.Services[0].Failure != failure {
						t.Fatal("background refusal lost its cause", account)
					}
				}
				if accounts, _ := e.Accounts(c.env); len(accounts) != 1 {
					t.Fatal("recoverable native login lost")
				}
				if c.sync.supervised(key{Dropbox, s.signsIn}) {
					t.Fatal("refused job started supervision")
				}
			}
		})
	}
}

// lockedLog collects the catalog's JSON events written from its workers.
type lockedLog struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (l *lockedLog) Write(p []byte) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.buf.Write(p)
}

func (l *lockedLog) events(t *testing.T, name string) []map[string]any {
	t.Helper()
	l.mu.Lock()
	defer l.mu.Unlock()
	var out []map[string]any
	for _, line := range strings.Split(strings.TrimSpace(l.buf.String()), "\n") {
		var e map[string]any
		if line == "" {
			continue
		}
		if err := json.Unmarshal([]byte(line), &e); err != nil {
			t.Fatal(err)
		}
		if e["msg"] == name {
			out = append(out, e)
		}
	}
	return out
}

// A person who starts a second provider's sign-in while the first one's
// initial pass counts its files is refused before any attempt exists. The
// refusal leaves its own event naming the busy provider, and a pass that
// then does not fit the home records how much it needed and how much room
// there was, so neither outcome has to be reconstructed from a bare status.
// startFirstPass signs the synthetic Dropbox account in and chooses its
// folder; the pass then waits in its inventory until the test releases it.
func startFirstPass(t *testing.T, c *Catalog, h http.Handler) {
	t.Helper()
	call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "dropbox"})
	id := waitAttempt(t, h, ownerA, Dropbox, "open_url")["attempt_id"]
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": "http://127.0.0.1:1/?state=s1&code=x"})
	waitAttempt(t, h, ownerA, Dropbox, "choose_folders")
	if code, _, _ := call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"all"}}); code != 200 {
		t.Fatal(code)
	}
	deadline := time.Now().Add(3 * time.Second)
	for {
		if _, err := os.Stat(filepath.Join(c.env.Home, "inventory-started")); err == nil {
			return
		}
		if time.Now().After(deadline) {
			t.Fatal("inventory did not start")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// A sign-in that copies no files starts and finishes while another
// provider's first pass runs; a second start of the same provider and a
// start of another file-copying provider stay refused, and say why.
func TestSignInWithoutFilesRunsBesideFirstPass(t *testing.T) {
	s := &scriptEntry{provider: Dropbox, kind: PastedRedirect, signsIn: "new@example.test", sync: true}
	e := measuredScriptEntry{syncScriptEntry{s}}
	other := &scriptEntry{provider: Atlassian, kind: PastedRedirect, signsIn: atlassianServer}
	files := syncScriptEntry{&scriptEntry{provider: Google, kind: PastedRedirect, signsIn: "g@example.test", sync: true, folders: []Folder{{ID: "own", Name: "Own", Bytes: 1, Suggested: true}}}}
	c := testCatalog(t, newHome(t), []Entry{e, other, files})
	logs := &lockedLog{}
	c.log = slog.New(slog.NewJSONHandler(logs, nil))
	var room atomic.Pointer[Room]
	room.Store(&Room{})
	c.quota = func() Room { return *room.Load() }
	h := c.Handler(allow)
	startFirstPass(t, c, h)

	code, out, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "atlassian"})
	if code != 200 || out["provider"] != "atlassian" {
		t.Fatal("start during a first pass", code, out)
	}
	id := waitAttempt(t, h, ownerA, Atlassian, "open_url")["attempt_id"]
	// The first pass keeps its own view while the other sign-in runs.
	if v := waitAttempt(t, h, ownerA, Dropbox, "completing"); v["address"] != "new@example.test" {
		t.Fatal("first pass view", v)
	}
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": "http://127.0.0.1:1/?state=s1&code=x"})
	if v := waitAttempt(t, h, ownerA, Atlassian, "completed"); v["address"] != atlassianServer {
		t.Fatal(v)
	}
	if _, err := os.Stat(filepath.Join(other.dir(c.env), atlassianServer)); err != nil {
		t.Fatal("sign-in beside the pass kept nothing", err)
	}
	// Completion is published under c.write before its reconciliation;
	// a removal is refused while that write still runs, so it waits for
	// the sign-in's worker to end.
	c.relay.mu.Lock()
	signedIn := c.relay.attempts[Atlassian].done
	c.relay.mu.Unlock()
	select {
	case <-signedIn:
	case <-time.After(3 * time.Second):
		t.Fatal("sign-in beside the pass did not settle")
	}
	// A connection beside the pass can be removed again without waiting.
	if code, out, _ := call(t, h, "DELETE", AccountsPath, ownerA, map[string]any{"action": "remove", "provider": "atlassian", "address": atlassianServer, "delete_directories": false}); code != 200 {
		t.Fatal("removal beside the pass", code, out)
	}

	for _, p := range []string{"dropbox", "google"} {
		code, out := 0, map[string]any{}
		code, out, _ = call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": p})
		if code != 409 || errorCode(out) != "attempt_active" {
			t.Fatal("second file sign-in during a first pass", p, code, out)
		}
		refused := logs.events(t, "integration_login")
		last := refused[len(refused)-1]
		for k, want := range map[string]any{"provider": p, "outcome": "refused", "phase": "start", "reason": "attempt_active", "busy_provider": "dropbox", "busy_state": "completing", "busy_syncing": true} {
			if last[k] != want {
				t.Fatal(k, last)
			}
		}
	}
	if v := waitAttempt(t, h, ownerA, Dropbox, "completing"); v["address"] != "new@example.test" {
		t.Fatal("refused start disturbed the pass", v)
	}

	room.Store(&Room{OK: true, Free: 4000000000, Limit: 20000000000})
	if err := os.WriteFile(filepath.Join(c.env.Home, "inventory-release"), nil, 0600); err != nil {
		t.Fatal(err)
	}
	if v := waitAttempt(t, h, ownerA, Dropbox, "failed"); v["failure"] != "quota_insufficient" {
		t.Fatal(v)
	}
	events := logs.events(t, "integration_login")
	failed := events[len(events)-1]
	for k, want := range map[string]any{"provider": "dropbox", "outcome": "failed", "reason": "quota_insufficient", "needed_bytes": float64(5000000000), "free_bytes": float64(4000000000)} {
		if failed[k] != want {
			t.Fatal(k, failed)
		}
	}
	// The finished pass no longer holds files back: another provider starts.
	if code, out, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "google"}); code != 200 {
		t.Fatal("start after the refused pass", code, out)
	}
}

// The first pass runs without the catalog's write lock, so removing the very
// account it copies stops the pass, waits for its native process and then
// removes the login, rather than leaving the pass to bring it back.
func TestRemovalDuringFirstPassStopsIt(t *testing.T) {
	s := &scriptEntry{provider: Dropbox, kind: PastedRedirect, signsIn: "new@example.test", sync: true}
	e := measuredScriptEntry{syncScriptEntry{s}}
	c := testCatalog(t, newHome(t), []Entry{e})
	c.quota = func() Room { return Room{OK: true, Free: 1 << 40} }
	h := c.Handler(allow)
	startFirstPass(t, c, h)
	if code, out, _ := call(t, h, "DELETE", AccountsPath, ownerA, map[string]any{"action": "remove", "provider": "dropbox", "address": "new@example.test", "delete_directories": false}); code != 200 {
		t.Fatal("removal during the pass", code, out)
	}
	c.relay.mu.Lock()
	a := c.relay.current()
	c.relay.mu.Unlock()
	select {
	case <-a.done:
	case <-time.After(5 * time.Second):
		t.Fatal("worker did not finish")
	}
	if v := waitAttempt(t, h, ownerA, Dropbox, "failed"); v["failure"] != "cancelled" {
		t.Fatal(v)
	}
	if _, err := os.Stat(filepath.Join(s.dir(c.env), "new@example.test")); !os.IsNotExist(err) {
		t.Fatal("removed login came back", err)
	}
	if len(s.chosen) != 0 {
		t.Fatal("removed account copied")
	}
}

// lingeringPassEntry's count outlives its cancellation until the test lets
// it end, as a native process may between SIGTERM and its exit.
type lingeringPassEntry struct {
	syncScriptEntry
	started, release chan struct{}
}

func (e lingeringPassEntry) MeasureFolders(context.Context, Env, string, []string) (uint64, error) {
	close(e.started)
	<-e.release
	return 0, Cancelled
}

// A cancelled first pass reads as ended before its native work has. Removing
// the account then still waits for that work, rather than deleting the
// configuration and folder under it.
func TestRemovalAfterCancelWaitsForThePass(t *testing.T) {
	s := &scriptEntry{provider: Dropbox, kind: PastedRedirect, signsIn: "new@example.test", sync: true, folders: []Folder{{ID: "all", Name: "Root", Bytes: 1, Suggested: true}}}
	e := lingeringPassEntry{syncScriptEntry{s}, make(chan struct{}), make(chan struct{})}
	c := testCatalog(t, newHome(t), []Entry{e})
	c.quota = func() Room { return Room{OK: true, Free: 1 << 40} }
	h := c.Handler(allow)
	call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "dropbox"})
	id := waitState(t, h, ownerA, "open_url")["attempt_id"]
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": "http://127.0.0.1:1/?state=s1&code=x"})
	waitState(t, h, ownerA, "choose_folders")
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"all"}})
	<-e.started
	if code, _, _ := call(t, h, "DELETE", LoginPath, ownerA, map[string]any{"action": "cancel", "attempt_id": id}); code != 200 {
		t.Fatal("cancel", code)
	}
	removed := make(chan int, 1)
	go func() {
		code, _, _ := call(t, h, "DELETE", AccountsPath, ownerA, map[string]any{"action": "remove", "provider": "dropbox", "address": "new@example.test", "delete_directories": false})
		removed <- code
	}()
	select {
	case code := <-removed:
		t.Fatal("removal did not wait for the pass", code)
	case <-time.After(300 * time.Millisecond):
	}
	if _, err := os.Stat(filepath.Join(s.dir(c.env), "new@example.test")); err != nil {
		t.Fatal("login removed under the running pass", err)
	}
	close(e.release)
	select {
	case code := <-removed:
		if code != 200 {
			t.Fatal("removal after the pass", code)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("removal never finished")
	}
	if _, err := os.Stat(filepath.Join(s.dir(c.env), "new@example.test")); !os.IsNotExist(err) {
		t.Fatal("removed login came back", err)
	}
}

func TestUnknownFolderSizeWithoutMeasurerCannotCopy(t *testing.T) {
	s := &scriptEntry{provider: Dropbox, kind: PastedRedirect, signsIn: "new@example.test", sync: true, folders: []Folder{{ID: "all", Name: "Root", UnknownSize: true, Suggested: true}}}
	e := syncScriptEntry{s} // deliberately has no MeasureFolders implementation
	c := testCatalog(t, newHome(t), []Entry{e})
	h := c.Handler(allow)
	call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "dropbox"})
	v := waitState(t, h, ownerA, "open_url")
	id := v["attempt_id"]
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": "http://127.0.0.1:1/?state=s1&code=x"})
	waitState(t, h, ownerA, "choose_folders")
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"all"}})
	v = waitState(t, h, ownerA, "failed")
	select {
	case <-c.relay.current().done:
	case <-time.After(3 * time.Second):
		t.Fatal("worker did not finish")
	}
	if len(s.chosen) != 0 || v["failure"] != "tool_failed" {
		t.Fatal("unmeasured copy admitted", v)
	}
}
