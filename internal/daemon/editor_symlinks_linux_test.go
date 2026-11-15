//go:build linux

package daemon

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestEditorSymlinkListingReadBrowseAndSave(t *testing.T) {
	_, id, root, h := editorFixture(t)
	if err := os.Mkdir(filepath.Join(root, "folder"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "folder", "text"), []byte("original"), 0600); err != nil {
		t.Fatal(err)
	}
	links := map[string]string{
		"file-link": "folder/text", "folder-link": "folder", "chain": "file-link",
		"broken": "absent", "outside": "../secret", "absolute": "/etc/passwd",
		"loop": "loop", "protected": ".git/config", "parent-link": "folder/../folder/text",
	}
	if err := os.Mkdir(filepath.Join(root, ".git"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, ".git", "config"), []byte("private"), 0600); err != nil {
		t.Fatal(err)
	}
	for name, target := range links {
		if err := os.Symlink(target, filepath.Join(root, name)); err != nil {
			t.Fatal(err)
		}
	}
	status, listing := editorCall(h, "GET", "list", id, "", nil)
	if status != 200 {
		t.Fatal(status, listing)
	}
	seen := map[string]map[string]any{}
	for _, v := range listing["entries"].([]any) {
		entry := v.(map[string]any)
		seen[entry["name"].(string)] = entry
	}
	for name, target := range links {
		entry := seen[name]
		if entry["symlink_target"] != target {
			t.Fatalf("link %s: %#v", name, entry)
		}
	}
	for name, reason := range map[string]string{"broken": "broken_link", "outside": "outside_workspace", "absolute": "outside_workspace", "loop": "symlink_loop", "protected": "file_unavailable"} {
		if seen[name]["kind"] != "unsupported" || seen[name]["unavailable_reason"] != reason {
			t.Fatalf("%s: %#v", name, seen[name])
		}
		for _, op := range []string{"file", "stat", "list"} {
			if status, _ := editorCall(h, "GET", op, id, name, nil); status < 400 {
				t.Fatalf("opened %s via %s", name, op)
			}
		}
		if status, _ := editorCall(h, "PUT", "file", id, "", saveInput(id, name, "sha256:v1:"+strings.Repeat("0", 64), "bad", false, "none")); status != 404 {
			t.Fatalf("saved %s", name)
		}
	}
	for _, name := range []string{"missing", "folder/missing", "missing/child"} {
		status, out := editorCall(h, "GET", "file", id, name, nil)
		if status != 404 || out["error"].(map[string]any)["code"] != "file_unavailable" {
			t.Fatal("ordinary missing file misclassified", status, out)
		}
	}
	if seen["file-link"]["kind"] != "file" || seen["folder-link"]["kind"] != "directory" {
		t.Fatal(seen)
	}
	if status, out := editorCall(h, "GET", "list", id, "folder-link", nil); status != 200 || len(out["entries"].([]any)) != 1 {
		t.Fatal(status, out)
	}
	for _, name := range []string{"file-link", "folder-link/text", "chain", "parent-link"} {
		status, read := editorCall(h, "GET", "file", id, name, nil)
		if status != 200 {
			t.Fatal(name, status, read)
		}
		status, saved := editorCall(h, "PUT", "file", id, "", saveInput(id, name, read["version"].(string), "saved", false, "none"))
		if status != 200 {
			t.Fatal(name, status, saved)
		}
		status, again := editorCall(h, "GET", "file", id, name, nil)
		if status != 200 || again["content"] != "saved" || again["version"] != saved["version"] {
			t.Fatal(name, status, again)
		}
	}
	for name, target := range links {
		got, err := os.Readlink(filepath.Join(root, name))
		if err != nil || got != target {
			t.Fatalf("link replaced %s: %s %v", name, got, err)
		}
	}
}

func TestEditorSymlinkSwapDuringSave(t *testing.T) {
	for _, replacement := range []string{"outside", "inside", "broken", "loop"} {
		t.Run(replacement, func(t *testing.T) {
			c, id, root, h := editorFixture(t)
			outside := filepath.Join(t.TempDir(), "text")
			for _, name := range []string{filepath.Join(root, "text"), filepath.Join(root, "other"), outside} {
				if err := os.WriteFile(name, []byte("original"), 0600); err != nil {
					t.Fatal(err)
				}
			}
			link := filepath.Join(root, "link")
			if err := os.Symlink("text", link); err != nil {
				t.Fatal(err)
			}
			_, read := editorCall(h, "GET", "file", id, "link", nil)
			c.editorFileTest = &editorFileTestHooks{beforeCheck: func() {
				target := map[string]string{"outside": outside, "inside": "other", "broken": "missing", "loop": "link"}[replacement]
				if err := os.Remove(link); err != nil {
					t.Fatal(err)
				}
				if err := os.Symlink(target, link); err != nil {
					t.Fatal(err)
				}
			}}
			status, out := editorCall(h, "PUT", "file", id, "", saveInput(id, "link", read["version"].(string), "bad", false, "none"))
			if status < 400 {
				t.Fatal(status, out)
			}
			for _, name := range []string{filepath.Join(root, "text"), filepath.Join(root, "other"), outside} {
				got, err := os.ReadFile(name)
				if err != nil || string(got) != "original" {
					t.Fatal(name, string(got), err)
				}
			}
		})
	}
}
