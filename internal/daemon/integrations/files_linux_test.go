//go:build linux

package integrations

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
)

// The folder read shows only a connected account's own sync directory, one
// level at a time, and never follows a link out of it.
func TestFilesReadStaysInsideConnectedSyncDirectories(t *testing.T) {
	home := newHome(t)
	const address, linked, gone = "person@example.test", "linked@example.test", "gone@example.test"
	entry := syncScriptEntry{&scriptEntry{provider: Google, sync: true}}
	mustDir := func(rel string) {
		t.Helper()
		if err := os.MkdirAll(filepath.Join(home, rel), 0o700); err != nil {
			t.Fatal(err)
		}
	}
	mustFile := func(rel, body string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(home, rel), []byte(body), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	mustDir(".config/synthetic-google")
	for _, a := range []string{address, linked, gone} {
		mustFile(".config/synthetic-google/"+a, "")
	}
	root := "cloud/synthetic/" + address
	mustDir(root + "/Raportit/vko 45")
	mustFile(root+"/Raportit/vko 45/raportti.md", "# viikko")
	mustFile(root+"/muistio.txt", "hello")
	mustFile(root+"/tyhjä.txt", "")
	mustDir(".ssh")
	mustFile(".ssh/id_ed25519", "secret")
	mustDir("cloud/other")
	if err := os.Symlink(filepath.Join(home, ".ssh"), filepath.Join(home, root, "avaimet")); err != nil {
		t.Fatal(err)
	}
	if err := syscall.Mkfifo(filepath.Join(home, root, "putki"), 0o600); err != nil {
		t.Fatal(err)
	}
	// Another account's directory is a link: it is no root at all.
	if err := os.Symlink(filepath.Join(home, ".ssh"), filepath.Join(home, "cloud/synthetic", linked)); err != nil {
		t.Fatal(err)
	}
	c := testCatalog(t, home, []Entry{entry})
	h := c.Handler(allow)

	status, body, raw := call(t, h, http.MethodGet, FilesPath, "", nil)
	if status != 200 {
		t.Fatalf("roots: %d %s", status, raw)
	}
	roots, _ := body["roots"].([]any)
	if len(roots) != 1 || roots[0].(map[string]any)["directory"] != "~/"+root || roots[0].(map[string]any)["service"] != "drive" {
		t.Fatalf("roots: %s", raw)
	}

	read := func(params url.Values) (int, map[string]any, string) {
		return call(t, h, http.MethodGet, FilesPath+"?"+params.Encode(), "", nil)
	}
	status, body, raw = read(url.Values{"directory": {"~/" + root}})
	if status != 200 {
		t.Fatalf("root folder: %d %s", status, raw)
	}
	names := []string{}
	for _, e := range body["entries"].([]any) {
		m := e.(map[string]any)
		names = append(names, m["kind"].(string)+":"+m["name"].(string))
		if m["name"] == "muistio.txt" && m["bytes"] != float64(5) {
			t.Fatalf("size: %s", raw)
		}
		if m["name"] == "tyhjä.txt" && m["bytes"] != nil {
			t.Fatalf("empty file carries a size: %s", raw)
		}
	}
	if strings.Join(names, ",") != "folder:Raportit,file:muistio.txt,file:tyhjä.txt" || body["unlisted"] != float64(2) || body["truncated"] != false {
		t.Fatalf("root folder: %s", raw)
	}
	if strings.Contains(raw, "hello") || strings.Contains(raw, "secret") {
		t.Fatalf("content leaked: %s", raw)
	}

	status, body, raw = read(url.Values{"directory": {"~/" + root}, "folder": {"Raportit/vko 45"}})
	if status != 200 || body["folder"] != "Raportit/vko 45" || !strings.Contains(raw, `"raportti.md"`) {
		t.Fatalf("subfolder: %d %s", status, raw)
	}

	for _, tc := range []struct {
		params url.Values
		status int
		code   string
	}{
		{url.Values{"directory": {"~/" + root}, "folder": {"avaimet"}}, 404, ""},
		{url.Values{"directory": {"~/" + root}, "folder": {"puuttuu"}}, 404, "folder_missing"},
		{url.Values{"directory": {"~/" + root}, "folder": {"muistio.txt"}}, 404, "folder_missing"},
		{url.Values{"directory": {"~/" + root}, "folder": {"../other"}}, 400, "invalid_request"},
		{url.Values{"directory": {"~/" + root}, "folder": {"Raportit/"}}, 400, "invalid_request"},
		{url.Values{"directory": {"~/" + root}, "folder": {""}}, 400, "invalid_request"},
		{url.Values{"directory": {"~/" + root}, "folder": {"/etc"}}, 400, "invalid_request"},
		{url.Values{"directory": {"~/cloud/other"}}, 404, "directory_unavailable"},
		{url.Values{"directory": {"~/.ssh"}}, 404, "directory_unavailable"},
		{url.Values{"directory": {"~/cloud/synthetic/" + linked}}, 404, "directory_unavailable"},
		{url.Values{"directory": {"~/cloud/synthetic/" + gone}}, 404, "directory_unavailable"},
		{url.Values{"directory": {"~/" + root + "/Raportit"}}, 404, "directory_unavailable"},
		{url.Values{"directory": {"~/" + root, "~/" + root}}, 400, "invalid_request"},
		{url.Values{"directory": {"~/" + root}, "path": {"x"}}, 400, "invalid_request"},
		{url.Values{"folder": {"Raportit"}}, 400, "invalid_request"},
	} {
		status, body, raw := read(tc.params)
		if status != tc.status || body["entries"] != nil || (tc.code != "" && !strings.Contains(raw, `"`+tc.code+`"`)) {
			t.Errorf("%v: %d %s", tc.params, status, raw)
		}
	}
	if status, _, raw := call(t, h, http.MethodPost, FilesPath+"?directory="+url.QueryEscape("~/"+root), "", nil); status != 400 {
		t.Fatalf("POST: %d %s", status, raw)
	}
	// A refused peer learns nothing, with or without a query.
	deny := c.Handler(func(*http.Request) bool { return false })
	for _, target := range []string{FilesPath, FilesPath + "?directory=" + url.QueryEscape("~/"+root)} {
		if status, _, raw := call(t, deny, http.MethodGet, target, "", nil); status != 403 || strings.Contains(raw, "muistio") {
			t.Fatalf("unauthorized %s: %d %s", target, status, raw)
		}
	}
}

// A folder's listing is bounded; the reply says when it was cut.
func TestFilesReadBoundsAFolder(t *testing.T) {
	dir := t.TempDir()
	for i := 0; i < maxFolderEntries+3; i++ {
		if err := os.WriteFile(filepath.Join(dir, fmt.Sprintf("f%04d", i)), nil, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	fd, err := syscall.Open(dir, syscall.O_RDONLY|syscall.O_DIRECTORY, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer syscall.Close(fd)
	entries, truncated, unlisted, err := listFolder(fd)
	if err != nil || len(entries) != maxFolderEntries || !truncated || unlisted != 0 || entries[0].Name != "f0000" {
		t.Fatalf("%d %v %d %v", len(entries), truncated, unlisted, err)
	}
}
