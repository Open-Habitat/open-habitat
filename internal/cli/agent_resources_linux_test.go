//go:build linux

package cli

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestAgentResourceValidationAndFences(t *testing.T) {
	id := "pi:11111111-1111-4111-8111-111111111111"
	for _, args := range [][]string{
		{"history", "list", "--conversation", "other"},
		{"history", "list", "--current"},
		{"process", "list", "--conversation", id, "--uid", "0"},
		{"process", "stop", "--conversation", id, "--process", "proc_abcd"},
		{"process", "delete", "--conversation", id, "--owner-generation", "g"},
		{"process", "show", "--conversation", id, "--owner-generation", "g", "--process-token", "t", "--process", "proc_abcd", "--tail-lines", "2001"},
		{"receipt", "show", "--conversation", id, "--command", "bad"},
		{"attachment", "show", "--attachment", "11111111-1111-4111-8111-111111111111"},
		{"history-block", "show", "--conversation", id, "--entry", "e", "--revision", "r", "--block", "128"},
		{"history", "list", "--output", "x.jsonl", "--output", "y.jsonl"},
	} {
		if _, e := parseResourceRequest(args); e == nil {
			t.Fatalf("accepted %q", args)
		}
	}
	stop, e := parseResourceRequest([]string{"process", "stop", "--conversation", id, "--owner-generation", "generation", "--process-token", "pt_123", "--process", "proc_abcd", "--force"})
	if e != nil || !bytes.Contains(stop.body, []byte(`"force":true`)) || !bytes.Contains(stop.body, []byte(`"process_token":"pt_123"`)) {
		t.Fatal(stop, e)
	}
	show, e := parseResourceRequest([]string{"process", "show", "--conversation", id, "--owner-generation", "generation", "--process-token", "pt_123", "--process", "proc_abcd"})
	if e != nil || !strings.Contains(show.path, "owner_generation=generation") || !strings.Contains(show.path, "process_token=pt_123") {
		t.Fatal(show, e)
	}
	for _, args := range [][]string{{"attachment", "create", "--input-file", "missing"}, {"process", "delete", "--conversation", id, "--finished-only", "--owner-generation", "g"}} {
		_, e := parseResourceRequest(append(args, "--dry-run"))
		var ce *cliError
		if !errors.As(e, &ce) || ce.code != "dry_run_unsupported" {
			t.Fatalf("dry-run consumed input or acted: %v", e)
		}
	}
	for _, state := range []string{"terminate_timeout", "not_found", "error"} {
		e := resourceFailure("process stop", json.RawMessage(`{"schema_version":1,"result":"`+state+`"}`))
		if e == nil {
			t.Fatal("incomplete stop succeeded", state)
		}
	}
}

func TestAgentResourceExports(t *testing.T) {
	dir := t.TempDir()
	out := filepath.Join(dir, "history.jsonl")
	req, e := parseResourceRequest([]string{"history", "list", "--conversation", "pi:11111111-1111-4111-8111-111111111111", "--output", out})
	if e != nil {
		t.Fatal(e)
	}
	calls := 0
	exchange := func(method, path string, body []byte, binary bool) (json.RawMessage, error) {
		calls++
		if calls == 1 {
			return json.RawMessage(`{"schema_version":1,"native_revision":"r1","boundary_found":true,"older_complete":false,"next_before":"e2","entries":[{"entry_key":"e2"}]}`), nil
		}
		if !strings.HasSuffix(path, "?before=e2") {
			t.Fatal("lost native boundary", path)
		}
		return json.RawMessage(`{"schema_version":1,"native_revision":"r1","boundary_found":true,"older_complete":true,"entries":[{"entry_key":"e1"}]}`), nil
	}
	result, e := runResourceRequest(req, exchange)
	if e != nil {
		t.Fatal(e)
	}
	if result.(map[string]any)["data"].(map[string]any)["count"] != 2 {
		t.Fatal(result)
	}
	data, _ := os.ReadFile(out)
	if bytes.Count(data, []byte("\n")) != 2 || !bytes.Contains(data, []byte(`"older_complete":true`)) {
		t.Fatal(string(data))
	}
	if _, e := runResourceRequest(req, exchange); e == nil || calls != 2 {
		t.Fatal("overwrote output or made remote call", e, calls)
	}
	req.output = filepath.Join(dir, "failed.jsonl")
	calls = 0
	_, e = runResourceRequest(req, func(method, path string, body []byte, binary bool) (json.RawMessage, error) {
		b, e := exchange(method, path, body, binary)
		if calls == 2 {
			b = bytes.ReplaceAll(b, []byte("r1"), []byte("r2"))
		}
		return b, e
	})
	if e == nil {
		t.Fatal("export mixed native revisions")
	}
	if _, e := os.Stat(req.output); !os.IsNotExist(e) {
		t.Fatal("left partial export", e)
	}
	block, e := parseResourceRequest([]string{"history-block", "show", "--conversation", "pi:11111111-1111-4111-8111-111111111111", "--entry", "e", "--block", "0", "--revision", "r", "--output", filepath.Join(dir, "block.jsonl")})
	if e != nil {
		t.Fatal(e)
	}
	calls = 0
	_, e = runResourceRequest(block, func(method, path string, body []byte, binary bool) (json.RawMessage, error) {
		calls++
		if calls == 1 {
			return json.RawMessage(`{"schema_version":1,"native_revision":"r","offset":0,"chunk":{"text":"first","complete":false,"next_offset":5}}`), nil
		}
		if !strings.Contains(path, "offset=5") {
			t.Fatal(path)
		}
		return json.RawMessage(`{"schema_version":1,"native_revision":"r","offset":5,"chunk":{"text":"last","complete":true}}`), nil
	})
	if e != nil || calls != 2 {
		t.Fatal(e, calls)
	}
	attachment, e := parseResourceRequest([]string{"attachment", "show", "--attachment", "11111111-1111-4111-8111-111111111111", "--output", filepath.Join(dir, "image.png")})
	if e != nil {
		t.Fatal(e)
	}
	_, e = runResourceRequest(attachment, func(method, path string, body []byte, binary bool) (json.RawMessage, error) {
		if !binary {
			t.Fatal("binary decoded as JSON")
		}
		return []byte("\x00\xffimage"), nil
	})
	if e != nil {
		t.Fatal(e)
	}
	b, _ := os.ReadFile(attachment.output)
	st, _ := os.Stat(attachment.output)
	if string(b) != "\x00\xffimage" || st.Mode().Perm() != 0600 {
		t.Fatal(b, st)
	}
}
