//go:build linux

package daemon

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/open-habitat/open-habitat/internal/transport"
)

var modelFamily = regexp.MustCompile(`^gpt-([0-9]+(?:\.[0-9]+)*)-([a-z]+)$`)
var claudeFamily = regexp.MustCompile(`^claude-([a-z]+)-([0-9]+(?:-[0-9]+)*)$`)
var modelGeneration = regexp.MustCompile(`^gpt-([0-9]+)(?:\.|-|$)`)

// Claude ids name the same families whether they come through the bridge or an
// Anthropic API key.
func claudeModel(m piModel) bool {
	return m.Provider == "claude-bridge" || m.Provider == "anthropic"
}

// Unknown names remain offered: a future family must not require a host release.
func groupModels(models []piModel) {
	best := map[string]int{}
	for i := range models {
		models[i].Older = false
		parts := modelFamily.FindStringSubmatch(models[i].ID)
		if claudeModel(models[i]) {
			if match := claudeFamily.FindStringSubmatch(models[i].ID); match != nil {
				parts = []string{match[0], strings.ReplaceAll(match[2], "-", "."), match[1]}
			}
		}
		if parts == nil {
			if generation := modelGeneration.FindStringSubmatch(models[i].ID); generation != nil {
				major, _ := strconv.Atoi(generation[1])
				models[i].Older = major < 6
			}
			continue
		}
		major, _ := strconv.Atoi(strings.Split(parts[1], ".")[0])
		// Known families compete across versions (Pi 1.5.2's Codex catalog
		// has Terra 5.6 and 6.1); pre-6 legacy suffixes such as mini remain
		// in the older group.
		known := claudeModel(models[i]) || parts[2] == "luna" || parts[2] == "terra" || parts[2] == "sol" || parts[2] == "astra"
		if major < 6 && !known {
			models[i].Older = true
			continue
		}
		family := models[i].Provider + "/" + parts[2]
		old, found := best[family]
		if !found {
			best[family] = i
			continue
		}
		previous := modelFamily.FindStringSubmatch(models[old].ID)
		if claudeModel(models[old]) {
			match := claudeFamily.FindStringSubmatch(models[old].ID)
			previous = []string{match[0], strings.ReplaceAll(match[2], "-", "."), match[1]}
		}
		if compareModelVersions(parts[1], previous[1]) > 0 {
			models[old].Older = true
			best[family] = i
		} else {
			models[i].Older = true
		}
	}
}
func compareModelVersions(a, b string) int {
	aa, bb := strings.Split(a, "."), strings.Split(b, ".")
	for i := 0; i < len(aa) || i < len(bb); i++ {
		var x, y int
		if i < len(aa) {
			x, _ = strconv.Atoi(aa[i])
		}
		if i < len(bb) {
			y, _ = strconv.Atoi(bb[i])
		}
		if x > y {
			return 1
		}
		if x < y {
			return -1
		}
	}
	return 0
}

type modelObservation struct{ Outcome, At string }

// Read at most the 32 newest sessions, 512 KiB of complete trailing entries per
// session (16 MiB total), within a two-second budget after bounded discovery.
// No index, probing, provider text, or observation survives this request.
func modelObservations(ctx context.Context, home string) map[string]modelObservation {
	result := map[string]modelObservation{}
	sessions, err := nativeSessions(transport.Config{Home: home, UID: os.Geteuid()})
	if err != nil {
		return result
	}
	// Recent means native activity, not creation: a long-running session can
	// contain today's response even when newer empty sessions exist.
	modified := make(map[string]time.Time, len(sessions))
	for _, session := range sessions {
		if st, err := os.Lstat(session.path); err == nil {
			modified[session.path] = st.ModTime()
		}
	}
	sort.Slice(sessions, func(i, j int) bool { return modified[sessions[i].path].After(modified[sessions[j].path]) })
	if len(sessions) > 32 {
		sessions = sessions[:32]
	}
	deadline := time.Now().Add(2 * time.Second)
	for _, s := range sessions {
		if ctx.Err() != nil || time.Now().After(deadline) {
			break
		}
		if s.cwd == "" || s.state != "readable" {
			continue
		}
		scanModelObservations(s.path, result)
	}
	return result
}
func scanModelObservations(path string, result map[string]modelObservation) {
	fd, err := syscall.Open(path, syscall.O_RDONLY|syscall.O_NOFOLLOW|syscall.O_NONBLOCK|syscall.O_CLOEXEC, 0)
	if err != nil {
		return
	}
	f := os.NewFile(uintptr(fd), path)
	defer f.Close()
	st, err := f.Stat()
	if err != nil || !st.Mode().IsRegular() {
		return
	}
	owner, ok := fileOwner(st)
	if !ok || owner != os.Geteuid() {
		return
	}
	// An incomplete final append is not durable evidence.
	var last [1]byte
	if st.Size() == 0 {
		return
	}
	if _, err = f.ReadAt(last[:], st.Size()-1); err != nil || last[0] != '\n' {
		return
	}
	const tail = 512 * 1024
	offset := st.Size() - tail
	if offset < 0 {
		offset = 0
	}
	if _, err = f.Seek(offset, io.SeekStart); err != nil {
		return
	}
	reader := bufio.NewReader(io.LimitReader(f, tail))
	if offset > 0 {
		if _, err = reader.ReadBytes('\n'); err != nil {
			return
		}
	}
	// Stage observations until the file's identity/size are checked again.
	found := map[string]modelObservation{}
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 4096), tail)
	for scanner.Scan() {
		var e struct {
			Type      string `json:"type"`
			Timestamp string `json:"timestamp"`
			Message   struct {
				Role         string `json:"role"`
				Provider     string `json:"provider"`
				Model        string `json:"model"`
				StopReason   string `json:"stopReason"`
				ErrorMessage string `json:"errorMessage"`
				Content      []struct {
					Type string `json:"type"`
					Text string `json:"text"`
				} `json:"content"`
			} `json:"message"`
		}
		if json.Unmarshal(scanner.Bytes(), &e) != nil || e.Type != "message" || e.Message.Role != "assistant" || (e.Message.Provider != "openai-codex" && e.Message.Provider != "claude-bridge") || e.Message.Model == "" || len(e.Message.Model) > 160 {
			continue
		}
		at, err := time.Parse(time.RFC3339Nano, e.Timestamp)
		if err != nil || at.After(time.Now().Add(time.Minute)) {
			continue
		}
		outcome := ""
		if e.Message.StopReason == "error" && modelUnsupported(e.Message.ErrorMessage) {
			outcome = "refused"
		} else if (e.Message.StopReason == "stop" || e.Message.StopReason == "length" || e.Message.StopReason == "toolUse") && e.Message.ErrorMessage == "" {
			for _, b := range e.Message.Content {
				if b.Type == "text" && strings.TrimSpace(b.Text) != "" {
					outcome = "answered"
					break
				}
			}
		}
		if outcome == "" {
			continue
		}
		observation := modelObservation{Outcome: outcome, At: at.UTC().Format(time.RFC3339Nano)}
		key := e.Message.Model
		if e.Message.Provider == "claude-bridge" {
			key = "claude-bridge/" + key
		}
		previous := found[key]
		if previous.At == "" || newerObservation(observation, previous) {
			found[key] = observation
		}
	}
	after, err := f.Stat()
	if err != nil || !os.SameFile(st, after) || st.Size() != after.Size() || !st.ModTime().Equal(after.ModTime()) {
		return
	}
	for id, observation := range found {
		if previous, ok := result[id]; !ok || newerObservation(observation, previous) {
			result[id] = observation
		}
	}
}
func newerObservation(a, b modelObservation) bool {
	aa, _ := time.Parse(time.RFC3339Nano, a.At)
	bb, _ := time.Parse(time.RFC3339Nano, b.At)
	return aa.After(bb)
}
