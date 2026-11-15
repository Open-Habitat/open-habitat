//go:build linux

package daemon

import "github.com/open-habitat/open-habitat/internal/transport"

// conversationPlaces is shared by the rail and agent discovery: Taskfleet's
// worktrees are workers, and a directory containing worktrees is not a workspace.
func conversationPlaces(cfg transport.Config, home string, observation Discovery, runs []nativeSpinoff, runsOK bool) (Discovery, map[string][]worktreePlace, map[string]worktreePlace) {
	if runsOK {
		observation.Entries = filterTaskfleetWorkspaces(home, observation.Entries, runs)
	}
	placesOf := map[string][]worktreePlace{}
	byPath := map[string]worktreePlace{}
	var all []worktreePlace
	for _, entry := range observation.Entries {
		if entry.Kind != "git_main_worktree" || entry.Error != "" || entry.Metadata == "error" {
			continue
		}
		found, _ := readWorktreePlaces(home, entry, workspaceIDOf(cfg, entry))
		all = append(all, found...)
		for _, p := range found {
			if runsOK && taskfleetOwned(runs, p.Path) {
				continue
			}
			placesOf[p.WorkspaceID] = append(placesOf[p.WorkspaceID], p)
			byPath[p.Path] = p
		}
	}
	if containers := worktreeContainers(home, observation.Entries, all); len(containers) > 0 {
		kept := make([]Workspace, 0, len(observation.Entries))
		for _, entry := range observation.Entries {
			if !containers[entry.Name] {
				kept = append(kept, entry)
			}
		}
		observation.Entries = kept
	}
	return observation, placesOf, byPath
}
