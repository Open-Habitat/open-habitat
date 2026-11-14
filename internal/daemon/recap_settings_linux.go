//go:build linux

package daemon

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/open-habitat/open-habitat/internal/transport"
)

// RecapSettingsPath is the person's conversation recap settings. They live in
// Pi's own settings.json under openHabitat.recap, beside the default model,
// so the recap extension reads them where Pi keeps its other preferences and
// no second settings store exists.
const RecapSettingsPath = "/api/v1/pi/recap-settings"

//go:embed recap_settings_helper.mjs
var recapSettingsHelper string

// recapSettings is the wire form (contracts/v1/recap-settings.schema.json).
type recapSettings struct {
	Level           string  `json:"level"`
	DelaySeconds    int     `json:"delay_seconds"`
	Model           *string `json:"model"`
	Words           int     `json:"words"`
	NextWords       int     `json:"next_words"`
	Messages        int     `json:"messages"`
	HistoryTokens   int     `json:"history_tokens"`
	MessageTokens   int     `json:"message_tokens"`
	ResponseTokens  int     `json:"response_tokens"`
	FirstAfterTurns int     `json:"first_after_turns"`
}

// The defaults are what the recap did before it had settings, so a person
// who never opens the section sees no change.
var defaultRecapSettings = recapSettings{Level: "standard", DelaySeconds: 180, Words: 40, NextWords: 12, Messages: 64, HistoryTokens: 16000, MessageTokens: 1000, ResponseTokens: 512, FirstAfterTurns: 1}

// recapField is one number: its name in Pi's settings.json
// (as Pi names its own keys; recap-extension.mjs reads these) and its bounds.
// The lower delay is the browser's presence cadence (recapHold.ts): a shorter
// delay would fire while the person is still reading. The upper one is an
// hour; a longer delay outlasts Pi's idle stop, which hands the recap to a
// rested Pi started for it in the background place (background_linux.go). The other bounds keep a
// recap within the extension's 20-second budget.
type recapField struct {
	stored   string
	min, max int
	value    func(*recapSettings) *int
}

var recapFields = []recapField{
	{"delaySeconds", 60, 3600, func(s *recapSettings) *int { return &s.DelaySeconds }},
	{"words", 10, 80, func(s *recapSettings) *int { return &s.Words }},
	{"nextWords", 4, 25, func(s *recapSettings) *int { return &s.NextWords }},
	{"messages", 4, 128, func(s *recapSettings) *int { return &s.Messages }},
	{"historyTokens", 2000, 32000, func(s *recapSettings) *int { return &s.HistoryTokens }},
	{"messageTokens", 250, 4000, func(s *recapSettings) *int { return &s.MessageTokens }},
	{"responseTokens", 128, 2048, func(s *recapSettings) *int { return &s.ResponseTokens }},
	{"firstAfterTurns", 1, 10, func(s *recapSettings) *int { return &s.FirstAfterTurns }},
}

var recapModelPattern = regexp.MustCompile(`^(openai-codex|openai|anthropic|deepseek|claude-bridge)/[^\s/]+$`)
var modelWord = regexp.MustCompile(`[^a-z0-9]+`)

// backgroundExcluded mirrors EXCLUDED_FAMILIES in background-model.mjs: a
// whole word of the id. The extension skips such a preference anyway; the
// daemon refuses to store one so the settings never show a model that is
// not used.
func backgroundExcluded(model string) bool {
	for _, word := range modelWord.Split(strings.ToLower(model), -1) {
		if word == "fable" || word == "opus" {
			return true
		}
	}
	return false
}

func validRecapModel(model *string) bool {
	return model == nil || len(*model) <= 200 && recapModelPattern.MatchString(*model) && !backgroundExcluded(*model)
}

func validRecapLevel(level string) bool {
	return level == "off" || level == "short" || level == "standard" || level == "thorough" || level == "custom"
}

func (s recapSettings) valid() bool {
	for _, f := range recapFields {
		if v := *f.value(&s); v < f.min || v > f.max {
			return false
		}
	}
	return validRecapLevel(s.Level) && validRecapModel(s.Model)
}

// stored is the settings.json object; an automatic model is no key at all.
func (s recapSettings) stored() map[string]any {
	out := map[string]any{"level": s.Level}
	if s.Model != nil {
		out["model"] = *s.Model
	}
	for _, f := range recapFields {
		out[f.stored] = *f.value(&s)
	}
	return out
}

// readRecapSettings reads the stored settings. A person may edit the file by
// hand, so each value that is missing or out of bounds takes its default
// rather than discarding the rest; an unreadable file is an error.
func readRecapSettings(home string) (recapSettings, error) {
	result := defaultRecapSettings
	file, err := os.Open(filepath.Join(home, ".pi", "agent", "settings.json"))
	if errors.Is(err, os.ErrNotExist) {
		return result, nil
	}
	if err != nil {
		return result, err
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, 65537))
	if err != nil || len(data) > 65536 {
		return result, errors.New("unreadable Pi settings")
	}
	var settings struct {
		OpenHabitat struct {
			Recap map[string]json.RawMessage `json:"recap"`
		} `json:"openHabitat"`
	}
	if json.Unmarshal(data, &settings) != nil {
		return result, errors.New("invalid Pi settings")
	}
	raw := settings.OpenHabitat.Recap
	if raw == nil {
		return result, nil
	}
	for _, f := range recapFields {
		var v int
		if json.Unmarshal(raw[f.stored], &v) == nil && v >= f.min && v <= f.max {
			*f.value(&result) = v
		}
	}
	var level, model string
	if json.Unmarshal(raw["level"], &level) == nil && validRecapLevel(level) {
		result.Level = level
	} else {
		result.Level = "custom"
	}
	if json.Unmarshal(raw["model"], &model) == nil && validRecapModel(&model) {
		result.Model = &model
	}
	return result, nil
}

func automaticRecapsEnabled(home string) bool {
	settings, _ := readRecapSettings(home)
	return settings.Level != "off"
}

// recapDelay is the automatic recap's quiet time. An unreadable settings
// file keeps the default rather than stopping recaps.
func recapDelay(home string) time.Duration {
	settings, err := readRecapSettings(home)
	if err != nil {
		settings = defaultRecapSettings
	}
	return time.Duration(settings.DelaySeconds) * time.Second
}

// saveRecapSettings writes through Pi's own SettingsManager, under its lock,
// so a concurrent Pi write of another key is neither lost nor torn.
func (p *PiDevice) saveRecapSettings(ctx context.Context, value recapSettings) error {
	if !value.valid() {
		return errors.New("invalid recap settings")
	}
	if err := p.validateConfiguration(); err != nil {
		return err
	}
	if err := p.validateSettings(); err != nil {
		return err
	}
	stored, err := json.Marshal(value.stored())
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, p.Node, "--input-type=module", "--eval", recapSettingsHelper, p.Entry, p.Manifest, string(stored))
	env := []string{}
	for _, item := range os.Environ() {
		if !strings.HasPrefix(item, "HOME=") && !strings.HasPrefix(item, "NODE_OPTIONS=") && !strings.HasPrefix(item, "PI_CODING_AGENT_DIR=") {
			env = append(env, item)
		}
	}
	cmd.Env = append(env, "HOME="+p.Home, "PI_OFFLINE=1")
	cmd.Dir = p.Home
	cmd.Stderr = &storageDiagnostics{operation: "recap_settings"}
	cmd.WaitDelay = time.Second
	out, err := cmd.Output()
	if err != nil || strings.TrimSpace(string(out)) != `{"saved":true}` {
		return errors.New("recap settings not saved")
	}
	return nil
}

func RecapSettingsHandler(cfg transport.Config, trusted func(*http.Request) bool, pi *PiDevice) http.Handler {
	return recapSettingsHandlerAt(cfg, trusted, pi, RecapSettingsPath)
}

// recapSettingsHandlerAt serves the same read and write at path, for the
// browser's route or the agent listener's.
func recapSettingsHandlerAt(cfg transport.Config, trusted func(*http.Request) bool, pi *PiDevice, path string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != path || r.URL.EscapedPath() != path || r.URL.RawQuery != "" || !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		switch r.Method {
		case http.MethodGet:
			if r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
				snapshotError(w, 400, "invalid_request")
				return
			}
		case http.MethodPut:
			if r.Header.Get("Content-Type") != "application/json" || r.ContentLength <= 0 || r.ContentLength > 1024 || len(r.TransferEncoding) != 0 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			body, err := io.ReadAll(io.LimitReader(r.Body, 1025))
			var value recapSettings
			decoder := json.NewDecoder(bytes.NewReader(body))
			decoder.DisallowUnknownFields()
			if err != nil || int64(len(body)) != r.ContentLength || !utf8.Valid(body) || !catalogNoDuplicates(body) || !recapSettingsComplete(body) || decoder.Decode(&value) != nil || decoder.Decode(new(any)) != io.EOF || !value.valid() {
				snapshotError(w, 400, "invalid_request")
				return
			}
			if err := pi.saveRecapSettings(r.Context(), value); err != nil {
				snapshotError(w, 503, "recap_settings_unavailable")
				return
			}
		default:
			snapshotError(w, 405, "method_not_allowed")
			return
		}
		settings, err := readRecapSettings(cfg.Home)
		if err != nil {
			snapshotError(w, 503, "recap_settings_unavailable")
			return
		}
		historyJSON(w, map[string]any{"schema_version": 1, "settings": settings})
	})
}

// A write replaces every setting: a field the browser forgot must not
// silently become zero.
func recapSettingsComplete(body []byte) bool {
	var fields map[string]json.RawMessage
	if json.Unmarshal(body, &fields) != nil || len(fields) != 10 {
		return false
	}
	for _, name := range []string{"level", "delay_seconds", "model", "words", "next_words", "messages", "history_tokens", "message_tokens", "response_tokens", "first_after_turns"} {
		if _, ok := fields[name]; !ok {
			return false
		}
	}
	return true
}
