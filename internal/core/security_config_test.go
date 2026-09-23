package core

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestTrustedConfigRejectsUntrustedPathAndUnknownFields(t *testing.T) {
	path := filepath.Join(t.TempDir(), "gateway.json")
	for _, body := range []string{
		`{"component":"gateway","listen":"127.0.0.1:0","oauth":{},"gateway_uid":1000,"tls_cert":"/cert","tls_key":"/key","extra":1}`,
		`{"component":"gateway","listen":"127.0.0.1:0","oauth":{},"gateway_uid":1000,"tls_cert":"/cert","tls_key":"/key"}`,
	} {
		if e := os.WriteFile(path, []byte(body), 0600); e != nil {
			t.Fatal(e)
		}
		if _, e := LoadConfig(path, Gateway); e == nil {
			t.Fatal("untrusted config accepted")
		}
	}
	if e := os.WriteFile(path, []byte(`{"component":"gateway","listen":"127.0.0.1:0"}`), 0600); e != nil {
		t.Fatal(e)
	}
	if _, e := LoadConfig(path, Gateway); e != nil {
		t.Fatal("foundation rejected", e)
	}
	if _, e := LoadConfig(path, Daemon); e == nil || !strings.Contains(e.Error(), "component") {
		t.Fatal("wrong role accepted")
	}
}
