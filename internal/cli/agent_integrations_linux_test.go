//go:build linux

package cli

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestProtectedIntegrationInput(t *testing.T) {
	secret := "sk-" + strings.Repeat("q", 24)
	for _, file := range []bool{false, true} {
		source := "-"
		if file {
			source = filepath.Join(t.TempDir(), "key")
			if err := os.WriteFile(source, []byte(secret+"\n"), 0600); err != nil {
				t.Fatal(err)
			}
		}
		req, err := parseIntegrationRequest([]string{"credential", "update", "--secret-file", source}, strings.NewReader(secret+"\n"))
		if err != nil {
			t.Fatal(err)
		}
		var input map[string]string
		if json.Unmarshal(req.body, &input) != nil || input["key"] != secret || input["provider"] != "openai" {
			t.Fatal("protected key not conveyed")
		}
	}
	input := `{"provider":"imap","address":"a@example.test","password":"secret"}`
	req, err := parseIntegrationRequest([]string{"integration-account", "update", "--input-file", "-"}, strings.NewReader(input))
	if err != nil || !bytes.Contains(req.body, []byte(`"action":"password"`)) {
		t.Fatal("password update not constructed", err)
	}
	for _, body := range []string{`{"provider":"imap","address":"a@example.test","password":"secret","action":"remove"}`, `{"uid":0}`, `{"provider":"imap","provider":"caldav","address":"a@example.test"}`, `null`, input + `{}`} {
		if _, err := parseIntegrationRequest([]string{"integration-account", "create", "--input-file", "-"}, strings.NewReader(body)); err == nil {
			t.Fatal("accepted ambiguous input")
		}
	}
	// A refused preview must not even consume the secret stream.
	reader := strings.NewReader(secret)
	_, err = parseIntegrationRequest([]string{"credential", "update", "--secret-file", "-", "--dry-run"}, reader)
	if ce, ok := err.(*cliError); !ok || ce.code != "dry_run_unsupported" || reader.Len() != len(secret) {
		t.Fatal("dry run read or wrote")
	}
}

func TestProtectedFilesAndErrors(t *testing.T) {
	secret := "sentinel-never-print"
	dir := t.TempDir()
	file := filepath.Join(dir, secret)
	os.WriteFile(file, []byte(secret), 0644)
	os.Chmod(file, 0644)
	for _, path := range []string{file, filepath.Join(dir, "missing")} {
		if _, err := readProtectedInput(path, strings.NewReader(""), 32); err == nil || strings.Contains(err.Error(), secret) {
			t.Fatal("unsafe file/error")
		}
	}
	os.Chmod(file, 0600)
	link := filepath.Join(dir, "link")
	os.Symlink(file, link)
	if _, err := readProtectedInput(link, strings.NewReader(""), 32); err == nil {
		t.Fatal("followed symlink")
	}
	if _, err := readProtectedInput("-", strings.NewReader(strings.Repeat("x", 33)), 32); err == nil {
		t.Fatal("unbounded input")
	}
	for _, args := range [][]string{
		{"agent", "credential", "update", "--key", secret, "--json"},
		{"agent", "credential", "update", "--secret-file", file, "--extra", secret, "--json"},
		{"agent", "integration-account", secret, "--help", "--json"},
		{"agent", "credential", "update", "--json=" + secret},
		{"--json=" + secret, "agent", "credential", "update"},
	} {
		var out, stderr bytes.Buffer
		if Run(args, &out, &stderr) == 0 || strings.Contains(out.String()+stderr.String(), secret) {
			t.Fatalf("secret leaked or input accepted: %s %s", out.String(), stderr.String())
		}
	}
}
