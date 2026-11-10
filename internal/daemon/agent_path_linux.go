//go:build linux

package daemon

import (
	"os"
	"path/filepath"

	"github.com/open-habitat/open-habitat/internal/core"
)

// agentPath is for native user work started by the mapped user's daemon. Home comes
// from the daemon's verified account binding, never an HTTP or gateway value.
// Host-managed commands keep their separate, absolute executable paths and
// restricted environments.
func agentPath(home string) string {
	// The CLI is not necessarily installed in a system PATH directory. No
	// per-user wrapper or profile edit is needed to reach the shipped binary.
	release := agentRelease()
	// The selector is read per environment, not cached, so an operator's
	// runtime switch reaches the next shell without a daemon restart.
	selected := ""
	if runtime, err := core.LoadSharedPiRuntime(); err == nil {
		selected = filepath.Dir(filepath.Dir(runtime.Node))
	}
	return agentPathWith(home, release, selected)
}

// agentRelease is the directory of the release this daemon was launched from,
// through its launch selector when that reaches the same bytes.
func agentRelease() string {
	if executable, err := os.Executable(); err == nil {
		return agentReleaseBin(executable, os.Args[0])
	}
	return ""
}

func agentPathWith(home, release, selectedRuntime string) string {
	// Keep directories even before installation so tools installed during a
	// conversation are immediately available to subsequent child processes.
	path := "PATH=" + filepath.Join(home, ".local", "bin") + ":" + filepath.Join(home, ".cargo", "bin") + ":/usr/local/bin:/usr/bin:/bin"
	if release != "" {
		path += ":" + release
	}
	// Claude Code workers and a person's own `claude` run the binary the
	// Claude sign-in runs, so they share its version and native store. Its
	// package directory holds no other executable. It comes last: a Claude
	// Code the person installed themselves keeps precedence.
	if dir := agentClaudeCodeDir(release, selectedRuntime); dir != "" {
		path += ":" + dir
	}
	// Taskfleet, its workmux and the release's Pi launcher are part of every
	// installation's core runtime, so `taskfleet run create` works from any
	// conversation and Taskfleet's Pi workers find `pi`. Last, for the same
	// reason as Claude Code: a person's own installation keeps precedence.
	if dir := agentCoreToolsDir(release, selectedRuntime); dir != "" {
		path += ":" + dir
	}
	return path
}

// coreToolsDir is the core runtime's directory of agent commands. It holds
// only the commands the release closure allows there.
func coreToolsDir(runtimeRoot string) string { return filepath.Join(runtimeRoot, "agent-bin") }

// agentCoreToolsDir resolves the core runtime's agent commands as
// agentClaudeCodeDir resolves Claude Code: the release's own payload, which
// follows upgrades, else the selected runtime, and never an absent directory.
func agentCoreToolsDir(release, selectedRuntime string) string {
	return agentRuntimeDir(release, selectedRuntime, coreToolsDir, "taskfleet")
}

// agentClaudeCodeDir is the sign-in's Claude Code directory as reached from
// this installation, or empty when it has none. A host-applied generation
// ships its core runtime inside the release, and naming it through the launch
// selector follows upgrades. An installation that selects its core runtime
// outside the release (pi-runtime.json naming another tree) has no payloads
// there, so the selected runtime itself is named. A missing directory is
// left out rather than promised.
func agentClaudeCodeDir(release, selectedRuntime string) string {
	return agentRuntimeDir(release, selectedRuntime, claudeCodeDir, "claude")
}

// agentRuntimeDir is dir(root) for the first core runtime root, the
// release's payload then the selected runtime, where it holds executable.
func agentRuntimeDir(release, selectedRuntime string, dir func(string) string, executable string) string {
	var roots []string
	if release != "" {
		roots = append(roots, filepath.Join(release, "payloads", "core", "runtime"))
	}
	if selectedRuntime != "" {
		roots = append(roots, selectedRuntime)
	}
	for _, root := range roots {
		candidate := dir(root)
		if st, err := os.Stat(filepath.Join(candidate, executable)); err == nil && st.Mode().IsRegular() {
			return candidate
		}
	}
	return ""
}

func agentReleaseBin(executable, invoked string) string {
	return filepath.Dir(launchedExecutable(executable, invoked))
}

// launchedExecutable is the absolute path this binary was started through
// (e.g. the installation's current selector) if it reaches these same bytes,
// else the resolved executable. os.Executable resolves symlinks, so it names
// one release generation; the launch path follows upgrades, so shells,
// editors and the registered Git helper never pin an old generation that a
// release switch and its removal leave behind. Relative or unclean argv[0]
// must never introduce cwd or an unverified path.
func launchedExecutable(executable, invoked string) string {
	if filepath.IsAbs(invoked) && filepath.Clean(invoked) == invoked {
		actual, err := os.Stat(executable)
		launch, launchErr := os.Stat(invoked)
		if err == nil && launchErr == nil && os.SameFile(actual, launch) {
			return invoked
		}
	}
	return executable
}
