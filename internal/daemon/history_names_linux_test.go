//go:build linux

package daemon

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Pi stores the system prompt as a message entry; past the reader's 16 KiB
// line buffer it must not hide a later title, while an overlong title entry
// still makes the name unknown rather than wrong.
func TestNativeNameSurvivesLongSystemPromptLines(t *testing.T) {
	long := `{"type":"message","id":"m0","parentId":null,"message":{"role":"system","sections":{"tools":"{\"name\":\"bash\"}` + strings.Repeat("x", 20<<10) + `"}}}`
	for _, tc := range []struct {
		name, lines, want string
		known             bool
	}{
		{"long prompt then title", long + "\n" + `{"type":"session_info","id":"s1","parentId":"m0","name":"Otsikko"}` + "\n", "Otsikko", true},
		{"overlong title", `{"type":"session_info","id":"s1","parentId":null,"name":"` + strings.Repeat("y", 20<<10) + `"}` + "\n", "", false},
		{"unrecognized overlong line", `{"name":"` + strings.Repeat("z", 20<<10) + `"}` + "\n", "", false},
	} {
		path := filepath.Join(t.TempDir(), "s.jsonl")
		if err := os.WriteFile(path, []byte(tc.lines), 0600); err != nil {
			t.Fatal(err)
		}
		f, err := os.Open(path)
		if err != nil {
			t.Fatal(err)
		}
		name, known := scanNativeNames(f)
		f.Close()
		if name != tc.want || known != tc.known {
			t.Errorf("%s: %q %v", tc.name, name, known)
		}
	}
}
