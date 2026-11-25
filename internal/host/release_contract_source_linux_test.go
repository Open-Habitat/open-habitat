//go:build linux

package host

import (
	"crypto/sha256"
	"fmt"
	"go/scanner"
	"go/token"
	"os"
	"path/filepath"
	"testing"
)

// This is a decision tripwire, not a proof of semantic equivalence. Pin tokens
// rather than bytes so comments and formatting need no review. Whole files
// deliberately include some non-verification code: such changes may refresh
// the golden without a contract bump after review (internal/host/AGENTS.md).
func TestVerificationContractSource(t *testing.T) {
	files := []string{
		"cmd/runtime-release/main.go",
		"internal/host/release.go",
		"internal/host/release_closure_linux.go",
		"internal/host/release_stage_linux.go",
		"internal/host/platform.go",
		"internal/host/site.go", // strictJSON and the shared validation regexps
	}
	h := sha256.New()
	for _, path := range files {
		b, err := os.ReadFile(filepath.Join("../..", path))
		if err != nil {
			t.Fatal(err)
		}
		fmt.Fprintln(h, path)
		var s scanner.Scanner
		s.Init(token.NewFileSet().AddFile(path, -1, len(b)), b, func(pos token.Position, msg string) {
			t.Errorf("%s: %s", pos, msg)
		}, 0)
		for {
			_, tok, literal := s.Scan()
			if tok == token.EOF {
				break
			}
			fmt.Fprintf(h, "%s %q\n", tok, literal)
		}
	}
	const reviewedContract = "runtime-release-v1"
	const reviewedSource = "1bacd55b33c05b0a1d3e326a44d02d47569dc47856062f8bdcbb7fa8ed36577c"
	got := fmt.Sprintf("%x", h.Sum(nil))
	if RuntimeVerificationContract != reviewedContract || got != reviewedSource {
		t.Fatalf("verification code changed: contract=%q source=%s; review verify semantics and helper coverage, bump RuntimeVerificationContract only for semantic changes, then deliberately update both goldens (see internal/host/AGENTS.md)", RuntimeVerificationContract, got)
	}
}
