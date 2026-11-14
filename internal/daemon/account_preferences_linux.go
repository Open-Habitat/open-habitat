//go:build linux

package daemon

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"slices"
	"strings"
	"sync"
	"syscall"

	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

const AccountPreferencesPath = "/api/v1/account/preferences"

// accountPreferences is the person's small account-wide settings in one
// document, ~/.config/open-habitat/preferences.json: the desktop editor, the
// interface language, the order and workspace of the rail's Hiljaiset section,
// and experimental features they turned on. Only enabled features are kept, so
// a feature that graduates or is removed leaves at most one stale key. A value
// never chosen is absent: a language reads as "system", which leaves the
// choice to the server default and the browser, the order as "newest", and
// the workspace as every workspace.
type accountPreferences struct {
	Engine         string          `json:"engine"`
	Language       string          `json:"language,omitempty"`
	QuietSort      string          `json:"quiet_sort,omitempty"`
	QuietWorkspace string          `json:"quiet_workspace,omitempty"`
	Experimental   map[string]bool `json:"experimental"`
	// GitHubWorkflow is the person's opt-in to the GitHub sign-in's
	// workflow scope: what they want, beside what gh's token holds, so a
	// later sign-in that drops the scope shows as a missing permission.
	GitHubWorkflow bool `json:"github_workflow,omitempty"`
	// RecentCount is the retired Viimeisimmät count. A file that has it still
	// reads, so the person's other choices survive; the next save drops it.
	RecentCount json.RawMessage `json:"recent_count,omitempty"`
}

// preferencesWrite names one change. The gateway caps a write at 128 bytes,
// so a write never carries the whole document; the daemon merges it.
type preferencesWrite struct {
	QuietSort      *string
	QuietWorkspace *string
	Engine         *string
	Language       *string
	GitHubWorkflow *bool
	Experimental   map[string]bool
}

const maxExperimentalFeatures = 32

// preferencesLock serializes the read-merge-replace of the person's file in
// their daemon, so two devices switching different features at once both
// land.
var preferencesLock sync.Mutex

func validEditorEngine(engine string) bool { return engine == "codemirror6" || engine == "vscode" }

func validLanguage(language string) bool {
	return language == "system" || language == "fi" || language == "en" || language == "en-US" || language == "en-GB"
}

func validQuietSort(sort string) bool {
	return sort == "newest" || sort == "workspace" || sort == "name"
}

// validWorkspaceID: the contract's workspaceId pattern. The daemon does not
// require the workspace to exist; the browser reads a stale one as every
// workspace.
func validWorkspaceID(id string) bool {
	if len(id) < 3+8 || len(id) > 3+64 || !strings.HasPrefix(id, "ws_") {
		return false
	}
	for _, c := range id[3:] {
		if (c < 'a' || c > 'z') && (c < 'A' || c > 'Z') && (c < '0' || c > '9') && c != '_' && c != '-' {
			return false
		}
	}
	return true
}

// validFeatureID: lower-case words joined by single hyphens, as the
// contract's pattern says.
func validFeatureID(id string) bool {
	if len(id) == 0 || len(id) > 48 || id[0] < 'a' || id[0] > 'z' || id[len(id)-1] == '-' || strings.Contains(id, "--") {
		return false
	}
	for _, c := range id {
		if (c < 'a' || c > 'z') && (c < '0' || c > '9') && c != '-' {
			return false
		}
	}
	return true
}

func (p accountPreferences) valid() bool {
	if p.QuietSort != "" && !validQuietSort(p.QuietSort) || p.QuietWorkspace != "" && !validWorkspaceID(p.QuietWorkspace) {
		return false
	}
	if !validEditorEngine(p.Engine) || p.Language != "" && !validLanguage(p.Language) || len(p.Experimental) > maxExperimentalFeatures {
		return false
	}
	for id, on := range p.Experimental {
		if !validFeatureID(id) || !on {
			return false
		}
	}
	return true
}

// decodePreferencesWrite accepts exactly what the contract's write allows:
// one object with exactly one key: "engine", "language", "quiet_sort",
// "quiet_workspace" (a workspace or null), "github_workflow" (a boolean),
// or "experimental" naming one
// feature with a boolean. encoding/json alone would match keys without
// regard to case and read null as false, so each part is decoded on its own.
func decodePreferencesWrite(body io.Reader) (preferencesWrite, bool) {
	var change preferencesWrite
	var outer map[string]json.RawMessage
	dec := json.NewDecoder(body)
	if dec.Decode(&outer) != nil || dec.Decode(new(any)) != io.EOF || len(outer) != 1 {
		return change, false
	}
	if raw, ok := outer["quiet_sort"]; ok {
		var sort string
		if json.Unmarshal(raw, &sort) != nil || !validQuietSort(sort) {
			return change, false
		}
		change.QuietSort = &sort
		return change, true
	}
	if raw, ok := outer["quiet_workspace"]; ok {
		// null chooses every workspace, stored as absent.
		var id *string
		if json.Unmarshal(raw, &id) != nil || id != nil && !validWorkspaceID(*id) {
			return change, false
		}
		if id == nil {
			id = new(string)
		}
		change.QuietWorkspace = id
		return change, true
	}
	if raw, ok := outer["engine"]; ok {
		var engine string
		if json.Unmarshal(raw, &engine) != nil || !validEditorEngine(engine) {
			return change, false
		}
		change.Engine = &engine
		return change, true
	}
	if raw, ok := outer["language"]; ok {
		var language string
		if json.Unmarshal(raw, &language) != nil || !validLanguage(language) {
			return change, false
		}
		change.Language = &language
		return change, true
	}
	if raw, ok := outer["github_workflow"]; ok {
		var on *bool
		if json.Unmarshal(raw, &on) != nil || on == nil {
			return change, false
		}
		change.GitHubWorkflow = on
		return change, true
	}
	var switches map[string]*bool
	if json.Unmarshal(outer["experimental"], &switches) != nil || len(switches) != 1 {
		return change, false
	}
	for id, on := range switches {
		if on == nil || !validFeatureID(id) {
			return change, false
		}
		change.Experimental = map[string]bool{id: *on}
	}
	return change, true
}

func preferencesDir(home string, create bool) (*os.File, error) {
	return personalDir(home, create, ".config", "open-habitat")
}

// personalDir opens home/<parts...>. Use the mapped home, not the gateway's
// environment or a browser-supplied path. Open each directory without
// following symlinks and hold it across rename.
func personalDir(home string, create bool, parts ...string) (*os.File, error) {
	fd, err := unix.Open(home, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, err
	}
	for _, part := range parts {
		if create {
			if err = unix.Mkdirat(fd, part, 0700); err != nil && !errors.Is(err, unix.EEXIST) {
				unix.Close(fd)
				return nil, err
			}
		}
		next, e := unix.Openat(fd, part, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
		unix.Close(fd)
		if e != nil {
			return nil, e
		}
		fd = next
		var st unix.Stat_t
		if e = unix.Fstat(fd, &st); e != nil || st.Uid != uint32(os.Geteuid()) || st.Mode&0022 != 0 {
			unix.Close(fd)
			return nil, errors.New("unsafe configuration directory")
		}
	}
	return os.NewFile(uintptr(fd), "configuration"), nil
}

func readPreferences(home string) (accountPreferences, error) {
	result := accountPreferences{Engine: "codemirror6", Experimental: map[string]bool{}}
	dir, err := preferencesDir(home, false)
	if errors.Is(err, os.ErrNotExist) {
		return result, nil
	}
	if err != nil {
		return result, err
	}
	defer dir.Close()
	fd, err := unix.Openat(int(dir.Fd()), "preferences.json", unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if errors.Is(err, os.ErrNotExist) {
		return result, nil
	}
	if err != nil {
		return result, err
	}
	f := os.NewFile(uintptr(fd), "preferences")
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return result, err
	}
	if !st.Mode().IsRegular() || st.Size() > 4096 || st.Mode().Perm()&0022 != 0 || st.Sys().(*syscall.Stat_t).Uid != uint32(os.Geteuid()) {
		return result, errors.New("unsafe configuration file")
	}
	result = accountPreferences{}
	dec := json.NewDecoder(io.LimitReader(f, 4097))
	dec.DisallowUnknownFields()
	if err = dec.Decode(&result); err != nil {
		return result, err
	}
	if result.Experimental == nil {
		result.Experimental = map[string]bool{}
	}
	if result.Language == "system" {
		result.Language = ""
	}
	result.RecentCount = nil
	if !result.valid() || dec.Decode(new(any)) != io.EOF {
		return result, errors.New("invalid preferences")
	}
	return result, nil
}

func savePreferences(home string, value accountPreferences) error {
	if !value.valid() {
		return errors.New("invalid preferences")
	}
	if value.Experimental == nil {
		value.Experimental = map[string]bool{}
	}
	dir, err := preferencesDir(home, true)
	if err != nil {
		return err
	}
	defer dir.Close()
	var random [16]byte
	if _, err = rand.Read(random[:]); err != nil {
		return err
	}
	name := ".preferences-" + hex.EncodeToString(random[:])
	fd, err := unix.Openat(int(dir.Fd()), name, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
	if err != nil {
		return err
	}
	defer unix.Unlinkat(int(dir.Fd()), name, 0)
	f := os.NewFile(uintptr(fd), "preferences")
	defer f.Close()
	if err = json.NewEncoder(f).Encode(value); err != nil {
		return err
	}
	if err = f.Sync(); err != nil {
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	if err = unix.Renameat(int(dir.Fd()), name, int(dir.Fd()), "preferences.json"); err != nil {
		return err
	}
	return dir.Sync()
}

// applyPreferences merges one named change into the stored document and
// returns what is now stored. Turning a feature off removes its key.
func applyPreferences(home string, change preferencesWrite) (accountPreferences, error) {
	preferencesLock.Lock()
	defer preferencesLock.Unlock()
	value, err := readPreferences(home)
	if err != nil {
		return value, err
	}
	if change.QuietSort != nil {
		value.QuietSort = *change.QuietSort
	}
	if change.QuietWorkspace != nil {
		value.QuietWorkspace = *change.QuietWorkspace
	}
	if change.Engine != nil {
		value.Engine = *change.Engine
	}
	if change.Language != nil {
		value.Language = *change.Language
		if value.Language == "system" {
			value.Language = ""
		}
	}
	if change.GitHubWorkflow != nil {
		value.GitHubWorkflow = *change.GitHubWorkflow
	}
	for id, on := range change.Experimental {
		if on {
			value.Experimental[id] = true
		} else {
			delete(value.Experimental, id)
		}
	}
	return value, savePreferences(home, value)
}

// rememberGitHubWorkflow records the opt-in when the person's explicit
// GitHub reconnect installed a token that has the workflow scope. It never
// clears it: a reconnect without the scope may come from a page that could
// not read the opt-in, and the remembered wish is what makes the card say
// the permission is missing. Removing it is the person's own write, made
// before the reconnect that drops the scope.
func rememberGitHubWorkflow(home string, scopes []string) error {
	if !slices.Contains(scopes, "workflow") {
		return nil
	}
	on := true
	_, err := applyPreferences(home, preferencesWrite{GitHubWorkflow: &on})
	return err
}

func AccountPreferencesHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		put := r.Method == http.MethodPut
		if r.URL.Path != AccountPreferencesPath || r.URL.EscapedPath() != AccountPreferencesPath || r.URL.RawQuery != "" || len(r.TransferEncoding) != 0 || (!put && r.Method != http.MethodGet) || (!put && r.ContentLength > 0) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		var value accountPreferences
		var err error
		if put {
			if r.ContentLength < 2 || r.ContentLength > 128 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			change, ok := decodePreferencesWrite(io.LimitReader(r.Body, 129))
			if !ok {
				snapshotError(w, 400, "invalid_request")
				return
			}
			value, err = applyPreferences(cfg.Home, change)
		} else {
			value, err = readPreferences(cfg.Home)
		}
		if err != nil {
			snapshotError(w, 503, "preferences_unavailable")
			return
		}
		language := value.Language
		if language == "" {
			language = "system"
		}
		sort := value.QuietSort
		if sort == "" {
			sort = "newest"
		}
		var workspace any
		if value.QuietWorkspace != "" {
			workspace = value.QuietWorkspace
		}
		historyJSON(w, map[string]any{"schema_version": 1, "web_identity_id": opaque("wid_", cfg.Provider+":"+cfg.Subject), "engine": value.Engine, "language": language, "quiet_sort": sort, "quiet_workspace": workspace, "github_workflow": value.GitHubWorkflow, "experimental": value.Experimental})
	})
}
