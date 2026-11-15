//go:build linux

package daemon

import (
	"net/http"
	"sort"
)

func (c *ConversationController) listNativeConversations(w http.ResponseWriter, r *http.Request) {
	read := nativeSessions
	title := func(s nativeSession) (string, string) {
		return firstPrompt(s, c.cfg.UID), nativeNameDisplay(s, c.cfg.UID)
	}
	if c.facts != nil {
		read = c.facts.sessions.read
		title = func(s nativeSession) (string, string) { return c.facts.sessions.title(s, c.cfg.UID) }
	}
	sessions, err := read(c.nativeCfg())
	visibility, visibilityErr := loadVisibility(c.home)
	if err != nil || visibilityErr != nil {
		// A partial handle list would look like history had disappeared again.
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	observation := c.discover(c.cfg)
	if observation.State == "error" || observation.State == "partial" {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	var runs []nativeSpinoff
	runsOK := false
	if c.facts != nil {
		runs, runsOK = c.facts.taskfleet.list(r.Context(), c.home)
	} else if taskfleetBinary(c.home) != "" {
		runs, runsOK = listTaskfleetRuns(r.Context(), c.home)
	}
	observation, _, places := conversationPlaces(c.cfg, c.home, observation, runs, runsOK)
	byPath := map[string]string{}
	seen := map[string]bool{}
	for _, entry := range observation.Entries {
		if entry.Error != "" {
			continue
		}
		id := workspaceIDOf(c.cfg, entry)
		if !idPattern.MatchString(id) || seen[id] {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		seen[id] = true
		byPath[c.home+"/src/"+entry.Name] = id
	}
	workspace := func(cwd string) string {
		if id := byPath[cwd]; id != "" {
			return id
		}
		if p, ok := places[cwd]; ok && seen[p.WorkspaceID] {
			return p.ID
		}
		return ""
	}
	processes := snapshotPiWriters(sessions, c.cfg.UID, c.ownPiPIDs())
	rows := map[string]map[string]any{}
	for _, s := range sessions {
		ws := workspace(s.cwd)
		if ws == "" {
			continue
		}
		name, _ := sessionTitle(title(s))
		lifecycle := "resting"
		if processes[s.path] == "writer_present" {
			lifecycle = "live"
		}
		rows[s.id] = map[string]any{"agent_id": "pi:" + s.id, "workspace_id": ws, "title": name, "lifecycle": lifecycle}
	}
	c.mu.Lock()
	for _, s := range c.sessions {
		row := rows[s.id]
		if row == nil {
			ws := workspace(s.cwd)
			if ws == "" && seen[s.workspace] {
				ws = s.workspace
			}
			if ws == "" {
				continue
			}
			name, _ := sessionTitle("", s.givenName)
			row = map[string]any{"agent_id": "pi:" + s.id, "workspace_id": ws, "title": name, "lifecycle": "resting"}
			rows[s.id] = row
		}
		if liveChild(s) {
			row["lifecycle"] = "live"
		}
		row["state"] = s.state
		row["startup_choice"] = s.startupChoice
	}
	c.mu.Unlock()
	items := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		if archiveFact(visibility, nil, row["agent_id"].(string)) == "archived" {
			row["lifecycle"] = "archived"
		}
		items = append(items, row)
	}
	sort.Slice(items, func(i, j int) bool { return items[i]["agent_id"].(string) < items[j]["agent_id"].(string) })
	historyJSON(w, map[string]any{"schema_version": 1, "sessions": items})
}
