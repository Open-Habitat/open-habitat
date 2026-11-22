//go:build linux

package browserhost

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/sys/unix"
)

func TestPreferencesPreserveChoices(t *testing.T) {
	profile := filepath.Join(t.TempDir(), "profile")
	dir := filepath.Join(profile, "Default")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "Preferences")
	original := `{"unrelated":9007199254740993,"profile":{"cookie_controls_mode":1,"default_content_setting_values":{"popups":2},"content_settings":{"exceptions":{"javascript":{"https://example.test,*":{"setting":2}}}}},"download":{"default_directory":"/chosen"}}`
	if err := os.WriteFile(path, []byte(original), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := preparePreferences(profile); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var prefs map[string]any
	if err := json.Unmarshal(b, &prefs); err != nil {
		t.Fatal(err)
	}
	p := prefs["profile"].(map[string]any)
	settings := p["default_content_setting_values"].(map[string]any)
	if settings["popups"] != float64(2) || settings["automatic_downloads"] != float64(1) || p["cookie_controls_mode"] != float64(1) {
		t.Fatalf("choices lost or missing defaults: %s", b)
	}
	if !strings.Contains(string(b), `9007199254740993`) || !strings.Contains(string(b), `"https://example.test,*":{"setting":2}`) || prefs["download"].(map[string]any)["default_directory"] != "/chosen" {
		t.Fatalf("native data changed: %s", b)
	}
	before, _ := os.Stat(path)
	if err := preparePreferences(profile); err != nil {
		t.Fatal(err)
	}
	after, _ := os.Stat(path)
	if !os.SameFile(before, after) {
		t.Fatal("unchanged preferences rewritten")
	}
	if after.Mode().Perm() != 0o600 {
		t.Fatal("preferences not private")
	}
}

func TestPreferencesNativeDefaultsStayCleared(t *testing.T) {
	profile := filepath.Join(t.TempDir(), "profile")
	if err := preparePreferences(profile); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(profile, "Default", "Preferences")
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var prefs map[string]any
	if err := json.Unmarshal(b, &prefs); err != nil {
		t.Fatal(err)
	}
	settings := prefs["profile"].(map[string]any)["default_content_setting_values"].(map[string]any)
	// Chrome clears these keys when the person chooses Chrome's own defaults.
	for _, key := range []string{"popups", "automatic_downloads", "notifications"} {
		delete(settings, key)
	}
	b, err = json.Marshal(prefs)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, b, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := preparePreferences(profile); err != nil {
		t.Fatal(err)
	}
	after, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(b, after) {
		t.Fatal("user reset to native defaults was overwritten")
	}
}

func TestPreferencesRefuseUnsafeOrInvalid(t *testing.T) {
	for _, kind := range []string{"symlink", "fifo", "directory", "broken", "null", "array", "trailing"} {
		t.Run(kind, func(t *testing.T) {
			profile := filepath.Join(t.TempDir(), "profile")
			dir := filepath.Join(profile, "Default")
			if err := os.MkdirAll(dir, 0o700); err != nil {
				t.Fatal(err)
			}
			path := filepath.Join(dir, "Preferences")
			switch kind {
			case "symlink":
				target := filepath.Join(t.TempDir(), "target")
				if err := os.WriteFile(target, []byte(`{}`), 0o600); err != nil {
					t.Fatal(err)
				}
				if err := os.Symlink(target, path); err != nil {
					t.Fatal(err)
				}
			case "fifo":
				if err := unix.Mkfifo(path, 0o600); err != nil {
					t.Fatal(err)
				}
			case "directory":
				if err := os.Mkdir(path, 0o700); err != nil {
					t.Fatal(err)
				}
			default:
				data := map[string]string{"broken": "{", "null": "null", "array": "[]", "trailing": "{} {}"}[kind]
				if err := os.WriteFile(path, []byte(data), 0o600); err != nil {
					t.Fatal(err)
				}
			}
			before, _ := os.Lstat(path)
			if err := preparePreferences(profile); err == nil {
				t.Fatal("unsafe preferences accepted")
			}
			after, _ := os.Lstat(path)
			if !os.SameFile(before, after) {
				t.Fatal("invalid preferences replaced")
			}
		})
	}
}

func TestPreferencesFreshAndLaunchSafety(t *testing.T) {
	profile := filepath.Join(t.TempDir(), "profile")
	if err := preparePreferences(profile); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(filepath.Join(profile, "Default", "Preferences"))
	if err != nil {
		t.Fatal(err)
	}
	for _, required := range []string{`"javascript":1`, `"popups":1`, `"automatic_downloads":1`, `"notifications":2`, `"cookie_controls_mode":0`, `"credentials_enable_service":false`, `"credentials_enable_autosignin":false`, `"always_open_pdf_externally":false`} {
		if !bytes.Contains(b, []byte(required)) {
			t.Fatalf("missing default %s", required)
		}
	}
	args := chromeArgs(Config{Profile: profile})
	if !strings.Contains(strings.Join(args, " "), "--disable-sync") {
		t.Fatal("server settings may sync to other browsers")
	}
	for _, arg := range args {
		if strings.HasPrefix(arg, "--no-sandbox") || strings.HasPrefix(arg, "--disable-web-security") || strings.HasPrefix(arg, "--disable-site-isolation") || strings.HasPrefix(arg, "--ignore-certificate-errors") || strings.HasPrefix(arg, "--safebrowsing-disable") {
			t.Fatalf("unsafe launch flag %s", arg)
		}
	}
}
