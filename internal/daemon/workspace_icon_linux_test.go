//go:build linux

package daemon

import (
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/sys/unix"
)

const iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4"/></svg>`
const iconPNG = "\x89PNG\r\n\x1a\nrest"

func iconTree(t *testing.T, root string, files map[string]string) {
	t.Helper()
	for path, text := range files {
		full := filepath.Join(root, path)
		if err := os.MkdirAll(filepath.Dir(full), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(text), 0600); err != nil {
			t.Fatal(err)
		}
	}
}

// The chain: the committed config's icon, else a logo on the fixed list,
// else nothing. Nothing is reached through a symlink or past the size bound,
// and a config icon that is not a short emoji or an existing image is
// skipped rather than trusted.
func TestWorkspaceIconChain(t *testing.T) {
	home := t.TempDir()
	src := filepath.Join(home, "src")
	outside := filepath.Join(home, "outside")
	iconTree(t, outside, map[string]string{"logo.svg": iconSVG})
	iconTree(t, filepath.Join(src, "emoji"), map[string]string{".open-habitat.yaml": "# Open Habitat\nicon: \"🤖\"\nfuture: [1, 2]\n", "logo.svg": iconSVG})
	iconTree(t, filepath.Join(src, "sequence"), map[string]string{".open-habitat.yaml": "icon: 👩‍💻\n"})
	iconTree(t, filepath.Join(src, "image"), map[string]string{".open-habitat.yaml": "icon: ./brand/mark.png\n", "brand/mark.png": iconPNG, "logo.svg": iconSVG})
	iconTree(t, filepath.Join(src, "logo"), map[string]string{"design-system/favicon.svg": iconSVG, "docs/logo.svg": iconSVG})
	iconTree(t, filepath.Join(src, "missing"), map[string]string{".open-habitat.yaml": "icon: brand/none.svg\n", "public/logo.png": iconPNG})
	iconTree(t, filepath.Join(src, "words"), map[string]string{".open-habitat.yaml": "icon: hello world\n"})
	iconTree(t, filepath.Join(src, "list"), map[string]string{".open-habitat.yaml": "icon: [🤖]\n"})
	iconTree(t, filepath.Join(src, "escape"), map[string]string{".open-habitat.yaml": "icon: ../outside/logo.svg\n"})
	iconTree(t, filepath.Join(src, "big"), map[string]string{"logo.svg": "<svg>" + strings.Repeat(" ", maxWorkspaceIcon) + "</svg>"})
	iconTree(t, filepath.Join(src, "plain"), map[string]string{"README.md": "x\n"})
	iconTree(t, filepath.Join(src, "letters"), map[string]string{".open-habitat.yaml": "icon: oh\n"})
	iconTree(t, filepath.Join(src, "auto"), map[string]string{".open-habitat.yaml": "icon: auto\n", "static/logo.png": iconPNG})
	iconTree(t, filepath.Join(src, "autonone"), map[string]string{".open-habitat.yaml": "icon: auto\n"})
	for _, link := range []struct{ target, at string }{
		{filepath.Join(outside, "logo.svg"), filepath.Join(src, "linked", "logo.svg")},
		{outside, filepath.Join(src, "linkdir", "public")},
		{filepath.Join(outside, "logo.svg"), filepath.Join(src, "linkcfg", "mark.svg")},
	} {
		if err := os.MkdirAll(filepath.Dir(link.at), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.Symlink(link.target, link.at); err != nil {
			t.Fatal(err)
		}
	}
	iconTree(t, filepath.Join(src, "linkcfg"), map[string]string{".open-habitat.yaml": "icon: mark.svg\n"})
	got := map[string]workspaceIcon{}
	for _, e := range DiscoverFixtureRoot(home, os.Geteuid()).Entries {
		got[e.Name] = e.Icon
	}
	want := map[string]workspaceIcon{
		"emoji":    {Kind: "emoji", Value: "🤖", Source: "config"},
		"sequence": {Kind: "emoji", Value: "👩‍💻", Source: "config"},
		"image":    {Kind: "image", Path: "brand/mark.png", Source: "config"},
		"logo":     {Kind: "image", Path: "design-system/favicon.svg", Source: "logo"},
		"missing":  {Kind: "image", Path: "public/logo.png", Source: "logo"},
		"words":    {}, "list": {}, "escape": {}, "big": {}, "plain": {},
		"linked": {}, "linkdir": {}, "linkcfg": {},
		"letters":  {Kind: "letters", Value: "OH", Source: "config"},
		"auto":     {Kind: "image", Path: "static/logo.png", Source: "logo", Auto: true},
		"autonone": {Auto: true},
	}
	for name, w := range want {
		g := got[name]
		if g.Kind != w.Kind || g.Value != w.Value || g.Path != w.Path || g.Source != w.Source || g.Auto != w.Auto || (g.Kind == "image") != (len(g.Version) == 16) {
			t.Errorf("%s: %+v, want %+v", name, g, w)
		}
	}
	// The logo is known whatever the config says, for the picker.
	if g := got["emoji"]; g.LogoPath != "logo.svg" || len(g.LogoVersion) != 16 {
		t.Errorf("emoji's logo: %+v", g)
	}
	// Only the listing pays for icons; resolving a workspace does not.
	for _, e := range scan(home, os.Geteuid(), unix.Openat2, false).Entries {
		if e.Icon != (workspaceIcon{}) {
			t.Fatalf("%s: icon read outside the listing: %+v", e.Name, e.Icon)
		}
	}
	before := got["image"].Version
	iconTree(t, filepath.Join(src, "image"), map[string]string{"brand/mark.png": iconPNG + "changed"})
	for _, e := range DiscoverFixtureRoot(home, os.Geteuid()).Entries {
		if e.Name == "image" && e.Icon.Version == before {
			t.Fatal("a changed image kept its version")
		}
	}
}

// The image route chooses the image again from the repository, serves it only
// when its bytes are what its name says, and never as anything but an image.
func TestWorkspaceIconHandlerServesOnlyTheChosenImage(t *testing.T) {
	h := newHeldHarness(t)
	src := filepath.Join(h.root, "src")
	iconTree(t, filepath.Join(src, "brand"), map[string]string{"design-system/favicon.svg": iconSVG})
	iconTree(t, filepath.Join(src, "liar"), map[string]string{"logo.png": "<svg><script>alert(1)</script></svg>"})
	iconTree(t, filepath.Join(src, "glyph"), map[string]string{".open-habitat.yaml": "icon: 🦊\n"})
	handler := WorkspaceIconHandler(h.cfg, func(*http.Request) bool { return true })
	id := composerWorkspaceID(t, h, "brand")
	w := composerGet(handler, WorkspaceIconPath, url.Values{"workspace_id": {id}, "v": {"0123456789abcdef"}})
	if w.Code != 200 || w.Body.String() != iconSVG || w.Header().Get("Content-Type") != "image/svg+xml" || w.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("logo: %d %v %q", w.Code, w.Header(), w.Body.String())
	}
	// logo=1 serves the logo even when the config chose something else.
	iconTree(t, filepath.Join(src, "brand"), map[string]string{".open-habitat.yaml": "icon: 🦊\n"})
	if w = composerGet(handler, WorkspaceIconPath, url.Values{"workspace_id": {id}, "v": {"0123456789abcdef"}, "logo": {"1"}}); w.Code != 200 || w.Body.String() != iconSVG {
		t.Fatalf("logo=1: %d", w.Code)
	}
	if w = composerGet(handler, WorkspaceIconPath, url.Values{"workspace_id": {id}}); w.Code != 404 {
		t.Fatalf("emoji config still served the logo as the icon: %d", w.Code)
	}
	if w = composerGet(handler, WorkspaceIconPath, url.Values{"workspace_id": {composerWorkspaceID(t, h, "glyph")}, "logo": {"1"}}); w.Code != 404 {
		t.Fatalf("logo=1 without a logo: %d", w.Code)
	}
	for _, name := range []string{"liar", "glyph"} {
		w = composerGet(handler, WorkspaceIconPath, url.Values{"workspace_id": {composerWorkspaceID(t, h, name)}})
		if w.Code != 404 || strings.Contains(w.Body.String(), "script") {
			t.Fatalf("%s: %d %s", name, w.Code, w.Body.String())
		}
	}
	for _, q := range []url.Values{{}, {"workspace_id": {"../x"}}, {"workspace_id": {id}, "path": {"logo.svg"}}, {"workspace_id": {id}, "v": {strings.Repeat("a", 65)}}, {"workspace_id": {id}, "logo": {"0"}}, {"workspace_id": {id}, "logo": {"1"}, "path": {"x"}}} {
		if w = composerGet(handler, WorkspaceIconPath, q); w.Code != 400 {
			t.Fatalf("%v: %d", q, w.Code)
		}
	}
}
