//go:build linux

package browserhost

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"
)

// Opt-in real Chromium check. No Playwright default flags or CDP download
// overrides: either would mask the settings this test is meant to exercise.
func TestPreferencesNativeSites(t *testing.T) {
	chrome := os.Getenv("OH_SITE_SETTINGS_CHROME")
	if chrome == "" {
		t.Skip("set OH_SITE_SETTINGS_CHROME to a sandbox-capable Chromium executable")
	}
	for _, seeded := range []bool{false, true} {
		t.Run(fmt.Sprintf("seeded=%t", seeded), func(t *testing.T) {
			profile := filepath.Join(t.TempDir(), "profile")
			if err := preparePreferences(profile); err != nil {
				t.Fatal(err)
			}
			if !seeded {
				// Same download path, but Chrome's ordinary popup/multiple-file defaults.
				path := filepath.Join(profile, "Default", "Preferences")
				b, err := os.ReadFile(path)
				if err != nil {
					t.Fatal(err)
				}
				b = bytes.Replace(b, []byte(`"popups":1`), []byte(`"popups":2`), 1)
				b = bytes.Replace(b, []byte(`"automatic_downloads":1`), []byte(`"automatic_downloads":3`), 1)
				if err := os.WriteFile(path, b, 0o600); err != nil {
					t.Fatal(err)
				}
			}
			var popup, ran, denied atomic.Bool
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch r.URL.Path {
				case "/popup":
					popup.Store(true)
					fmt.Fprint(w, "synthetic popup")
				case "/ran":
					ran.Store(true)
					denied.Store(r.URL.Query().Get("notification") == "denied")
				default:
					w.Header().Set("Content-Type", "text/html")
					fmt.Fprint(w, `<script>
setTimeout(() => {
 window.open('/popup', '_blank');
 for (const name of ['one.txt', 'two.txt']) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([name], {type:'text/plain'}));
  a.download = name; a.click();
 }
 fetch('/ran?notification=' + Notification.permission);
}, 300);
</script>`)
				}
			}))
			defer srv.Close()
			ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
			defer cancel()
			read, input, err := os.Pipe()
			if err != nil {
				t.Fatal(err)
			}
			defer read.Close()
			defer input.Close()
			output, write, err := os.Pipe()
			if err != nil {
				t.Fatal(err)
			}
			defer output.Close()
			defer write.Close()
			cfg := Config{Profile: profile, Cache: filepath.Join(profile, "Cache"), Width: 1000, Height: 800,
				ChromeArgs: []string{"--headless", srv.URL}}
			cmd := exec.CommandContext(ctx, chrome, chromeArgs(cfg)...)
			cmd.ExtraFiles = []*os.File{read, write}
			var stderr bytes.Buffer
			cmd.Stderr = &stderr
			if err := cmd.Start(); err != nil {
				t.Fatal(err)
			}
			read.Close()
			write.Close()
			go io.Copy(io.Discard, output)
			done := make(chan error, 1)
			go func() { done <- cmd.Wait() }()
			defer func() { cancel(); <-done }()
			deadline := time.Now().Add(12 * time.Second)
			count := 0
			for time.Now().Before(deadline) {
				count = 0
				for _, name := range []string{"one.txt", "two.txt"} {
					b, err := os.ReadFile(filepath.Join(profile, "Downloads", name))
					if err == nil && string(b) == name {
						count++
					}
				}
				if seeded && ran.Load() && popup.Load() && count == 2 {
					break
				}
				select {
				case err := <-done:
					done <- err
					t.Fatalf("Chrome exited: %v: %s", err, stderr.String())
				default:
				}
				time.Sleep(50 * time.Millisecond)
			}
			if !ran.Load() || !denied.Load() {
				t.Fatal("JavaScript did not run or notification default not blocked")
			}
			if seeded && (!popup.Load() || count != 2) {
				t.Fatalf("configured browser: popup=%t downloads=%d", popup.Load(), count)
			}
			if !seeded && (popup.Load() || count != 1) {
				t.Fatalf("negative control: popup=%t downloads=%d", popup.Load(), count)
			}
			// Let Chrome rewrite its native preferences, then prove our seed marker
			// survives that write and the next host start leaves the file alone.
			if _, err := fmt.Fprint(input, "{\"id\":1,\"method\":\"Browser.close\"}\x00"); err != nil {
				t.Fatal(err)
			}
			err = <-done
			done <- err // the cleanup still reaps/cancels on every assertion path
			if err != nil {
				t.Fatalf("Chrome close: %v", err)
			}
			path := filepath.Join(profile, "Default", "Preferences")
			before, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			if !bytes.Contains(before, []byte(`"open_habitat_site_defaults":true`)) {
				t.Fatal("Chrome discarded seed marker")
			}
			if err := preparePreferences(profile); err != nil {
				t.Fatal(err)
			}
			after, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			if !bytes.Equal(before, after) {
				t.Fatal("restart rewrote Chrome preferences")
			}
			t.Logf("popup=%t complete_downloads=%d notifications_denied=%t marker_survived=true", popup.Load(), count, denied.Load())
		})
	}
}
