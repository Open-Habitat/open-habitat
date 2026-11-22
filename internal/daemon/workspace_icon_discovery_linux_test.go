//go:build linux

package daemon

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/sys/unix"
)

func TestRepositoryIconContentReachesSuggestionModel(t *testing.T) {
	for _, tc := range []struct {
		name, path, content, readme string
	}{
		{"public favicon", "public/favicon.svg", iconSVG, ""},
		{"assets logo", "assets/logo.png", iconPNG, ""},
		{"agent icon", ".agents/icon.svg", iconSVG, ""},
		{"app icon", "public/icons/icon.png", iconPNG, ""},
		{"readme markdown", "brand/product-mark.svg", iconSVG, "# Product\n\n![Product logo](brand/product-mark.svg)"},
		{"readme html", "brand/product-mark.svg", iconSVG, `<img alt="Product logo" src="brand/product-mark.svg">`},
		{"paired quotes", "brand/product-mark.svg", iconSVG, `<img alt="Acme's logo" src="brand/product-mark.svg" data-src="missing.svg">`},
		{"document order", "brand/product-mark.svg", iconSVG, "<img alt='logo' src='brand/product-mark.svg'>\n![logo](missing.svg)"},
		{"invalid placeholder", "public/favicon.svg", iconSVG, ""},
		{"none", "", "", "# Product\nNo image."},
		{"screenshot not identity", "docs/screen.png", iconPNG, "![Screenshot](docs/screen.png)"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := newHeldHarness(t)
			c, stop := h.daemon()
			defer stop()
			project := filepath.Join(h.root, "src", "project")
			files := map[string]string{"README.md": tc.readme}
			if tc.path != "" {
				files[tc.path] = tc.content
			}
			if tc.name == "invalid placeholder" {
				files["logo.png"] = "version https://git-lfs.github.com/spec/v1\n"
			}
			iconTree(t, project, files)
			iconTree(t, filepath.Join(h.root, "src", "other"), map[string]string{"logo.svg": strings.ReplaceAll(iconSVG, "rect", "circle")})
			want := tc.path
			if tc.name == "screenshot not identity" {
				want = ""
			}
			c.iconSuggester = func(_ context.Context, b []byte) (string, string, []iconSuggestion, error) {
				var input struct {
					Facts       iconFacts
					Attachments []map[string]string `json:"repository_icon"`
				}
				if err := json.Unmarshal(b, &input); err != nil {
					t.Fatal(err)
				}
				if input.Facts.Logo != want {
					t.Fatalf("logo = %q, want %q", input.Facts.Logo, want)
				}
				if want == "" {
					if len(input.Attachments) != 0 {
						t.Fatal("borrowed another workspace's image")
					}
					var other string
					for _, w := range c.iconWorkspaces() {
						if w["name"] == "other" {
							other = w["logo"]
						}
					}
					return "synthetic/fixture", "", []iconSuggestion{{other, "wrong workspace"}, {"P", "name"}}, nil
				}
				if len(input.Attachments) != 2 {
					t.Fatalf("missing image content: %+v", input.Attachments)
				}
				content := input.Attachments[1]
				if strings.HasSuffix(want, ".svg") {
					if content["type"] != "text" || !strings.HasSuffix(content["text"], tc.content) {
						t.Fatal("SVG source not supplied")
					}
				} else if content["type"] != "image" || content["mimeType"] != "image/png" || content["data"] != base64.StdEncoding.EncodeToString([]byte(tc.content)) {
					t.Fatalf("raster bytes not supplied: %+v", content)
				}
				return "synthetic/fixture", "", []iconSuggestion{{want, "repository"}}, nil
			}
			body := fmt.Sprintf(`{"schema_version":1,"workspace_id":%q,"wish":"","history":[]}`, h.workspace)
			code, out := postIconSuggestions(t, c, body)
			if code != 200 || out.State != "done" {
				t.Fatalf("%d %+v", code, out)
			}
			if want == "" && (len(out.Suggestions) != 1 || out.Suggestions[0].Icon != "P") {
				t.Fatalf("unrequested other logo: %+v", out)
			}
			if want != "" && (out.Suggestions[0].Icon != want || out.Seen["logo"] != want) {
				t.Fatalf("lost own icon: %+v", out)
			}
		})
	}
}

func TestReadmeIconDiscoveryStaysInsideRepository(t *testing.T) {
	for _, path := range []string{"../outside/logo.svg", "https://example.invalid/logo.svg", "/logo.svg", "linked/logo.svg", "pipe.svg", "large.svg"} {
		t.Run(path, func(t *testing.T) {
			root := t.TempDir()
			outside := t.TempDir()
			iconTree(t, outside, map[string]string{"logo.svg": iconSVG})
			iconTree(t, root, map[string]string{"README.md": "![logo](" + path + ")", "large.svg": strings.Repeat("x", maxWorkspaceIcon+1)})
			if err := os.Symlink(outside, filepath.Join(root, "linked")); err != nil {
				t.Fatal(err)
			}
			if err := unix.Mkfifo(filepath.Join(root, "pipe.svg"), 0600); err != nil {
				t.Fatal(err)
			}
			f, err := os.Open(root)
			if err != nil {
				t.Fatal(err)
			}
			defer f.Close()
			if got := readWorkspaceIcon(unix.Openat2, int(f.Fd())); got.LogoPath != "" {
				t.Fatalf("accepted unsafe candidate: %+v", got)
			}
		})
	}
}
