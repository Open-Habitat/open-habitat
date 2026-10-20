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
	"regexp"
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

//go:embed pi_credentials_helper.mjs
var piCredentialsHelper string

var literalOpenAIKey = regexp.MustCompile(`^sk-[A-Za-z0-9_-]{20,200}$`)

type piCredentials struct {
	SchemaVersion int `json:"schema_version"`
	OpenAI        struct {
		Present bool    `json:"present"`
		Suffix  *string `json:"suffix"`
	} `json:"openai"`
	Subscription struct {
		Present bool `json:"present"`
	} `json:"subscription"`
}

func (p *PiDevice) credentials(parent context.Context, action, key string) (piCredentials, error) {
	var result piCredentials
	fail := errors.New("native Pi credentials unavailable")
	if action != "read" && action != "save" && action != "remove" {
		return result, fail
	}
	if action == "save" && !literalOpenAIKey.MatchString(key) {
		return result, fail
	}
	if p.validate() != nil || p.validateCredentials() != nil || p.validateSettings() != nil {
		return result, fail
	}
	ctx, cancel := context.WithTimeout(parent, 12*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, p.Node, "--input-type=module", "--eval", piCredentialsHelper, p.Entry, p.Manifest, action)
	var env []string
	for _, item := range os.Environ() {
		if !strings.HasPrefix(item, "HOME=") && !strings.HasPrefix(item, "NODE_OPTIONS=") && !strings.HasPrefix(item, "PI_CODING_AGENT_DIR=") {
			env = append(env, item)
		}
	}
	cmd.Env = append(env, "HOME="+p.Home, "PI_OFFLINE=1")
	cmd.Dir = p.Home
	cmd.Stdin = strings.NewReader(key)
	cmd.Stderr = &storageDiagnostics{operation: "pi_credentials"}
	cmd.WaitDelay = time.Second
	out, err := cmd.Output()
	if err != nil || len(out) > 1024 || json.Unmarshal(out, &result) != nil || result.SchemaVersion != 1 {
		return piCredentials{}, fail
	}
	if result.OpenAI.Suffix != nil && !regexp.MustCompile(`^[A-Za-z0-9_-]{4}$`).MatchString(*result.OpenAI.Suffix) {
		return piCredentials{}, fail
	}
	return result, nil
}

func PiCredentialsHandler(cfg transport.Config, trusted func(*http.Request) bool, pi *PiDevice) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.URL.RawQuery != "" {
			snapshotError(w, 400, "invalid_request")
			return
		}
		action, key := "", ""
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/pi/credentials":
			action = "read"
		case r.Method == http.MethodDelete && r.URL.Path == "/api/v1/pi/credentials/openai":
			action = "remove"
		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/pi/credentials":
			if r.Header.Get("Content-Type") != "application/json" || r.ContentLength <= 0 || r.ContentLength > 512 || len(r.TransferEncoding) != 0 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			var input struct {
				Provider string `json:"provider"`
				Key      string `json:"key"`
			}
			decoder := json.NewDecoder(io.LimitReader(r.Body, 513))
			decoder.DisallowUnknownFields()
			if decoder.Decode(&input) != nil || decoder.Decode(new(any)) != io.EOF || input.Provider != "openai" || !literalOpenAIKey.MatchString(input.Key) {
				snapshotError(w, 400, "invalid_request")
				return
			}
			action, key = "save", input.Key
		default:
			snapshotError(w, 405, "method_not_allowed")
			return
		}
		if action != "save" && (r.ContentLength > 0 || len(r.TransferEncoding) != 0) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(14 * time.Second))
		result, err := pi.credentials(r.Context(), action, key)
		if err != nil {
			snapshotError(w, 503, "native_unavailable")
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		historyJSON(w, result)
	})
}
