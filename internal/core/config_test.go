package core

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadConfigStrict(t *testing.T) {
	p := filepath.Join(t.TempDir(), "c.json")
	os.WriteFile(p, []byte(`{"component":"gateway","listen":"127.0.0.1:0"}`), 0600)
	if _, err := LoadConfig(p, Gateway); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(p, []byte(`{"component":"gateway","listen":"x","secret":"no"}`), 0600)
	if _, err := LoadConfig(p, Gateway); err == nil {
		t.Fatal("unknown config key accepted")
	}
	os.WriteFile(p, []byte(`{"component":"gateway","listen":"x"} {}`), 0600)
	if _, err := LoadConfig(p, Gateway); err == nil {
		t.Fatal("trailing JSON value accepted")
	}
}
