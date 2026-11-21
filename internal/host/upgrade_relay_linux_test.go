//go:build linux

package host

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
)

// Run as root only in the disposable networkless container: use the real
// root-owned-file verifier, not a mocked digest or relaxed ownership predicate.
func TestUpgradeProductRelay(t *testing.T) {
	if os.Getenv("HOST_INIT_UID_CONTAINER") != "1" || os.Geteuid() != 0 {
		t.Skip("requires root in the disposable host initialization container")
	}
	t.Setenv("TMPDIR", "/root")
	for _, layout := range []string{"archive", "generation"} {
		for _, change := range []string{"none", "missing", "tampered", "symlink", "foreign-owner", "private-mode", "unlisted"} {
			t.Run(layout+"/"+change, func(t *testing.T) {
				root := t.TempDir()
				bin := root
				if layout == "archive" {
					bin = filepath.Join(root, "bin")
				}
				web := filepath.Join(root, "web")
				for _, dir := range []string{bin, web} {
					if err := os.MkdirAll(dir, 0755); err != nil {
						t.Fatal(err)
					}
				}
				var product []ProductFile
				for _, name := range []string{"open-habitat", "open-habitat-mcp-relay", "web/index.html"} {
					data := []byte("synthetic product bytes: " + name)
					path, mode := filepath.Join(bin, name), os.FileMode(0755)
					if name == "web/index.html" {
						path, mode = filepath.Join(root, name), 0644
					}
					if err := os.WriteFile(path, data, mode); err != nil {
						t.Fatal(err)
					}
					if err := os.Chmod(path, mode); err != nil {
						t.Fatal(err)
					}
					h := sha256.Sum256(data)
					product = append(product, ProductFile{name, hex.EncodeToString(h[:]), uint32(mode)})
				}
				relay := filepath.Join(bin, "open-habitat-mcp-relay")
				var err error
				switch change {
				case "missing":
					err = os.Remove(relay)
				case "tampered":
					err = os.WriteFile(relay, []byte("replacement"), 0755)
				case "symlink":
					if err = os.Rename(relay, relay+".real"); err == nil {
						err = os.Symlink(relay+".real", relay)
					}
				case "foreign-owner":
					err = os.Chown(relay, 21032, 21032)
				case "private-mode":
					err = os.Chmod(relay, 0700)
				case "unlisted":
					product = append(product[:1], product[2:]...)
				}
				if err != nil {
					t.Fatal(err)
				}
				err = verifyUpgradeProductFiles(context.Background(), filepath.Join(bin, "open-habitat"), web, product)
				if (err == nil) != (change == "none") {
					t.Fatalf("verification: %v", err)
				}
			})
		}
	}
}
