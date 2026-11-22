//go:build linux

package host

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
	"time"
)

type fakeApt struct {
	root      string
	candidate string
	fail      string
	calls     [][]string
}

func (f *fakeApt) run(_ context.Context, _ time.Duration, path string, args ...string) ([]byte, error) {
	call := append([]string{filepath.Base(path)}, args...)
	f.calls = append(f.calls, call)
	switch {
	case f.fail != "" && slices.Contains(call, f.fail):
		return nil, ErrNativeApply
	case call[0] == "apt-cache":
		return []byte(serverBrowserPackage + ":\n  Installed: (none)\n  Candidate: " + f.candidate + "\n"), nil
	case call[0] == "apt-get" && call[1] != "--simulate" && slices.Contains(call, "install"):
		p := filepath.Join(f.root, serverBrowserChrome)
		_ = os.MkdirAll(filepath.Dir(p), 0o755)
		return nil, os.WriteFile(p, nil, 0o755)
	}
	return nil, nil
}

func TestServerBrowserLeavesAnInstalledChromeToApt(t *testing.T) {
	root := t.TempDir()
	p := filepath.Join(root, serverBrowserChrome)
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, nil, 0o755); err != nil {
		t.Fatal(err)
	}
	apt := &fakeApt{root: root}
	installed, err := installServerBrowser(context.Background(), root, "arm64", apt.run)
	if installed || err != nil || len(apt.calls) != 0 {
		t.Fatalf("installed=%v err=%v calls=%v", installed, err, apt.calls)
	}
}

// An administrator's own Google source is used as it is, only Google's index
// is refreshed, and nothing older than the qualified Chrome is installed.
func TestServerBrowserInstallsFromTheExistingGoogleSource(t *testing.T) {
	for _, tc := range []struct {
		candidate, fail string
		want            error
	}{
		{"158.0.8127.36-1", "", nil},
		{"120.0.6099.71-1", "", errServerBrowserCandidate},
		{"158.0.8127.36-1", "update", errServerBrowserSource},
		{"158.0.8127.36-1", "--simulate", errServerBrowserSolve},
	} {
		root := t.TempDir()
		list := filepath.Join(root, googleChromeLegacyList)
		if err := os.MkdirAll(filepath.Dir(list), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(list, []byte("deb [arch=amd64] https://dl.google.com/linux/chrome/deb/ stable main\n"), 0o644); err != nil {
			t.Fatal(err)
		}
		apt := &fakeApt{root: root, candidate: tc.candidate, fail: tc.fail}
		installed, err := installServerBrowser(context.Background(), root, "amd64", apt.run)
		if !errors.Is(err, tc.want) || installed != (tc.want == nil) {
			t.Fatalf("%+v: installed=%v err=%v", tc, installed, err)
		}
		update := apt.calls[0]
		if !slices.Contains(update, "update") || !slices.Contains(update, "Dir::Etc::SourceList="+googleChromeLegacyList) || !slices.Contains(update, "Dir::Etc::SourceParts=-") || !slices.Contains(update, "APT::Get::List-Cleanup=false") {
			t.Fatalf("update touches more than Google's index: %v", update)
		}
		for _, c := range apt.calls {
			if c[0] == "apt-get" && slices.Contains(c, "install") && (!slices.Contains(c, "--no-remove") || c[len(c)-1] != serverBrowserPackage) {
				t.Fatalf("unsafe install: %v", c)
			}
		}
		if _, err := os.Lstat(filepath.Join(root, googleChromeSourcesPath)); !errors.Is(err, os.ErrNotExist) {
			t.Fatalf("a second Google source was written beside the administrator's: %v", err)
		}
	}
}

// Only the disposable container runner sets this opt-in. Never use on a host:
// it adds Google's repository and installs Chrome.
func TestServerBrowserChromeAptContainer(t *testing.T) {
	if os.Getenv("HOST_UBUNTU_APT_CONTAINER") != "1" {
		t.Skip("requires disposable Ubuntu apt container")
	}
	if b, err := os.ReadFile("/etc/os-release"); err != nil || !strings.Contains(string(b), "Ubuntu") || os.Geteuid() != 0 {
		t.Fatal("requires root in disposable Ubuntu")
	}
	installed, err := installServerBrowser(context.Background(), "/", runtime.GOARCH, nativeCommandTimeout)
	if err != nil || !installed {
		t.Fatalf("installed=%v err=%v", installed, err)
	}
	// Chrome's postinst now owns the source and the key; it must have written
	// the same bytes, or the two writers would fight on every apply.
	for _, p := range []policyFile{{googleChromeKeyringPath, googleChromeKeyring}, {googleChromeSourcesPath, googleChromeSources(runtime.GOARCH)}} {
		b, err := os.ReadFile(p.Path)
		if err != nil || string(b) != p.Content {
			t.Fatalf("%s differs from Chrome's own: %v", p.Path, err)
		}
	}
	if !trustedOperatorExecutableForTest(serverBrowserChrome) {
		t.Fatal("installed Chrome is not a root-owned executable")
	}
	if installed, err = installServerBrowser(context.Background(), "/", runtime.GOARCH, nativeCommandTimeout); installed || err != nil {
		t.Fatalf("second run: installed=%v err=%v", installed, err)
	}
}

func trustedOperatorExecutableForTest(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.Mode().IsRegular() && info.Mode()&0o111 != 0 && info.Mode()&0o022 == 0
}
