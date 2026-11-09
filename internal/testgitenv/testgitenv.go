// Package testgitenv keeps tests and fixtures from writing to the repository
// they were started in. `git bisect run`, hooks and `git rebase --exec` export
// GIT_DIR for the caller's repository; a scratch `git init <dir>` that inherits
// it reinitialises that repository instead, and from a linked worktree marks
// the shared one bare (core.bare=true), so every checkout of it stops working.
package testgitenv

import "os"

// LocalVars are the variables `git rev-parse --local-env-vars` lists: the ones
// that bind a git process to one particular repository.
var LocalVars = []string{
	"GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_CONFIG", "GIT_CONFIG_PARAMETERS",
	"GIT_CONFIG_COUNT", "GIT_OBJECT_DIRECTORY", "GIT_DIR", "GIT_WORK_TREE",
	"GIT_IMPLICIT_WORK_TREE", "GIT_GRAFT_FILE", "GIT_INDEX_FILE",
	"GIT_NO_REPLACE_OBJECTS", "GIT_REPLACE_REF_BASE", "GIT_PREFIX",
	"GIT_SHALLOW_FILE", "GIT_COMMON_DIR",
}

// Scrub removes LocalVars from this process's environment, so every git
// child finds its repository from its own directory or arguments. Call it
// from TestMain (or a fixture binary's main) before anything runs git.
func Scrub() {
	for _, name := range LocalVars {
		_ = os.Unsetenv(name)
	}
}
