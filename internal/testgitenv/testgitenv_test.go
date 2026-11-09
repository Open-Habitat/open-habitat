package testgitenv

import (
	"os/exec"
	"slices"
	"strings"
	"testing"
)

func TestLocalVarsMatchGit(t *testing.T) {
	out, err := exec.Command("git", "rev-parse", "--local-env-vars").Output()
	if err != nil {
		t.Skipf("git unavailable: %v", err)
	}
	got, want := slices.Sorted(slices.Values(LocalVars)), strings.Fields(string(out))
	slices.Sort(want)
	if !slices.Equal(got, want) {
		t.Fatalf("LocalVars = %v, git lists %v", got, want)
	}
}
