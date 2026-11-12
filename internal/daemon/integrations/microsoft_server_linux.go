//go:build linux

package integrations

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/sys/unix"
)

// The account's Outlook server is a named entry in Pi's mcp.json. Pi accepts
// only ASCII letters, digits, `_` and `-` in a server name, and the agent
// reads the name in its skill and its tool names, so the name is the address
// made readable: lowercased, with every run of other characters turned into
// one `-` (aino.virtanen@contoso.test → habitat-microsoft-aino-virtanen-contoso-test).
// Nothing decodes a name back to an address: the account owns the entry
// whose token cache is its own (microsoftOthersServer), as the cache directory
// and rclone config are named by the address itself.
const microsoftServerPrefix = "habitat-microsoft-"

func microsoftServerSlug(address string) string {
	var b strings.Builder
	dash := false
	for _, c := range address {
		switch {
		case c >= 'A' && c <= 'Z':
			c += 'a' - 'A'
			fallthrough
		case c >= 'a' && c <= 'z' || c >= '0' && c <= '9':
			if dash && b.Len() > 0 {
				b.WriteByte('-')
			}
			dash = false
			b.WriteRune(c)
		default:
			dash = true
		}
	}
	return b.String()
}

// microsoftServerNames are the account's two possible names. The plain one
// is taken unless the slug is already another registration's; then the
// account gets the suffixed one, whose six hex characters are the first
// three bytes of SHA-256 of the whole address. Which of the two an account
// has is decided once, when it is first registered, and kept for as long as
// its entry exists (microsoftServerName), so connecting or removing another
// account never renames this one. Pi has no length limit on a server name;
// a long name only makes Pi hash the tool names, so none is trimmed.
func microsoftServerNames(address string) (plain, suffixed string) {
	h := sha256.Sum256([]byte(address))
	plain = microsoftServerPrefix + microsoftServerSlug(address)
	return plain, strings.TrimSuffix(plain, "-") + "-" + hex.EncodeToString(h[:3])
}

// microsoftLegacyServerName is the name releases before 12.11.2026 gave the
// account: the address hex-encoded. Align renames such an entry
// (microsoftRenameServer); everything else still finds it until then.
func microsoftLegacyServerName(address string) string {
	return microsoftServerPrefix + hex.EncodeToString([]byte(address))
}

// microsoftOthersServer says whether a Pi entry demonstrably belongs to
// someone else: its token cache is not this account's native cache. An
// entry under our prefix with no cache of its own is taken to be this
// account's, as earlier releases took the hex-encoded name to be.
func microsoftOthersServer(env Env, raw json.RawMessage, address string) bool {
	var entry struct {
		Env map[string]string `json:"env"`
	}
	if raw == nil {
		return false
	}
	if json.Unmarshal(raw, &entry) != nil {
		return true
	}
	cache, ok := entry.Env["MS365_MCP_TOKEN_CACHE_PATH"]
	return ok && cache != filepath.Join(env.Home, microsoftMCPDir, address, ".token-cache.json")
}

// microsoftServerName is the account's readable name in Pi's servers: the
// name its entry already has, or for a new registration the plain name when
// nothing holds it. A name Pi would fold onto ours (`-` and `_` share a
// namespace) holds it too, since Pi refuses a configuration with both.
func microsoftServerName(env Env, servers map[string]json.RawMessage, address string) (string, error) {
	plain, suffixed := microsoftServerNames(address)
	ours := func(name string) bool {
		return servers[name] != nil && !microsoftOthersServer(env, servers[name], address)
	}
	free := func(name string) bool {
		for other := range servers {
			if strings.ReplaceAll(other, "-", "_") == strings.ReplaceAll(name, "-", "_") {
				return false
			}
		}
		return true
	}
	switch {
	case ours(suffixed):
		return suffixed, nil
	case ours(plain), free(plain):
		return plain, nil
	case free(suffixed):
		return suffixed, nil
	}
	// Both names belong to something else: never take over another entry.
	return "", ToolFailed
}

// microsoftPiServers is Pi's global mcp.json: the whole document and its
// servers, both empty when there is none.
func microsoftPiServers(env Env) (map[string]json.RawMessage, map[string]json.RawMessage, error) {
	empty := func() (map[string]json.RawMessage, map[string]json.RawMessage, error) {
		return map[string]json.RawMessage{}, map[string]json.RawMessage{}, nil
	}
	fd, err := openHomeDir(env.Home, false, ".pi", "agent")
	if errors.Is(err, os.ErrNotExist) {
		return empty()
	}
	if err != nil {
		return nil, nil, err
	}
	defer unix.Close(fd)
	data, err := readFileAt(fd, "mcp.json", 1<<20)
	if errors.Is(err, os.ErrNotExist) {
		return empty()
	}
	if err != nil {
		return nil, nil, err
	}
	var root map[string]json.RawMessage
	if json.Unmarshal(data, &root) != nil || root == nil {
		return nil, nil, ToolFailed
	}
	servers := map[string]json.RawMessage{}
	if raw, ok := root["mcpServers"]; ok && (json.Unmarshal(raw, &servers) != nil || servers == nil) {
		return nil, nil, ToolFailed
	}
	return root, servers, nil
}

// microsoftServer is where the account's registration stands: the readable
// name it has or would get, whether an entry is registered under it, and
// the legacy name when an entry is still under that.
type microsoftServer struct {
	name       string
	registered bool
	legacy     string
}

// current is the name the agent reaches the server by now: the legacy one
// until Align has renamed it.
func (s microsoftServer) current() string {
	if !s.registered && s.legacy != "" {
		return s.legacy
	}
	return s.name
}

// configured says whether any entry of the account exists.
func (s microsoftServer) configured() bool { return s.registered || s.legacy != "" }

func microsoftServerOf(env Env, address string) (microsoftServer, map[string]json.RawMessage, error) {
	_, servers, err := microsoftPiServers(env)
	if err != nil {
		return microsoftServer{}, nil, err
	}
	name, err := microsoftServerName(env, servers, address)
	if err != nil {
		return microsoftServer{}, nil, err
	}
	s := microsoftServer{name: name, registered: servers[name] != nil}
	if legacy := microsoftLegacyServerName(address); servers[legacy] != nil {
		s.legacy = legacy
	}
	return s, servers, nil
}

// microsoftRenameNeeded reports an entry still under the legacy name.
func microsoftRenameNeeded(env Env, address string) bool {
	s, _, err := microsoftServerOf(env, address)
	return err == nil && s.legacy != ""
}

// microsoftRenameServer moves a legacy entry to the readable name in one
// atomic rewrite of mcp.json, keeping every field of the entry. The Outlook
// server's sign-in is its token cache under the account's own directory,
// which the entry names by path: Pi keeps no OAuth state for a stdio server,
// so nothing keyed by the old name is left behind. An entry already under
// the readable name is the newer registration (microsoftRegister writes it
// before removing the legacy one); then only the legacy entry goes. The
// caller holds the account's native lock.
func microsoftRenameServer(ctx context.Context, env Env, address string) error {
	piMCPNative.Lock()
	defer piMCPNative.Unlock()
	root, servers, err := microsoftPiServers(env)
	if err != nil {
		return err
	}
	legacy := microsoftLegacyServerName(address)
	entry, ok := servers[legacy]
	if !ok {
		return nil
	}
	delete(servers, legacy)
	name, err := microsoftServerName(env, servers, address)
	if err != nil {
		return err
	}
	if servers[name] == nil {
		servers[name] = entry
	}
	root["mcpServers"], _ = json.Marshal(servers)
	data, _ := json.MarshalIndent(root, "", "  ")
	if ctx.Err() != nil {
		return ctx.Err()
	}
	fd, err := openHomeDir(env.Home, false, ".pi", "agent")
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	return writeFileAt(fd, "mcp.json", append(data, '\n'), 0600)
}
