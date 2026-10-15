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
	ID   string `json:"id"`
	Name string `json:"name"`
}
type piModelsResponse struct {
	SchemaVersion int       `json:"schema_version"`
	DefaultModel  *string   `json:"default_model"`
	Models        []piModel `json:"models"`
}

// Models are Pi's catalog and default, never a host-owned preference.
func (p *PiDevice) models(ctx context.Context, selected string) (piModelsResponse, error) {
	var result piModelsResponse
	if err := p.validate(); err != nil {
		return result, err
	}
	if err := p.validateCredentials(); err != nil {
		return result, err
	}
	// Pi's SettingsManager follows these paths. Do not write through a foreign symlink.
	for i, path := range []string{filepath.Join(p.Home, ".pi", "agent", "settings.json"), filepath.Join(p.Home, ".pi", "agent", "settings.json.lock")} {
		st, err := os.Lstat(path)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil || st.Mode()&os.ModeSymlink != 0 || st.Sys().(*syscall.Stat_t).Uid != uint32(os.Geteuid()) || (i == 0 && (!st.Mode().IsRegular() || st.Mode().Perm()&0022 != 0)) {
			return result, errors.New("unsafe Pi settings path")
		}
	}
	ctx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()
	action := "list"
	if selected != "" {
		action = "select"
	}
	cmd := exec.CommandContext(ctx, p.Node, "--input-type=module", "--eval", piModelsHelper, p.Entry, p.Manifest, action, selected)
	env := []string{}
	for _, item := range os.Environ() {
		if !strings.HasPrefix(item, "HOME=") && !strings.HasPrefix(item, "NODE_OPTIONS=") && !strings.HasPrefix(item, "PI_CODING_AGENT_DIR=") {
			env = append(env, item)
		}
	}
	cmd.Env = append(env, "HOME="+p.Home, "PI_OFFLINE=1")
	cmd.Dir = p.Home
	cmd.Stderr = io.Discard
	cmd.WaitDelay = time.Second
	out, err := cmd.Output()
	if err != nil || len(out) > 16384 || json.Unmarshal(out, &result) != nil || result.SchemaVersion != 1 || len(result.Models) > 100 {
		return piModelsResponse{}, errors.New("native Pi models unavailable")
	}
	for _, m := range result.Models {
		if m.ID == "" || len(m.ID) > 160 || len(m.Name) > 200 {
			return piModelsResponse{}, errors.New("invalid native Pi model")
		}
	}
	return result, nil
}

func PiModelsHandler(cfg transport.Config, trusted func(*http.Request) bool, pi *PiDevice) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/pi/models" || r.URL.RawQuery != "" || !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		var selected string
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
				Model string `json:"model"`
			}
			decoder := json.NewDecoder(io.LimitReader(r.Body, 513))
			decoder.DisallowUnknownFields()
			if decoder.Decode(&input) != nil || decoder.Decode(new(any)) != io.EOF || len(input.Model) == 0 || len(input.Model) > 160 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			selected = input.Model
		default:
			snapshotError(w, 405, "method_not_allowed")
			return
		}
		_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(14 * time.Second))
		response, err := pi.models(r.Context(), selected)
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
