//go:build linux

package cli

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func TestBrowserPositionalArguments(t *testing.T) {
	id := strings.Repeat("A", 32)
	textFile := filepath.Join(t.TempDir(), "text")
	if err := os.WriteFile(textFile, []byte("query\n"), 0600); err != nil {
		t.Fatal(err)
	}
	for _, verb := range []string{"goto", "download", "click", "type"} {
		value := "https://example.invalid/"
		flags := []string{"--tab", id, "--timeout-seconds", "12"}
		switch verb {
		case "download":
			flags = append(flags, "--name", "receipt.pdf")
		case "click", "type":
			value = `input[aria-label^="X"]`
		}
		if verb == "type" {
			flags = append(flags, "--text-file", textFile)
		}
		for _, position := range []int{0, 2, len(flags)} {
			t.Run(verb+"/"+strconv.Itoa(position), func(t *testing.T) {
				args := append([]string{verb}, flags[:position]...)
				args = append(args, value)
				args = append(args, flags[position:]...)
				a, err := parseBrowserAction(args)
				if err != nil {
					t.Fatal(err)
				}
				if a.tab != id {
					t.Fatalf("tab = %q", a.tab)
				}
				if verb == "click" || verb == "type" {
					if a.selector != value {
						t.Fatalf("selector = %q", a.selector)
					}
					if verb == "type" && a.value != "query\n" {
						t.Fatalf("text = %q", a.value)
					}
					named, err := parseBrowserAction(append(append([]string{verb}, flags...), "--selector", value))
					if err != nil || named != a {
						t.Fatalf("named differs: %+v, %v", named, err)
					}
				} else if a.value != value {
					t.Fatalf("value = %q", a.value)
				}
			})
		}
	}
}

func TestBrowserPositionalHelp(t *testing.T) {
	for _, tc := range []struct {
		verb, name string
		required   bool
	}{
		{"goto", "url", true}, {"download", "url", true},
		{"click", "selector", false}, {"type", "selector", false},
	} {
		t.Run(tc.verb, func(t *testing.T) {
			var stdout, stderr bytes.Buffer
			if code := Run([]string{"agent", "browser", tc.verb, "--help", "--json"}, &stdout, &stderr); code != 0 {
				t.Fatal(code, stderr.String())
			}
			var result struct {
				Data struct {
					Args []struct {
						Name, Description string
						Required          bool
					}
				}
			}
			if err := json.Unmarshal(stdout.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
			if len(result.Data.Args) != 1 {
				t.Fatalf("args = %+v", result.Data.Args)
			}
			arg := result.Data.Args[0]
			if arg.Name != tc.name || arg.Required != tc.required || !strings.Contains(arg.Description, "before or after flags") {
				t.Fatalf("argument = %+v", arg)
			}
			if tc.name == "selector" && !strings.Contains(arg.Description, "not both") {
				t.Fatal("missing selector exclusivity")
			}
		})
	}
}

func TestBrowserArgumentErrors(t *testing.T) {
	id := strings.Repeat("A", 32)
	type testCase struct {
		args     []string
		expected string
	}
	var cases []testCase
	for _, verb := range []string{"goto", "download"} {
		expected := "URL"
		for _, values := range [][]string{nil, {""}, {" "}, {"one", "two"}} {
			cases = append(cases, testCase{append([]string{verb, "--tab", id}, values...), expected})
		}
	}
	for _, verb := range []string{"click", "type"} {
		for _, values := range [][]string{nil, {""}, {" "}, {"one", "two"}, {"one", "--selector", "two"}, {"--selector", "one", "two"}, {"--selector", "", "two"}} {
			cases = append(cases, testCase{append([]string{verb, "--tab", id}, values...), "CSS selector"})
		}
	}
	for _, verb := range []string{"text", "links", "screenshot", "tabs", "close", "status", "start", "request"} {
		cases = append(cases, testCase{[]string{verb, "extra"}, "no positional arguments"})
	}
	cases = append(cases, testCase{[]string{"request"}, "--text TEXT"})
	// Agent JavaScript could read what the person typed into the page.
	cases = append(cases, testCase{[]string{"eval", "document.title", "--tab", id}, "eval is not available"})
	for _, tc := range cases {
		t.Run(strings.Join(tc.args, " "), func(t *testing.T) {
			var stdout, stderr bytes.Buffer
			args := append([]string{"agent", "browser"}, tc.args...)
			code := Run(append(args, "--json"), &stdout, &stderr)
			var result struct {
				Error struct{ Code, Message string }
			}
			if err := json.Unmarshal(stderr.Bytes(), &result); err != nil {
				t.Fatal(err, stderr.String())
			}
			if code != 1 || stdout.Len() != 0 || result.Error.Code != "invalid_arguments" || !strings.Contains(result.Error.Message, tc.expected) {
				t.Fatalf("code=%d stdout=%s stderr=%s; want %q", code, &stdout, &stderr, tc.expected)
			}
		})
	}
}
