//go:build linux

package daemon

import (
	"encoding/json"
	"regexp"
)

// process-extension.mjs appends this when it gives an agent the upgrade
// announcement (upgradeNoticeMessage). Its text is the agent's, in English;
// the person reads Habitat's line built from the details.
const upgradeNoticeMessageType = "oh-upgrade-notice"

var upgradeVersionPattern = regexp.MustCompile(`^[0-9A-Za-z][0-9A-Za-z.+~-]{0,63}$`)

// upgradeNoticeLine is history.schema.json#/$defs/upgradeNotice.
type upgradeNoticeLine struct {
	Version   string           `json:"version"`
	Deadline  string           `json:"deadline"`
	Variant   string           `json:"variant"`
	Processes []restartProcess `json:"processes"`
}

func nativeUpgradeNotice(e nativeEntry) (historyEntry, bool) {
	raw := e.Raw
	if e.Type == "message" {
		raw = e.Message
	} else if e.Type != "custom_message" {
		return historyEntry{}, false
	}
	var m struct {
		Role       string `json:"role"`
		CustomType string `json:"customType"`
		Display    bool   `json:"display"`
		Details    struct {
			Version   string `json:"version"`
			Deadline  string `json:"deadline"`
			Variant   string `json:"variant"`
			Processes []struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			} `json:"processes"`
		} `json:"details"`
	}
	if json.Unmarshal(raw, &m) != nil || m.CustomType != upgradeNoticeMessageType || e.Type == "message" && m.Role != "custom" {
		return historyEntry{}, false
	}
	out := historyEntry{Key: e.ID, Timestamp: nativeTimestamp(e.Timestamp)}
	d := m.Details
	if !m.Display || !upgradeVersionPattern.MatchString(d.Version) || !validStamp(d.Deadline) || d.Variant != "busy" && d.Variant != "idle" {
		return out, true
	}
	line := upgradeNoticeLine{Version: d.Version, Deadline: nativeTimestamp(d.Deadline), Variant: d.Variant, Processes: []restartProcess{}}
	for _, p := range d.Processes {
		if len(line.Processes) < 20 && processIDPattern.MatchString(p.ID) {
			line.Processes = append(line.Processes, restartProcess{p.ID, prefixBytes(p.Name, 200)})
		}
	}
	out.Kind = "unknown"
	out.Content = historyContent{MediaType: "text/plain", Text: "", Complete: true}
	out.UpgradeNotice = &line
	return out, true
}
