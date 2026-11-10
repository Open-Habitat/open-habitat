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
	"slices"
	"strings"
	"time"

	"github.com/open-habitat/open-habitat/internal/transport"
)

//go:embed pi_credentials_helper.mjs
var piCredentialsHelper string

// Pi accepts any string as a key, but runs `!…` values as commands and expands
// `$NAME` references when it resolves one; only a literal key may be written.
// OpenAI, Anthropic (sk-ant-…) and DeepSeek keys all share this shape.
var literalProviderKey = regexp.MustCompile(`^sk-[A-Za-z0-9_-]{20,200}$`)
var keySuffix = regexp.MustCompile(`^[A-Za-z0-9_-]{4}$`)

// Pi's own provider ids whose API keys a person manages here.
var piKeyProviders = []string{"openai", "anthropic", "deepseek"}

func piKeyProvider(provider string) bool {
	return slices.Contains(piKeyProviders, provider)
}

// Providers a conversation or the default model may name.
func piConversationProvider(provider string) bool {
	return provider == "openai-codex" || provider == "claude-bridge" || piKeyProvider(provider)
}

type piKeyState struct {
	Present bool    `json:"present"`
	Suffix  *string `json:"suffix"`
}

type piCredentials struct {
	SchemaVersion int        `json:"schema_version"`
	OpenAI        piKeyState `json:"openai"`
	Anthropic     piKeyState `json:"anthropic"`
	DeepSeek      piKeyState `json:"deepseek"`
	Subscription  struct {
		Present bool `json:"present"`
	} `json:"subscription"`
}

func (p *PiDevice) credentials(parent context.Context, action, provider, key string) (piCredentials, error) {
	out, err := p.credentialsHelper(parent, action, provider, key)
	return out.piCredentials, err
}

// helperResult is the credentials reply with the seed's or the site
// action's one word.
type helperResult struct {
	piCredentials
	seed, site string
}

// SeedSiteKey writes the site AI key (ADR 0030) into the person's Pi only
// where it has no credential of any kind for the provider, deciding under
// Pi's own file lock, so a key the person saved meanwhile, or a Claude
// sign-in kept under the same id, always stays. It answers seeded,
// already_present or failed. The helper writes the key before its settings
// step, so failed may still have left a usable key.
func (p *PiDevice) SeedSiteKey(ctx context.Context, provider, key string) string {
	out, err := p.credentialsHelper(ctx, "seed", provider, key)
	if err != nil || out.seed != "seeded" && out.seed != "already_present" {
		return "failed"
	}
	return out.seed
}

// SiteKeyInput carries the gateway's salted fingerprints of the site keys
// (ADR 0030) into the person's own UID, where they are compared; nothing
// about a credential the person added leaves the daemon.
type SiteKeyInput struct {
	Salt    string   `json:"salt"`
	Current string   `json:"current,omitempty"`
	Key     string   `json:"key,omitempty"`
	Earlier []string `json:"earlier"`
}

var siteFingerprint = regexp.MustCompile(`^[0-9a-f]{64}$`)

func (in SiteKeyInput) valid(seed bool) bool {
	if !siteFingerprint.MatchString(in.Salt) || in.Earlier == nil || len(in.Earlier) > 32 || seed == (in.Key == "") || seed == (in.Current != "") {
		return false
	}
	if seed && !literalProviderKey.MatchString(in.Key) || !seed && !siteFingerprint.MatchString(in.Current) {
		return false
	}
	for _, f := range in.Earlier {
		if !siteFingerprint.MatchString(f) || f == in.Current {
			return false
		}
	}
	return true
}

// CheckSiteKey says in one word what the person's Pi holds for provider:
// absent, current or earlier (exactly a site key) or own (anything else,
// a subscription included). It writes nothing.
func (p *PiDevice) CheckSiteKey(ctx context.Context, provider string, in SiteKeyInput) (string, error) {
	if !in.valid(false) {
		return "", errors.New("invalid site key check")
	}
	b, _ := json.Marshal(in)
	out, err := p.credentialsHelper(ctx, "site_check", provider, string(b))
	if err != nil || !slices.Contains([]string{"absent", "current", "earlier", "own"}, out.site) {
		return "", errors.New("native Pi credentials unavailable")
	}
	return out.site, nil
}

// GiveSiteKey writes the site key where the check, repeated under Pi's own
// file lock, says absent or earlier: seeded, replaced, already_current or
// kept (the person's own credential, never touched). An error leaves the
// outcome unknown: the helper writes the key before its settings step.
func (p *PiDevice) GiveSiteKey(ctx context.Context, provider string, in SiteKeyInput) (string, error) {
	if !in.valid(true) {
		return "", errors.New("invalid site key seed")
	}
	b, _ := json.Marshal(in)
	out, err := p.credentialsHelper(ctx, "site_seed", provider, string(b))
	if err != nil || !slices.Contains([]string{"seeded", "replaced", "already_current", "kept"}, out.site) {
		return "", errors.New("native Pi credentials unavailable")
	}
	return out.site, nil
}

// credentialsHelper runs one helper action. stdin is the key for save and
// seed, and the SiteKeyInput document for the site actions.
func (p *PiDevice) credentialsHelper(parent context.Context, action, provider, stdin string) (helperResult, error) {
	var result piCredentials
	fail := errors.New("native Pi credentials unavailable")
	if !slices.Contains([]string{"read", "save", "remove", "seed", "site_check", "site_seed"}, action) {
		return helperResult{}, fail
	}
	if (action == "read") != (provider == "") || (action != "read" && !piKeyProvider(provider)) {
		return helperResult{}, fail
	}
	if (action == "save" || action == "seed") && !literalProviderKey.MatchString(stdin) {
		return helperResult{}, fail
	}
	if p.validateConfiguration() != nil || p.validateCredentials() != nil || p.validateSettings() != nil {
		return helperResult{}, fail
	}
	ctx, cancel := context.WithTimeout(parent, 12*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, p.Node, "--input-type=module", "--eval", piCredentialsHelper, p.Entry, p.Manifest, action, provider)
	var env []string
	for _, item := range os.Environ() {
		if !strings.HasPrefix(item, "HOME=") && !strings.HasPrefix(item, "NODE_OPTIONS=") && !strings.HasPrefix(item, "PI_CODING_AGENT_DIR=") {
			env = append(env, item)
		}
	}
	cmd.Env = append(env, "HOME="+p.Home, "PI_OFFLINE=1")
	cmd.Dir = p.Home
	cmd.Stdin = strings.NewReader(stdin)
	cmd.Stderr = &storageDiagnostics{operation: "pi_credentials"}
	cmd.WaitDelay = time.Second
	out, err := cmd.Output()
	var words struct {
		Seed string `json:"seed"`
		Site string `json:"site"`
	}
	if err != nil || len(out) > 1024 || json.Unmarshal(out, &result) != nil || json.Unmarshal(out, &words) != nil || result.SchemaVersion != 1 {
		return helperResult{}, fail
	}
	for _, state := range []piKeyState{result.OpenAI, result.Anthropic, result.DeepSeek} {
		if state.Suffix != nil && !keySuffix.MatchString(*state.Suffix) {
			return helperResult{}, fail
		}
	}
	return helperResult{result, words.Seed, words.Site}, nil
}

func PiCredentialsHandler(cfg transport.Config, trusted func(*http.Request) bool, pi *PiDevice) http.Handler {
	return piCredentialsHandlerAt(cfg, trusted, pi, PiCredentialsPath)
}

// PiCredentialsPath lists and saves keys; PiCredentialsPath+"/"+provider removes one.
const PiCredentialsPath = "/api/v1/pi/credentials"

// PiCredentialPaths are the exact routes a credentials handler at listPath serves.
func PiCredentialPaths(listPath string) []string {
	paths := []string{listPath}
	for _, provider := range piKeyProviders {
		paths = append(paths, listPath+"/"+provider)
	}
	return paths
}

func piCredentialsHandlerAt(cfg transport.Config, trusted func(*http.Request) bool, pi *PiDevice, listPath string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.URL.RawQuery != "" {
			snapshotError(w, 400, "invalid_request")
			return
		}
		action, provider, key := "", "", ""
		removed, single := strings.CutPrefix(r.URL.Path, listPath+"/")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == listPath:
			action = "read"
		case r.Method == http.MethodDelete && single && piKeyProvider(removed):
			action, provider = "remove", removed
		case r.Method == http.MethodPost && r.URL.Path == listPath:
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
			if decoder.Decode(&input) != nil || decoder.Decode(new(any)) != io.EOF || !piKeyProvider(input.Provider) || !literalProviderKey.MatchString(input.Key) {
				snapshotError(w, 400, "invalid_request")
				return
			}
			action, provider, key = "save", input.Provider, input.Key
		default:
			snapshotError(w, 405, "method_not_allowed")
			return
		}
		if action != "save" && (r.ContentLength > 0 || len(r.TransferEncoding) != 0) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(14 * time.Second))
		result, err := pi.credentials(r.Context(), action, provider, key)
		if err != nil {
			snapshotError(w, 503, "native_unavailable")
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		historyJSON(w, result)
	})
}

// SiteKeyPath is the gateway's own request to give the site AI key to a
// person who joined earlier (ADR 0030). The gateway builds it itself after
// its administrator check and never proxies it from a browser; the daemon
// answers only for its own UID, from its own Pi files.
const SiteKeyPath = "/internal/v1/pi/site-key"

func SiteKeyHandler(cfg transport.Config, trusted func(*http.Request) bool, pi *PiDevice) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.Method != http.MethodPost {
			snapshotError(w, 405, "method_not_allowed")
			return
		}
		if r.URL.RawQuery != "" || r.Header.Get("Content-Type") != "application/json" || r.ContentLength <= 0 || r.ContentLength > 4096 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		var body struct {
			SchemaVersion int    `json:"schema_version"`
			Action        string `json:"action"`
			Provider      string `json:"provider"`
			SiteKeyInput
		}
		decoder := json.NewDecoder(io.LimitReader(r.Body, 4097))
		decoder.DisallowUnknownFields()
		if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF || body.SchemaVersion != 1 || !piKeyProvider(body.Provider) || (body.Action != "check" && body.Action != "seed") || !body.SiteKeyInput.valid(body.Action == "seed") {
			snapshotError(w, 400, "invalid_request")
			return
		}
		_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(14 * time.Second))
		if body.Action == "check" {
			state, err := pi.CheckSiteKey(r.Context(), body.Provider, body.SiteKeyInput)
			if err != nil {
				snapshotError(w, 503, "native_unavailable")
				return
			}
			historyJSON(w, map[string]any{"schema_version": 1, "state": state})
			return
		}
		outcome, err := pi.GiveSiteKey(r.Context(), body.Provider, body.SiteKeyInput)
		if err != nil {
			snapshotError(w, 503, "native_unavailable")
			return
		}
		historyJSON(w, map[string]any{"schema_version": 1, "outcome": outcome})
	})
}
