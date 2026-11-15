//go:build linux

package daemon

import "github.com/open-habitat/open-habitat/internal/transport"

// conversationPlaces is shared by the rail and agent discovery: Taskfleet's
// worktrees are workers. Discovery already excludes worktree containers.
func conversationPlaces(cfg transport.Config, home string, observation Discovery, runs []nativeSpinoff, runsOK bool) (Discovery, map[string][]worktreePlace, map[string]worktreePlace) {
	if runsOK {
		observation.Entries = filterTaskfleetWorkspaces(home, observation.Entries, runs)
	}
	placesOf := map[string][]worktreePlace{}
	byPath := map[string]worktreePlace{}
	for _, entry := range observation.Entries {
		if entry.Kind != "git_main_worktree" || entry.Error != "" || entry.Metadata == "error" {
			continue
		}
		found, _ := readWorktreePlaces(home, entry, workspaceIDOf(cfg, entry))
		for _, p := range found {
			if runsOK && taskfleetOwned(runs, p.Path) {
				continue
			}
			placesOf[p.WorkspaceID] = append(placesOf[p.WorkspaceID], p)
			byPath[p.Path] = p
		}
	}
	return observation, placesOf, byPath
}
