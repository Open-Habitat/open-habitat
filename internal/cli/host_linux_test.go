//go:build linux

package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/Open-Habitat/open-habitat/internal/host"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestHostValidationBeforeObservation(t *testing.T) {
	for _, args := range [][]string{
		{"check"}, {"check", "--site", "relative"}, {"plan", "--site", "/x", "--site", "/y"},
		{"plan", "--site", "/x", "--dry-run"}, {"apply", "--site", "/x"}, {"operation", "show", "../active"},
		{"check", "--secret", "SECRET_SENTINEL"}, {"operation", "show", strings.Repeat("a", 32), "--site", "/x"},
	} {
		var out, err bytes.Buffer
		code := Run(append([]string{"--json", "host"}, args...), &out, &err)
		if code != 1 || out.Len() != 0 || !strings.Contains(err.String(), `"code":"invalid_arguments"`) || strings.Contains(err.String(), "SECRET_SENTINEL") {
			t.Fatal(args, code, out.String(), err.String())
		}
	}
}
func TestHostReadOnlyCLI(t *testing.T) {
	if os.Geteuid() != 0 {
		t.Skip("actual root in test-host-initialization-uids.sh")
	}
	if os.Getenv("HOST_INIT_UID_CONTAINER") != "1" {
		t.Skip("synthetic networkless container only")
	}
	dir, e := os.MkdirTemp("/root", "oh-host-cli-")
	if e != nil {
		t.Fatal(e)
	}
	defer os.RemoveAll(dir)
	b, e := os.ReadFile("/opt/example-site.json")
	if e != nil {
		t.Fatal(e)
	}
	var s map[string]any
	if json.Unmarshal(b, &s) != nil {
		t.Fatal("fixture")
	}
	g := s["gateway"].(map[string]any)
	secret := filepath.Join(dir, "secret")
	os.WriteFile(secret, []byte("SECRET_SENTINEL"), 0600)
	for _, key := range []string{"oauth_secret_file", "tls_cert_file", "tls_key_file"} {
		g[key] = secret
	}
	site := filepath.Join(dir, "site.json")
	b, _ = json.Marshal(s)
	os.WriteFile(site, b, 0600)
	for _, verb := range []string{"check", "plan"} {
		var out, err bytes.Buffer
		code := Run([]string{"host", verb, "--site", site, "--json"}, &out, &err)
		if code != 1 || out.Len() != 0 || strings.Contains(err.String(), "SECRET_SENTINEL") || strings.Contains(err.String(), secret) {
			t.Fatal(code, out.String(), err.String())
		}
		var envelope struct {
			Schema int `json:"schema_version"`
			Error  struct {
				Code   string `json:"code"`
				Result struct {
					Schema int            `json:"schema_version"`
					Data   map[string]any `json:"data"`
				} `json:"result"`
			} `json:"error"`
		}
		if json.Unmarshal(err.Bytes(), &envelope) != nil || envelope.Schema != 1 || envelope.Error.Code != "host_"+verb+"_blocked" || envelope.Error.Result.Schema != 1 || envelope.Error.Result.Data["checks"] == nil {
			t.Fatal(err.String())
		}
		if verb == "plan" && envelope.Error.Result.Data["approvable"] != false {
			t.Fatal("approvable plan")
		}
	}
	entries, e := os.ReadDir(dir)
	if e != nil || len(entries) != 2 {
		t.Fatal("host state created", e)
	}
	if _, e := os.Stat("/var/lib/open-habitat"); !os.IsNotExist(e) {
		t.Fatal("system state touched", e)
	}
}

func TestHostOperationShowCLI(t *testing.T) {
	if os.Geteuid() != 0 || os.Getenv("HOST_INIT_UID_CONTAINER") != "1" {
		t.Skip("synthetic root container only")
	}
	var out, err bytes.Buffer
	id := strings.Repeat("a", 32)
	if code := Run([]string{"host", "operation", "show", id, "--json"}, &out, &err); code != 1 || !strings.Contains(err.String(), "operation_not_found") {
		t.Fatal(code, out.String(), err.String())
	}
	if e := os.Mkdir("/var/lib/open-habitat", 0700); e != nil {
		t.Fatal(e)
	}
	defer os.RemoveAll("/var/lib/open-habitat")
	lock, e := host.OpenOperationLock(context.Background())
	if e != nil {
		t.Fatal(e)
	}
	defer lock.Close()
	op, e := lock.Begin("apply", strings.Repeat("b", 64), host.Release{Version: "0.1.0", ManifestSHA256: strings.Repeat("c", 64)})
	if e != nil {
		t.Fatal(e)
	}
	receipt := "/var/lib/open-habitat/host/" + op.ID + ".json"
	before, _ := os.ReadFile(receipt)
	st, _ := os.Stat(receipt)
	out.Reset()
	err.Reset()
	if code := Run([]string{"host", "operation", "show", op.ID, "--json"}, &out, &err); code != 0 || err.Len() != 0 || !strings.Contains(out.String(), `"phase":"started"`) {
		t.Fatal(code, out.String(), err.String())
	}
	after, _ := os.ReadFile(receipt)
	now, _ := os.Stat(receipt)
	if !bytes.Equal(before, after) || !st.ModTime().Equal(now.ModTime()) {
		t.Fatal("show changed journal")
	}
}
