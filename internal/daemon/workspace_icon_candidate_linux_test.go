//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/sys/unix"
)

func TestIconCandidatesResolveOwnWorkspaceAndUploads(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	cfg := c.cfg
	cfg.Home = c.home
	project := filepath.Join(h.root, "src", "project")
	iconTree(t, project, map[string]string{"brand/mark.svg": iconSVG, "bad.png": "not a picture", "large.png": strings.Repeat("x", maxWorkspaceIcon+1)})
	iconTree(t, filepath.Join(h.root, "src", "other"), map[string]string{"logo.svg": iconSVG})
	var other string
	for _, w := range c.iconWorkspaces() {
		if w["name"] == "other" {
			other = w["logo"]
		}
	}
	if other == "" {
		t.Fatal("other workspace's logo missing")
	}
	const upload = "00000000-0000-4000-8000-000000000001"
	root, err := attachmentRoot(h.root)
	if err != nil {
		t.Fatal(err)
	}
	root.Close()
	if err := os.WriteFile(filepath.Join(h.root, "attachments", upload), []byte(iconPNG), 0600); err != nil {
		t.Fatal(err)
	}
	for _, value := range []string{other, "workspace:" + h.workspace + ":brand/mark.svg", "attachment:" + upload} {
		image, typ, err := readIconCandidate(context.Background(), cfg, value)
		if err != nil || len(image.data) == 0 || typ == "" || !strings.HasPrefix(image.path, ".open-habitat-icon-") {
			t.Fatalf("%s: %+v %s %v", value, image, typ, err)
		}
	}
	if err := os.Symlink(filepath.Join(project, "brand/mark.svg"), filepath.Join(project, "link.svg")); err != nil {
		t.Fatal(err)
	}
	if err := unix.Mkfifo(filepath.Join(project, "pipe.png"), 0600); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"../project/brand/mark.svg", "/etc/logo.svg", "link.svg", "pipe.png", "bad.png", "large.png", "missing.svg", "brand"} {
		if _, _, err := readIconCandidate(context.Background(), cfg, "workspace:"+h.workspace+":"+path); err == nil {
			t.Fatalf("accepted %s", path)
		}
	}
	for _, value := range []string{"workspace:ws_unknown123:logo.svg", "attachment:../secret", "https://example.invalid/a.png"} {
		if _, _, err := readIconCandidate(context.Background(), cfg, value); err == nil {
			t.Fatalf("accepted %s", value)
		}
	}
	// The model can select a listed logo or the file named by the person, but
	// cannot bypass the reader with an invented, escaping or non-image reference.
	c.iconSuggester = func(_ context.Context, input []byte) (string, string, []iconSuggestion, error) {
		var facts map[string]any
		if json.Unmarshal(input, &facts) != nil || facts["workspaces"] == nil {
			t.Fatal("missing workspace catalogue")
		}
		return "synthetic/fixture", "", []iconSuggestion{{other, "logo"}, {"workspace:" + h.workspace + ":brand/mark.svg", "named file"}, {"workspace:" + h.workspace + ":../secret.svg", "escape"}, {"🦉", "owl"}}, nil
	}
	body := fmt.Sprintf(`{"schema_version":1,"workspace_id":%q,"wish":%q,"history":[]}`, h.workspace, "other logo /api/v1/attachments/"+upload)
	code, reply := postIconSuggestions(t, c, body)
	if code != 200 || reply.State != "done" || len(reply.Suggestions) != 4 || reply.Suggestions[0].Icon != "attachment:"+upload || reply.Suggestions[1].Icon != other {
		t.Fatalf("%d %+v", code, reply)
	}
	// Suggesting reads only: no copied image is created until selection.
	files, _ := filepath.Glob(filepath.Join(project, ".open-habitat-icon-*"))
	if len(files) != 0 {
		t.Fatal("suggestion wrote repository files")
	}
}

func TestIconCandidateCopyTravelsWithConfigCommit(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	cfg := c.cfg
	cfg.Home = c.home
	project := filepath.Join(h.root, "src", "project")
	iconTree(t, filepath.Join(h.root, "src", "other"), map[string]string{"logo.svg": iconSVG})
	var ref string
	for _, w := range c.iconWorkspaces() {
		if w["name"] == "other" {
			ref = w["logo"]
		}
	}
	image, _, err := readIconCandidate(context.Background(), cfg, ref)
	if err != nil {
		t.Fatal(err)
	}
	ws, _, err := c.workspaceFD(h.workspace)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.Close()
	fd := int(ws.Fd())
	for _, args := range [][]string{{"init", "--quiet"}, {"config", "user.name", "Synthetic"}, {"config", "user.email", "test@example.invalid"}} {
		if _, err := iconGit(context.Background(), h.root, fd, args...); err != nil {
			t.Fatal(err)
		}
	}
	config := filepath.Join(project, workspaceConfigName)
	if err := os.WriteFile(config, []byte("icon: X\nicon: Y\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := setWorkspaceIcon(context.Background(), h.root, fd, "git_main_worktree", image.path, image); err != errIconConfig {
		t.Fatalf("invalid config: %v", err)
	}
	if _, err := os.Stat(filepath.Join(project, image.path)); !os.IsNotExist(err) {
		t.Fatal("refused config left an image")
	}
	if err := os.Remove(config); err != nil {
		t.Fatal(err)
	}
	outcome, err := setWorkspaceIcon(context.Background(), h.root, fd, "git_main_worktree", image.path, image)
	if err != nil || outcome != iconCommitted {
		t.Fatalf("%s %v", outcome, err)
	}
	for path, want := range map[string]string{image.path: iconSVG, workspaceConfigName: "icon: \"" + image.path + "\"\n"} {
		got, err := iconGit(context.Background(), h.root, fd, "show", "HEAD:"+path)
		if err != nil || string(got) != want {
			t.Fatalf("committed %s: %q %v", path, got, err)
		}
	}
	if err := os.Remove(filepath.Join(h.root, "src", "other", "logo.svg")); err != nil {
		t.Fatal(err)
	}
	if b, err := os.ReadFile(filepath.Join(project, image.path)); err != nil || string(b) != iconSVG {
		t.Fatal("copy depends on source")
	}
	// Attributes must not cause filter execution or a raw image commit that
	// disagrees with the person's normal Git workflow.
	if err := os.WriteFile(filepath.Join(project, ".gitattributes"), []byte("*.svg filter=example\n"), 0600); err != nil {
		t.Fatal(err)
	}
	filtered := iconImage{".open-habitat-icon-filtered.svg", []byte(iconSVG)}
	if outcome, err := setWorkspaceIcon(context.Background(), h.root, fd, "git_main_worktree", filtered.path, filtered); err != nil || outcome != iconUncommitted {
		t.Fatalf("filtered image: %s %v", outcome, err)
	}
	if _, err := iconGit(context.Background(), h.root, fd, "show", "HEAD:"+filtered.path); err == nil {
		t.Fatal("committed a filtered image as raw bytes")
	}
	// An existing conflicting/symlink target is never overwritten.
	if err := os.Remove(filepath.Join(project, image.path)); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("brand.svg", filepath.Join(project, image.path)); err != nil {
		t.Fatal(err)
	}
	if err := storeIconImage(fd, image); err == nil {
		t.Fatal("accepted symlink destination")
	}
}
