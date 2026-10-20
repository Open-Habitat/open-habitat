//go:build linux

package daemon

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestEditorDefaultsPreserveNativePreferences(t *testing.T) {
	original := []byte(`{
 // Keep my preferred startup, including explicit false values.
 "workbench.startupEditor": "welcomePage",
 "chat.disableAIFeatures": false,
 "custom": {"url":"https://example.test/*ok*/", "array": [1,2,],},
}`)
	merged, err := mergeEditorDefaults(original)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(merged, original[1:]) {
		t.Fatalf("existing bytes changed: %s", merged)
	}
	if bytes.Count(merged, []byte(`"chat.disableAIFeatures"`)) != 1 || !bytes.Contains(merged, []byte(`"security.workspace.trust.enabled": false`)) {
		t.Fatalf("defaults or override lost: %s", merged)
	}
	again, err := mergeEditorDefaults(merged)
	if err != nil || !bytes.Equal(merged, again) {
		t.Fatalf("not idempotent: %v %s", err, again)
	}
}

func TestEditorDefaultsLeaveInvalidSettingsAlone(t *testing.T) {
	for _, data := range []string{`null`, `[]`, `{"x":`, `{"x": /* unfinished`, `{"x": "unterminated}`} {
		if _, err := mergeEditorDefaults([]byte(data)); err == nil {
			t.Fatalf("accepted invalid settings %q", data)
		}
	}
	home := t.TempDir()
	if err := prepareEditorSettings(home); err != nil {
		t.Fatal(err)
	}
	name := filepath.Join(home, ".local/share/code-server/User/settings.json")
	data, err := os.ReadFile(name)
	if err != nil {
		t.Fatal(err)
	}
	for key := range editorDefaults {
		if !bytes.Contains(data, []byte(key)) {
			t.Fatalf("missing %s", key)
		}
	}
	invalid := []byte("{ // unfinished")
	if err := os.WriteFile(name, invalid, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := prepareEditorSettings(home); err != nil {
		t.Fatal(err)
	}
	after, _ := os.ReadFile(name)
	if !bytes.Equal(after, invalid) {
		t.Fatal("invalid settings replaced")
	}
}
