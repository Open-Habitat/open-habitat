//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
)

// These are initial native code-server preferences, not enforced policy. Keep
// existing values (including false/null), comments and formatting intact.
var editorDefaults = map[string]any{
	"security.workspace.trust.enabled":             false,
	"workbench.startupEditor":                      "none",
	"chat.disableAIFeatures":                       true,
	"workbench.secondarySideBar.defaultVisibility": "hidden",
}

func prepareEditorSettings(home string) error {
	dir := filepath.Join(home, ".local", "share", "code-server", "User")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	name := filepath.Join(dir, "settings.json")
	if st, err := os.Lstat(name); err == nil && (!st.Mode().IsRegular() || st.Size() > 1<<20) {
		return nil
	}
	data, err := os.ReadFile(name)
	if errors.Is(err, os.ErrNotExist) {
		data = []byte("{}\n")
	} else if err != nil {
		return err
	}
	merged, err := mergeEditorDefaults(data)
	// An invalid or unfamiliar settings file is the person's to repair, not ours
	// to replace. Editor startup must still work with it.
	if err != nil || bytes.Equal(data, merged) {
		return nil
	}
	f, err := os.CreateTemp(dir, ".settings-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if _, err = f.Write(merged); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	return os.Rename(f.Name(), name)
}

func mergeEditorDefaults(data []byte) ([]byte, error) {
	if len(data) > 1<<20 {
		return nil, errors.New("settings too large")
	}
	// JSONC permits comments and trailing commas. Blank them rather than
	// removing them so offsets still refer to the original, untouched document.
	plain := append([]byte(nil), data...)
	inString, escaped := false, false
	for i := 0; i < len(plain); i++ {
		c := plain[i]
		if inString {
			if escaped {
				escaped = false
			} else if c == '\\' {
				escaped = true
			} else if c == '"' {
				inString = false
			}
			continue
		}
		if c == '"' {
			inString = true
			continue
		}
		if c != '/' || i+1 >= len(plain) {
			continue
		}
		if plain[i+1] == '/' {
			for i < len(plain) && plain[i] != '\n' {
				plain[i] = ' '
				i++
			}
		} else if plain[i+1] == '*' {
			end := bytes.Index(plain[i+2:], []byte("*/"))
			if end < 0 {
				return nil, errors.New("unterminated comment")
			}
			end += i + 4
			for ; i < end; i++ {
				plain[i] = ' '
			}
			i--
		}
	}
	inString, escaped = false, false
	for i, c := range plain {
		if inString {
			if escaped {
				escaped = false
			} else if c == '\\' {
				escaped = true
			} else if c == '"' {
				inString = false
			}
			continue
		}
		if c == '"' {
			inString = true
			continue
		}
		if c == ',' {
			tail := bytes.TrimSpace(plain[i+1:])
			if len(tail) > 0 && (tail[0] == '}' || tail[0] == ']') {
				plain[i] = ' '
			}
		}
	}
	var existing map[string]json.RawMessage
	if err := json.Unmarshal(plain, &existing); err != nil {
		return nil, err
	}
	start := bytes.IndexByte(plain, '{')
	if start < 0 || existing == nil {
		return nil, errors.New("settings not an object")
	}
	missing := map[string]any{}
	for k, v := range editorDefaults {
		if _, ok := existing[k]; !ok {
			missing[k] = v
		}
	}
	if len(missing) == 0 {
		return data, nil
	}
	defaults, _ := json.MarshalIndent(missing, "", "  ")
	insert := defaults[1 : len(defaults)-1]
	if len(existing) > 0 {
		insert = append(insert, ',')
	}
	result := append([]byte(nil), data[:start+1]...)
	result = append(result, insert...)
	result = append(result, data[start+1:]...)
	return result, nil
}
