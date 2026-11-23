//go:build linux

package cli

import (
	"errors"
	"testing"
)

// Removal's arguments are refused before the gateway is asked: the id, the
// confirming login and the timing flags are each exact.
func TestAdminRemovalArguments(t *testing.T) {
	for _, args := range [][]string{
		{"remove-person", "--github-id", "583231"},
		{"remove-person", "--github-id", "583231", "--login", "-bad-"},
		{"remove-person", "--github-id", "0", "--login", "octocat"},
		{"remove-person", "--github-id", "583231", "--login", "octocat", "--now", "--now"},
		{"remove-person", "--github-id", "583231", "--login", "octocat", "--login", "octocat"},
		{"cancel-removal", "--github-id", "583231", "--now"},
		{"cancel-removal", "--github-id", "583231", "--login", "octocat"},
	} {
		_, err := adminAccessCommand(args)
		var c *cliError
		want := usage("")
		if !errors.As(err, &c) || c.code != want.code || c.exit != want.exit {
			t.Fatalf("%v: %v", args, err)
		}
	}
	if !githubLogin("Octo-cat") || githubLogin("octo--cat") || githubLogin("") {
		t.Fatal("login grammar")
	}
}
