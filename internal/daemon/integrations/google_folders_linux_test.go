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

// googleAtFolders signs a synthetic Google account in and returns at its
// folder step. The fake rclone answers from the files the test writes into
// the home before the call (drive-about, drive-top, drive-sizes).
func googleAtFolders(t *testing.T, env Env, room Room) (*Catalog, *google, string, map[string]any) {
	t.Helper()
	email := "person@example.test"
	d := syntheticGoogle(t, &email, googleScopes)
	c := New(env, []Entry{d}, nil, WithQuota(func() Room { return room }))
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	c.Start(ctx)
	t.Cleanup(c.sync.stopAll)
	h := c.Handler(allow)
	if code, _, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "google"}); code != 200 {
		t.Fatal(code)
	}
	view := waitState(t, h, ownerA, "open_url")
	id := view["attempt_id"].(string)
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": googlePaste(t, view)})
	return c, d, id, waitState(t, h, ownerA, "choose_folders")
}

func folderByID(view map[string]any, id string) map[string]any {
	folders, _ := view["folders"].([]any)
	for _, f := range folders {
		if m := f.(map[string]any); m["id"] == id {
			return m
		}
	}
	return nil
}

func accountServices(t *testing.T, c *Catalog) map[string]map[string]any {
	t.Helper()
	_, out, _ := call(t, c.Handler(allow), "GET", ListPath, "", nil)
	accounts, _ := out["accounts"].([]any)
	if len(accounts) != 1 {
		t.Fatalf("accounts %v", out)
	}
	services := map[string]map[string]any{}
	for _, s := range accounts[0].(map[string]any)["services"].([]any) {
		m := s.(map[string]any)
		services[m["id"].(string)] = m
	}
	return services
}

// A drive larger than the home is offered whole with Google's estimate and
// nothing chosen in advance, and folder by folder with sizes counted while
// the person chooses. A chosen folder then syncs alone, matched literally.
func TestGoogleDriveLargerThanHomeOffersItsFolders(t *testing.T) {
	env := googleEnv(t)
	write := func(name, data string) {
		if err := os.WriteFile(filepath.Join(env.Home, name), []byte(data), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	write("drive-about", `{"total":100000,"used":25000,"trashed":1000}`)
	write("drive-top", `[{"Path":"Kuvat","Name":"Kuvat","IsDir":true,"ID":"idKuvat"},{"Path":"Työ [2026]*","Name":"Työ [2026]*","IsDir":true,"ID":"idTyo"},{"Path":"Muu","Name":"Muu","IsDir":true,"ID":"../x"}]`)
	write("drive-sizes", "google:@root\t500\ngoogle:Kuvat\t20000\ngoogle:Työ [2026]*\t3000\ngoogle:Muu\t500\n")
	write("hold-size", "")
	c, _, id, view := googleAtFolders(t, env, Room{Free: 10000, Limit: 50000, OK: true})
	h := c.Handler(allow)

	whole := folderByID(view, "all")
	if whole == nil || whole["bytes"] != float64(24000) || whole["estimated"] != true || whole["whole"] != true || whole["suggested"] != false {
		t.Fatalf("whole drive %v", whole)
	}
	if f := folderByID(view, "idKuvat"); f == nil || f["measuring"] != true || f["bytes"] != nil {
		t.Fatalf("folder before its count %v", f)
	}
	if folderByID(view, "../x") != nil {
		t.Fatal("a folder whose ID the contract refuses was offered")
	}
	os.Remove(filepath.Join(env.Home, "hold-size"))
	deadline := time.Now().Add(5 * time.Second)
	for {
		_, view, _ = call(t, h, "GET", LoginPath, ownerA, nil)
		if w := folderByID(view, "all"); w["measuring"] == nil && w["estimated"] == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("sizes not counted %v", view)
		}
		time.Sleep(20 * time.Millisecond)
	}
	// The whole drive is the sum of every top-level folder (the one not
	// offered included) and the files at its root.
	if w, f := folderByID(view, "all"), folderByID(view, "idTyo"); w["bytes"] != float64(24000) || f["bytes"] != float64(3000) || f["measuring"] != nil {
		t.Fatalf("counted %v %v", w, f)
	}
	if code, _, _ := call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"all", "idTyo"}}); code != 400 {
		t.Fatal("whole drive and a folder of it chosen together", code)
	}
	if code, out, _ := call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"idKuvat"}}); code != 422 || errorCode(out) != "quota_insufficient" {
		t.Fatal("a counted folder larger than the home was admitted", code)
	}
	if code, _, _ := call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"idTyo"}}); code != 200 {
		t.Fatal(code)
	}
	waitState(t, h, ownerA, "completed")
	waitLoginWorker(t, c)
	// The count from the choice is minutes old by now: admission counts
	// the chosen folder again.
	if calls, _ := os.ReadFile(filepath.Join(env.Home, "size-calls")); strings.Count(string(calls), "google:Työ [2026]*\n") != 2 {
		t.Fatalf("chosen folder not counted again at admission: %q", calls)
	}
	filter, err := os.ReadFile(filepath.Join(env.Home, googleDir, "person@example.test.filter"))
	if err != nil || string(filter) != "+ /Työ \\[2026\\]\\*/**\n- **\n" {
		t.Fatalf("filter %q %v", filter, err)
	}
	args, _ := os.ReadFile(filepath.Join(env.Home, "bisync-args"))
	for _, line := range strings.Split(strings.TrimSpace(string(args)), "\n") {
		if !strings.Contains(line, "--filters-file "+filepath.Join(env.Home, googleDir, "person@example.test.filter")) {
			t.Fatalf("a pass without the chosen folders' filter: %s", line)
		}
	}
	// Removal takes rclone's filter and its checksum with the login.
	os.WriteFile(filepath.Join(env.Home, googleDir, "person@example.test.filter.md5"), []byte("x"), 0o600)
	if code, _, _ := call(t, h, "DELETE", AccountsPath, "", map[string]any{"action": "remove", "provider": "google", "address": "person@example.test", "delete_directories": false}); code != 200 {
		t.Fatal(code)
	}
	for _, n := range []string{"person@example.test.filter", "person@example.test.filter.md5"} {
		if _, err := os.Stat(filepath.Join(env.Home, googleDir, n)); !os.IsNotExist(err) {
			t.Fatalf("%s survived removal", n)
		}
	}
}

// Leaving Drive out completes the sign-in for mail, calendar and contacts.
// Drive then says its files were never chosen, and nothing syncs.
func TestGoogleSkippedDriveKeepsTheOtherServices(t *testing.T) {
	env := googleEnv(t)
	c, _, id, _ := googleAtFolders(t, env, Room{Free: 10, OK: true})
	h := c.Handler(allow)
	if code, _, _ := call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "skip_folders", "attempt_id": id, "folders": []string{"all"}}); code != 400 {
		t.Fatal("skip carried a folder choice", code)
	}
	if code, _, _ := call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "skip_folders", "attempt_id": id}); code != 200 {
		t.Fatal(code)
	}
	waitState(t, h, ownerA, "completed")
	waitLoginWorker(t, c)
	if c.sync.supervised(key{Google, "person@example.test"}) {
		t.Fatal("skipped files sync")
	}
	services := accountServices(t, c)
	if d := services["drive"]; d["state"] != "sync_failed" || d["failure"] != FoldersNotChosen {
		t.Fatalf("drive %v", d)
	}
	for _, s := range []string{"mail", "calendar", "contacts"} {
		if services[s]["state"] != "ok" {
			t.Fatalf("%s %v", s, services[s])
		}
	}
	// A first pass that left anything of its own did start: that is an
	// unfinished first sync, not files never chosen.
	work := filepath.Join(env.Home, googleWork("person@example.test"))
	os.MkdirAll(work, 0o700)
	os.WriteFile(filepath.Join(work, "x.path1.lst-old"), nil, 0o600)
	if d := accountServices(t, c)["drive"]; d["failure"] != InitialSyncIncomplete {
		t.Fatalf("drive after a started pass %v", d)
	}
}

// A first sync the quota refused leaves the account's other services
// checked as usual; only the file service carries the refusal.
func TestRefusedFirstSyncDoesNotHideTheOtherServices(t *testing.T) {
	env := googleEnv(t)
	os.WriteFile(filepath.Join(env.Home, "drive-about"), []byte(`{"used":5}`), 0o600)
	os.WriteFile(filepath.Join(env.Home, "drive-top"), []byte(`[]`), 0o600)
	os.WriteFile(filepath.Join(env.Home, "drive-sizes"), []byte("google:@root\t5000\ngoogle:\t5000\n"), 0o600)
	os.WriteFile(filepath.Join(env.Home, "hold-size"), nil, 0o600)
	c, _, id, view := googleAtFolders(t, env, Room{Free: 100, OK: true})
	h := c.Handler(allow)
	if w := folderByID(view, "all"); w["suggested"] != true || w["estimated"] != true {
		t.Fatalf("an estimate that fits is not suggested %v", w)
	}
	// Chosen on the estimate, before the count: measured, then refused.
	if code, _, _ := call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"all"}}); code != 200 {
		t.Fatal(code)
	}
	os.Remove(filepath.Join(env.Home, "hold-size"))
	if v := waitState(t, h, ownerA, "failed"); v["failure"] != "quota_insufficient" {
		t.Fatal(v)
	}
	services := accountServices(t, c)
	if d := services["drive"]; d["state"] != "sync_failed" || d["failure"] != "quota_insufficient" {
		t.Fatalf("drive %v", d)
	}
	for _, s := range []string{"mail", "calendar", "contacts"} {
		if services[s]["state"] != "ok" {
			t.Fatalf("%s %v", s, services[s])
		}
	}
}

// Leaving the files out is refused where they already sync: it would have
// to stop that sync, and completing the sign-in would only restart it.
func TestSkipIsRefusedWhereFilesAlreadySync(t *testing.T) {
	env := googleEnv(t)
	address := "person@example.test"
	work := filepath.Join(env.Home, googleWork(address))
	if err := os.MkdirAll(work, 0o700); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(filepath.Join(env.Home, googleDir, address+".conf"), []byte("[google]\nscope = drive\n"), 0o600)
	email := address
	c := New(env, []Entry{syntheticGoogle(t, &email, googleScopes)}, nil)
	attemptAt := func() *attempt {
		a := &attempt{owner: ownerA, id: "20261028T080000.000000001", provider: Google, address: address, state: "choose_folders", choose: make(chan []string, 1), done: make(chan struct{})}
		c.relay.mu.Lock()
		c.relay.a = a
		c.relay.mu.Unlock()
		return a
	}
	for _, n := range []string{"x.path1.lst", "x.path2.lst"} {
		os.WriteFile(filepath.Join(work, n), nil, 0o600)
	}
	if err := c.skipFolders(ownerA, attemptAt().id); err != errFolders {
		t.Fatal("skip accepted over a running sync", err)
	}
	for _, n := range []string{"x.path1.lst", "x.path2.lst"} {
		os.Remove(filepath.Join(work, n))
	}
	if a := attemptAt(); c.skipFolders(ownerA, a.id) != nil || len(<-a.choose) != 0 {
		t.Fatal("skip refused for files never chosen")
	}
}
