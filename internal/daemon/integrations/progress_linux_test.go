//go:build linux

package integrations

import (
	"context"
	"os"
	"path/filepath"
	"strings"
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
