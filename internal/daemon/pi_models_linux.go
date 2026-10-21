//go:build linux

package daemon

import (
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

//go:embed pi_models_helper.mjs
var piModelsHelper string

type piModel struct {
	Provider       string   `json:"provider,omitempty"`
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Older          bool     `json:"older,omitempty"`
	Outcome        string   `json:"outcome,omitempty"`
	ObservedAt     string   `json:"observed_at,omitempty"`
	ThinkingLevels []string `json:"thinking_levels,omitempty"`
}
type piModelsResponse struct {
	SchemaVersion   int       `json:"schema_version"`
	DefaultProvider *string   `json:"default_provider"`
	DefaultModel    *string   `json:"default_model"`
	DefaultThinking string    `json:"default_thinking,omitempty"`
	CatalogStatus   string    `json:"catalog_status,omitempty"`
	Models          []piModel `json:"models"`
}

// Models are Pi's catalog and default, never a host-owned preference.
func (p *PiDevice) catalog(ctx context.Context, selected string, thinking ...string) (piModelsResponse, error) {
	action := "list"
	if selected != "" {
		action = "select"
	}
	return p.modelSettings(ctx, action, selected, thinking...)
}

func (p *PiDevice) modelSettings(ctx context.Context, action, selected string, thinking ...string) (piModelsResponse, error) {
	var result piModelsResponse
	if err := p.validateConfiguration(); err != nil {
		return result, err
	}
	if err := p.validateCredentials(); err != nil {
		return result, err
	}
	if err := p.validateSettings(); err != nil {
		return result, err
	}
	ctx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, p.Node, "--input-type=module", "--eval", piModelsHelper, p.Entry, p.Manifest, action, selected)
	env := []string{}
	for _, item := range os.Environ() {
		if !strings.HasPrefix(item, "HOME=") && !strings.HasPrefix(item, "NODE_OPTIONS=") && !strings.HasPrefix(item, "PI_CODING_AGENT_DIR=") && !strings.HasPrefix(item, "OH_PI_THINKING=") && !strings.HasPrefix(item, "OH_PI_PROVIDER=") {
			env = append(env, item)
		}
	}
	level := ""
	if len(thinking) > 0 {
		level = thinking[0]
	}
	provider := "openai-codex"
	if len(thinking) > 1 {
		provider = thinking[1]
	}
	cmd.Env = append(env, "HOME="+p.Home, "PI_OFFLINE=1", "OH_PI_THINKING="+level, "OH_PI_PROVIDER="+provider)
	cmd.Dir = p.Home
	cmd.Stderr = &storageDiagnostics{operation: "pi_models"}
	cmd.WaitDelay = time.Second
	out, err := cmd.Output()
	if err != nil || len(out) > 65536 || json.Unmarshal(out, &result) != nil || result.SchemaVersion != 1 || len(result.Models) > 100 {
		return piModelsResponse{}, errors.New("native Pi models unavailable")
	}
	for _, m := range result.Models {
		if m.ID == "" || len(m.ID) > 160 || len(m.Name) > 200 {
			return piModelsResponse{}, errors.New("invalid native Pi model")
		}
	}
	return result, nil
}

func (p *PiDevice) validateSettings() error {
	// Pi's SettingsManager follows these paths. Do not write through a foreign symlink.
	for i, path := range []string{filepath.Join(p.Home, ".pi", "agent", "settings.json"), filepath.Join(p.Home, ".pi", "agent", "settings.json.lock")} {
		st, err := os.Lstat(path)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil || st.Mode()&os.ModeSymlink != 0 || st.Sys().(*syscall.Stat_t).Uid != uint32(os.Geteuid()) || (i == 0 && (!st.Mode().IsRegular() || st.Mode().Perm()&0022 != 0)) {
			return errors.New("unsafe Pi settings path")
		}
	}
	return nil
}

// The picker derives observations on demand; create needs only native catalog
// validation, and must not reread unrelated conversation contents.
func (p *PiDevice) models(ctx context.Context, selected string, thinking ...string) (piModelsResponse, error) {
	result, err := p.catalog(ctx, selected, thinking...)
	if err != nil {
		return result, err
	}
	observations := modelObservations(ctx, p.Home)
	if result.CatalogStatus == "unavailable" {
		for id, o := range observations {
			if len(result.Models) >= 100 {
				break
			}
			provider := "openai-codex"
			if strings.HasPrefix(id, "claude-bridge/") {
				provider = "claude-bridge"
				id = strings.TrimPrefix(id, "claude-bridge/")
			}
			result.Models = append(result.Models, piModel{Provider: provider, ID: id, Name: id, Outcome: o.Outcome, ObservedAt: o.At})
		}
	}
	for i := range result.Models {
		key := result.Models[i].ID
		if result.Models[i].Provider == "claude-bridge" {
			key = "claude-bridge/" + key
		}
		if o, ok := observations[key]; ok && result.Models[i].Provider != "openai" {
			result.Models[i].Outcome = o.Outcome
			result.Models[i].ObservedAt = o.At
		}
	}
	groupModels(result.Models)
	return result, nil
}

func PiModelsHandler(cfg transport.Config, trusted func(*http.Request) bool, pi *PiDevice) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/pi/models" || r.URL.RawQuery != "" || !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		var selected, thinking, provider string
		switch r.Method {
		case http.MethodGet:
			if r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
				snapshotError(w, 400, "invalid_request")
				return
			}
		case http.MethodPost:
			if r.Header.Get("Content-Type") != "application/json" || r.ContentLength <= 0 || r.ContentLength > 512 || len(r.TransferEncoding) != 0 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			var input struct {
				Provider string `json:"provider"`
				Model    string `json:"model"`
				Thinking string `json:"thinking"`
			}
			decoder := json.NewDecoder(io.LimitReader(r.Body, 513))
			decoder.DisallowUnknownFields()
			if decoder.Decode(&input) != nil || decoder.Decode(new(any)) != io.EOF || len(input.Model) == 0 || len(input.Model) > 160 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			if input.Thinking != "" && !validThinking(input.Thinking) {
				snapshotError(w, 400, "invalid_request")
				return
			}
			if input.Provider != "" && input.Provider != "openai" && input.Provider != "openai-codex" && input.Provider != "claude-bridge" {
				snapshotError(w, 400, "invalid_request")
				return
			}
			provider = input.Provider
			if provider == "" {
				provider = "openai-codex"
			}
			selected = input.Model
			thinking = input.Thinking
		default:
			snapshotError(w, 405, "method_not_allowed")
			return
		}
		_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(14 * time.Second))
		response, err := pi.models(r.Context(), selected, thinking, provider)
		if err != nil {
			snapshotError(w, 503, "native_unavailable")
			return
		}
		b, _ := json.Marshal(response)
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Length", strconv.Itoa(len(b)))
		w.WriteHeader(200)
		_, _ = w.Write(b)
	})
}

func validThinking(level string) bool {
	switch level {
	case "off", "minimal", "low", "medium", "high", "xhigh", "max":
		return true
	}
	return false
}
