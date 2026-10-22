//go:build linux

package integrations

import (
	"context"
	"os"
	"path/filepath"
	"strings"
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
	case <-c.relay.a.done:
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
	c.relay.a = &attempt{provider: Microsoft, address: "person@example.test", syncing: true, state: "completing", progress: &SyncProgress{Service: "sharepoint", Phase: "transferring", Bytes: 42}}
	account := c.check(context.Background(), e, "person@example.test")
	if account.Services[0].Progress != nil {
		t.Fatal("SharePoint counters attributed to OneDrive", account)
	}
	if account.Services[1].Progress == nil || account.Services[1].Progress.Bytes != 42 || account.Services[1].State != StateSyncing {
		t.Fatal("unready native library lost progress", account)
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
			case <-c.relay.a.done:
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
	case <-c.relay.a.done:
	case <-time.After(3 * time.Second):
		t.Fatal("worker did not finish")
	}
	if len(s.chosen) != 0 || v["failure"] != "tool_failed" {
		t.Fatal("unmeasured copy admitted", v)
	}
}
