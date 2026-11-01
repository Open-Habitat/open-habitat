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
)

func TestIconWishAttachments(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	const textID = "11111111-1111-4111-8111-111111111111"
	const imageID = "22222222-2222-4222-8222-222222222222"
	root := filepath.Join(c.home, "attachments")
	if err := os.MkdirAll(root, 0700); err != nil {
		t.Fatal(err)
	}
	png, _ := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP9sAAAAASUVORK5CYII=")
	for id, data := range map[string][]byte{textID: []byte("reference text"), imageID: png} {
		if err := os.WriteFile(filepath.Join(root, id), data, 0600); err != nil {
			t.Fatal(err)
		}
	}
	wish := strings.Repeat("long wish ", 30) + "\n[reference](/api/v1/attachments/" + textID + ")\n![image](/api/v1/attachments/" + imageID + ")"
	calls := 0
	c.iconSuggester = func(_ context.Context, data []byte) (string, string, []iconSuggestion, error) {
		calls++
		var input struct {
			Wish        string
			Attachments []map[string]string
		}
		if err := json.Unmarshal(data, &input); err != nil {
			t.Fatal(err)
		}
		if input.Wish != wish || len(input.Attachments) != 2 || input.Attachments[0]["text"] != "reference text" || input.Attachments[1]["data"] != base64.StdEncoding.EncodeToString(png) {
			t.Fatalf("wrong model input: %+v", input)
		}
		return "synthetic/fixture", "", []iconSuggestion{{"X", "reference"}}, nil
	}
	body := fmt.Sprintf(`{"schema_version":1,"workspace_id":%q,"wish":%q,"history":[]}`, h.workspace, wish)
	if code, out := postIconSuggestions(t, c, body); code != 200 || out.State != "done" || calls != 1 {
		t.Fatalf("%d %+v calls=%d", code, out, calls)
	}
	// Missing, symlinked, binary and oversized text fail before any model call.
	if err := os.Remove(filepath.Join(root, textID)); err != nil {
		t.Fatal(err)
	}
	if code, _ := postIconSuggestions(t, c, body); code != 400 {
		t.Fatalf("missing: %d", code)
	}
	if err := os.Symlink(filepath.Join(root, imageID), filepath.Join(root, textID)); err != nil {
		t.Fatal(err)
	}
	if code, _ := postIconSuggestions(t, c, body); code != 400 {
		t.Fatalf("symlink: %d", code)
	}
	if err := os.Remove(filepath.Join(root, textID)); err != nil {
		t.Fatal(err)
	}
	for _, data := range [][]byte{{0, 1, 2}, []byte(strings.Repeat("x", 65537))} {
		if err := os.WriteFile(filepath.Join(root, textID), data, 0600); err != nil {
			t.Fatal(err)
		}
		if code, _ := postIconSuggestions(t, c, body); code != 400 {
			t.Fatalf("invalid attachment: %d", code)
		}
	}
	if calls != 1 {
		t.Fatalf("invalid attachments reached model %d times", calls-1)
	}
}
