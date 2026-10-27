//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

//go:embed context_detail_helper.mjs
var contextDetailHelper string

// ContextDetailPattern is the context page's read: what fills the model's
// context in one native session, by Pi's own reading of its session file.
const ContextDetailPattern = "/api/v1/agents/{agent}/context"

const contextDetailOutput = 1 << 20

type contextPart struct {
	Name     string `json:"name"`
	Tokens   int64  `json:"tokens"`
	Replaced bool   `json:"replaced,omitempty"`
}
type contextOutput struct {
	Name   string `json:"name"`
	Turn   int64  `json:"turn"`
	Tokens int64  `json:"tokens"`
}
type contextCompaction struct {
	At               string   `json:"at"`
	AfterTurn        int64    `json:"after_turn"`
	KeptFromTurn     int64    `json:"kept_from_turn"`
	TokensBefore     int64    `json:"tokens_before"`
	Summary          string   `json:"summary"`
	SummaryTruncated bool     `json:"summary_truncated"`
	SummaryTokens    int64    `json:"summary_tokens"`
	ReadFiles        []string `json:"read_files"`
	ModifiedFiles    []string `json:"modified_files"`
}
type contextNext struct {
	FromTurn         int64 `json:"from_turn"`
	ThroughTurn      int64 `json:"through_turn"`
	KeptFromTurn     int64 `json:"kept_from_turn"`
	SplitTurn        bool  `json:"split_turn"`
	SummarizedTokens int64 `json:"summarized_tokens"`
}
type contextTurn struct {
	N             int64   `json:"n"`
	At            string  `json:"at"`
	Request       string  `json:"request"`
	Replies       int64   `json:"replies"`
	ContextTokens *int64  `json:"context_tokens,omitempty"`
	Input         int64   `json:"input"`
	Output        int64   `json:"output"`
	CacheRead     int64   `json:"cache_read"`
	CacheWrite    int64   `json:"cache_write"`
	Cost          float64 `json:"cost"`
}
type contextDetail struct {
	SchemaVersion   int    `json:"schema_version"`
	AgentID         string `json:"agent_id"`
	Harness         string `json:"harness"`
	Model           string `json:"model,omitempty"`
	MeasuredTokens  *int64 `json:"measured_tokens,omitempty"`
	EstimatedTokens int64  `json:"estimated_tokens"`
	TrailingTokens  int64  `json:"trailing_tokens"`
	Settings        *struct {
		Enabled          bool  `json:"enabled"`
		ReserveTokens    int64 `json:"reserve_tokens"`
		KeepRecentTokens int64 `json:"keep_recent_tokens"`
	} `json:"settings,omitempty"`
	Parts struct {
		Instructions int64 `json:"instructions"`
		Tools        int64 `json:"tools"`
		Summary      int64 `json:"summary"`
		Conversation int64 `json:"conversation"`
		ToolOutput   int64 `json:"tool_output"`
		Attachments  int64 `json:"attachments"`
	} `json:"parts"`
	Instructions []contextPart `json:"instructions"`
	Tools        []contextPart `json:"tools"`
	Conversation struct {
		User      int64 `json:"user"`
		Assistant int64 `json:"assistant"`
		Thinking  int64 `json:"thinking"`
		ToolCalls int64 `json:"tool_calls"`
		Other     int64 `json:"other"`
	} `json:"conversation"`
	LargestOutputs []contextOutput     `json:"largest_outputs"`
	Compactions    []contextCompaction `json:"compactions"`
	NextCompaction *contextNext        `json:"next_compaction"`
	Turns          []contextTurn       `json:"turns"`
	TurnsOmitted   int64               `json:"turns_omitted"`
}

func ContextDetailHandler(cfg transport.Config, trusted func(*http.Request) bool, pi *PiDevice) http.Handler {
	return contextDetailHandler(cfg, trusted, pi, nativeSessions)
}

// ContextDetailHandlerWithNativeRoot confines a browser-host fixture to a disposable root.
func ContextDetailHandlerWithNativeRoot(cfg transport.Config, trusted func(*http.Request) bool, pi *PiDevice, root string) http.Handler {
	cfg.Home = root
	return contextDetailHandler(cfg, trusted, pi, func(c transport.Config) ([]nativeSession, error) { c.Home = root; return nativeSessions(c) })
}

func contextDetailHandler(cfg transport.Config, trusted func(*http.Request) bool, pi *PiDevice, sessionsReader func(transport.Config) ([]nativeSession, error)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) || r.Method != "GET" || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		id := r.PathValue("agent")
		if !strings.HasPrefix(id, "pi:") || !sessionIDPattern.MatchString(strings.TrimPrefix(id, "pi:")) || r.URL.RawQuery != "" || r.URL.EscapedPath() != "/api/v1/agents/"+id+"/context" {
			snapshotError(w, 400, "invalid_request")
			return
		}
		sessions, err := sessionsReader(cfg)
		if err != nil {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		var s *nativeSession
		for i := range sessions {
			if "pi:"+sessions[i].id == id {
				if s != nil {
					snapshotError(w, 503, "native_source_unavailable")
					return
				}
				s = &sessions[i]
			}
		}
		if s == nil {
			snapshotError(w, 404, "resource_not_found")
			return
		}
		if s.state != "readable" {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		detail, err := pi.contextDetail(r.Context(), s, cfg.UID)
		if err != nil {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		detail.AgentID = id
		historyJSON(w, detail)
	})
}

// contextDetail hands the session's complete records to Pi's own functions.
// The daemon reads the file itself (owned, regular, stable), so the helper
// never opens a path it was given.
func (p *PiDevice) contextDetail(ctx context.Context, s *nativeSession, uid int) (contextDetail, error) {
	var result contextDetail
	if err := p.validateConfiguration(); err != nil {
		return result, err
	}
	if err := p.validateSettings(); err != nil {
		return result, err
	}
	b, ok := readNativeBytes(s.path, uid)
	if !ok {
		b, ok = readNativeBytes(s.path, uid)
	}
	if !ok {
		return result, errors.New("native session unavailable")
	}
	line, err := bufio.NewReader(bytes.NewReader(b)).ReadBytes('\n')
	var h nativeHeader
	if err != nil || json.Unmarshal(line, &h) != nil || h.Type != "session" || h.Version != 3 || h.ID != s.id {
		return result, errors.New("native session changed")
	}
	// A record cut by a full disk is not Pi's; read the complete prefix.
	b = b[:bytes.LastIndexByte(b, '\n')+1]
	ctx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, p.Node, "--input-type=module", "--eval", contextDetailHelper, p.Entry, p.Manifest)
	env := []string{}
	for _, item := range os.Environ() {
		if !strings.HasPrefix(item, "HOME=") && !strings.HasPrefix(item, "NODE_OPTIONS=") && !strings.HasPrefix(item, "PI_CODING_AGENT_DIR=") {
			env = append(env, item)
		}
	}
	cmd.Env = append(env, "HOME="+p.Home, "PI_OFFLINE=1")
	cmd.Dir = p.Home
	cmd.Stdin = bytes.NewReader(b)
	cmd.Stderr = io.Discard
	cmd.WaitDelay = time.Second
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return result, err
	}
	if err := cmd.Start(); err != nil {
		return result, err
	}
	out, readErr := io.ReadAll(io.LimitReader(stdout, contextDetailOutput+1))
	if err := cmd.Wait(); err != nil || readErr != nil || len(out) > contextDetailOutput {
		return result, errors.New("native context unavailable")
	}
	decoder := json.NewDecoder(bytes.NewReader(out))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&result) != nil || result.SchemaVersion != 1 || !result.valid() {
		return contextDetail{}, errors.New("invalid native context")
	}
	return result, nil
}

// valid bounds what crosses the contract; the helper already caps each list.
func (d *contextDetail) valid() bool {
	if d.Harness != "pi" && d.Harness != "claude_code" || len(d.Model) > 200 || len(d.Instructions) > 40 || len(d.Tools) > 100 || len(d.LargestOutputs) > 5 || len(d.Compactions) > 20 || len(d.Turns) > 500 {
		return false
	}
	for _, c := range d.Compactions {
		if len(c.Summary) > 96000 || len(c.ReadFiles) > 50 || len(c.ModifiedFiles) > 50 {
			return false
		}
	}
	if d.Instructions == nil {
		d.Instructions = []contextPart{}
	}
	if d.Tools == nil {
		d.Tools = []contextPart{}
	}
	return d.LargestOutputs != nil && d.Compactions != nil && d.Turns != nil
}
