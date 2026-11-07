//go:build linux

package daemon

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/sys/unix"
)

// Exercise the agent HTTP boundary, including a mixed absolute/relative file
// package, rather than only the source-path parser.
func TestOfferAbs(t *testing.T) {
	for _, kind := range []string{"view", "file"} {
		for _, location := range []string{"inside", "outside"} {
			for _, directory := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/%s/dir=%v", kind, location, directory), func(t *testing.T) {
					h := viewFixture(t)
					base := filepath.Join(h.root, "src", "project")
					if location == "outside" {
						base = t.TempDir()
					}
					folder := filepath.Join(base, "report")
					if err := os.Mkdir(folder, 0700); err != nil {
						t.Fatal(err)
					}
					file := filepath.Join(folder, "index.html")
					if err := os.WriteFile(file, []byte("frozen"), 0600); err != nil {
						t.Fatal(err)
					}
					source := file
					if directory {
						source = folder
					}
					body := map[string]any{"idempotency_key": "22222222-2222-4222-8222-222222222222", "workspace_id": h.ws, "dry_run": true, "title": "Report"}
					var readPath string
					var handler http.Handler
					if kind == "view" {
						body["path"] = source
						if directory {
							body["entry"] = "index.html"
						}
						if code, v := offerView(t, h.c, h.q, body); code != 200 || !v.DryRun {
							t.Fatalf("dry: %d %+v", code, v)
						}
						body["dry_run"] = false
						code, v := offerView(t, h.c, h.q, body)
						if code != 200 || v.View.Files != 1 {
							t.Fatalf("offer: %d %+v", code, v)
						}
						if code, again := offerView(t, h.c, h.q, body); code != 200 || !again.Reused || again.View.ID != v.View.ID {
							t.Fatalf("replay: %d %+v", code, again)
						}
						handler = ViewExportHandler(h.cfg, func(*http.Request) bool { return true })
						readPath = ViewExportPath(v.View.ID, "index.html")
					} else {
						body["paths"] = []string{source, "notes.txt"}
						if code, v := offerFiles(t, h.c, h.q, body); code != 200 || !v.DryRun {
							t.Fatalf("dry: %d %+v", code, v)
						}
						body["dry_run"] = false
						code, v := offerFiles(t, h.c, h.q, body)
						if code != 200 || v.Offer.Files != 2 {
							t.Fatalf("offer: %d %+v", code, v)
						}
						if code, again := offerFiles(t, h.c, h.q, body); code != 200 || !again.Reused || again.Offer.ID != v.Offer.ID {
							t.Fatalf("replay: %d %+v", code, again)
						}
						handler = FileOffersHandler(h.cfg, func(*http.Request) bool { return true })
						name := "index.html"
						if directory {
							name = "report/index.html"
						}
						readPath = FileOffersPath + "/" + v.Offer.ID + "/files/" + name
					}
					if err := os.Remove(file); err != nil {
						t.Fatal(err)
					}
					if w := readExport(handler, readPath); w.Code != 200 || w.Body.String() != "frozen" {
						t.Fatalf("frozen: %d %q", w.Code, w.Body.String())
					}
				})
			}
		}
	}
}

// Only opens kernel-provided directories; never reads device contents or
// changes mounts. This distinguishes an explicitly named filesystem from a
// mount crossed below a named source without privileged test setup.
func TestOfferAbsMount(t *testing.T) {
	var dev, shm unix.Stat_t
	if unix.Stat("/dev", &dev) != nil || unix.Stat("/dev/shm", &shm) != nil || dev.Dev == shm.Dev {
		t.Skip("requires /dev/shm mounted separately from /dev")
	}
	fd, err := openOfferSource(-1, "/dev/shm", "")
	if err != nil {
		t.Fatalf("explicit mount root: %v", err)
	}
	unix.Close(fd)
	fd, err = openOfferSource(-1, "/dev", "shm")
	if err == nil {
		unix.Close(fd)
	}
	if !errors.Is(err, unix.EXDEV) {
		t.Fatalf("descendant mount: %v", err)
	}
}

func TestOffersRefuseUnsafeAbsoluteSources(t *testing.T) {
	h := viewFixture(t)
	outside := t.TempDir()
	fifo := filepath.Join(outside, "pipe.html")
	if err := unix.Mkfifo(fifo, 0600); err != nil {
		t.Fatal(err)
	}
	// Ancestor and leaf links are refused, as are links encountered in a walk.
	for _, source := range []string{
		filepath.Join(h.root, "src", "project", "leak.html"),
		filepath.Join(h.root, "src", "project", "linked-site-dir", "token.html"),
		filepath.Join(h.root, "src", "project", "linked-site"),
		fifo,
	} {
		t.Run(filepath.Base(source), func(t *testing.T) {
			body := map[string]any{"idempotency_key": "22222222-2222-4222-8222-222222222222", "workspace_id": h.ws, "path": source, "entry": "index.html"}
			code, v := offerView(t, h.c, h.q, body)
			if code != 400 || (v.Error.Code != "unsafe_view_source" && v.Error.Code != "view_source_symlink" && v.Error.Code != "unsupported_view_source") {
				t.Fatalf("view: %d %+v", code, v)
			}
			delete(body, "path")
			delete(body, "entry")
			body["paths"] = []string{source}
			code, f := offerFiles(t, h.c, h.q, body)
			if code != 400 || (f.Error.Code != "unsafe_file_source" && f.Error.Code != "file_source_symlink" && f.Error.Code != "unsupported_file_source") {
				t.Fatalf("file: %d %+v", code, f)
			}
		})
	}
}
