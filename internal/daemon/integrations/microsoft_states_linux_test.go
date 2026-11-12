//go:build linux

package integrations

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// A working login whose files never had a first pass says so, per service,
// instead of looking like a status check that failed; a pass that left
// anything of its own is an unfinished first sync.
func TestMicrosoftFilesNeverChosenSayNotChosen(t *testing.T) {
	env := microsoftEnv(t)
	m := syntheticMicrosoft(t, "person@example.test", "")
	l := msLogin(t, m, env, "")
	address, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil })
	if err != nil {
		t.Fatal(err)
	}
	if err := l.Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	states := func() map[string]Service {
		out := map[string]Service{}
		for _, s := range m.Check(context.Background(), env, address) {
			out[s.ID] = s
		}
		return out
	}
	for _, id := range []string{"onedrive", "sharepoint"} {
		if s := states()[id]; s.State != StateSyncFailed || s.Failure != FoldersNotChosen {
			t.Fatalf("%s %+v", id, s)
		}
	}
	// OneDrive synced; SharePoint's library was left out of the choice.
	work := filepath.Join(env.Home, microsoftWork(address, "onedrive"))
	os.MkdirAll(work, 0700)
	os.WriteFile(filepath.Join(work, "x.path1.lst-new"), nil, 0600)
	if s := states()["onedrive"]; s.State != StateSyncFailed || s.Failure != InitialSyncIncomplete {
		t.Fatalf("started pass %+v", s)
	}
	for _, side := range []string{"path1", "path2"} {
		os.WriteFile(filepath.Join(work, "x."+side+".lst"), nil, 0600)
	}
	got := states()
	if got["onedrive"].State != StateOK || got["sharepoint"].Failure != FoldersNotChosen || got["mail"].State != StateOK {
		t.Fatalf("%+v", got)
	}
}

// A first pass refused for room before anything was copied keeps saying so,
// with the sizes, after the daemon restarts; a new choice forgets it.
func TestMicrosoftRefusedFirstPassSurvivesARestart(t *testing.T) {
	env := microsoftEnv(t)
	address := "person@example.test"
	room := WithQuota(func() Room { return Room{Free: 100, OK: true} })
	c := New(env, []Entry{syntheticMicrosoft(t, address, "")}, nil, room)
	h := c.Handler(allow)
	if code, _, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "microsoft"}); code != 200 {
		t.Fatal(code)
	}
	defer func() { c.relay.cancelAll(); c.sync.stopAll() }()
	id := waitState(t, h, ownerA, "choose_folders")["attempt_id"]
	// The fake counts 1024 bytes for the root, more than the room.
	if code, _, _ := call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"onedrive"}}); code != 200 {
		t.Fatal(code)
	}
	if v := waitState(t, h, ownerA, "failed"); v["failure"] != "quota_insufficient" {
		t.Fatal(v)
	}
	waitLoginWorker(t, c)
	refused := func(services map[string]map[string]any) bool {
		d := services["onedrive"]
		return d["state"] == "sync_failed" && d["failure"] == "quota_insufficient" && d["needed_bytes"] == float64(1024) && d["free_bytes"] == float64(100)
	}
	if s := accountServices(t, c); !refused(s) || s["mail"]["state"] != "ok" {
		t.Fatalf("before the restart %v", s)
	}

	next := New(env, []Entry{syntheticMicrosoft(t, address, "")}, nil, room)
	if s := accountServices(t, next); !refused(s) || s["sharepoint"]["failure"] != "quota_insufficient" {
		t.Fatalf("after the restart %v", s)
	}
	// Leaving the files out at the next sign-in is a new choice.
	nh := next.Handler(allow)
	if code, _, _ := call(t, nh, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "microsoft", "address": address}); code != 200 {
		t.Fatal(code)
	}
	defer func() { next.relay.cancelAll(); next.sync.stopAll() }()
	id = waitState(t, nh, ownerA, "choose_folders")["attempt_id"]
	if code, _, _ := call(t, nh, "PUT", LoginPath, ownerA, map[string]any{"action": "skip_folders", "attempt_id": id}); code != 200 {
		t.Fatal(code)
	}
	waitState(t, nh, ownerA, "completed")
	waitLoginWorker(t, next)
	deadline := time.Now().Add(5 * time.Second)
	for accountServices(t, next)["onedrive"]["failure"] != FoldersNotChosen {
		if time.Now().After(deadline) {
			t.Fatal("refusal outlived the new choice", accountServices(t, next))
		}
		time.Sleep(20 * time.Millisecond)
	}
}
