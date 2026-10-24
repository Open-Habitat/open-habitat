//go:build linux

package cli

import (
	"fmt"
	"io"
	"os"
	"regexp"
	"slices"
	"strings"
)

// The site AI key (ADR 0030) over root's gateway control socket: the same
// writer the browser administrator uses, with actor root. The key is read
// from a file or stdin, never argv, and no output, refusal or log line
// carries it; replies name only the provider, a four-character suffix and
// when it was set.

type controlSiteKey struct {
	Provider string `json:"provider"`
	Suffix   string `json:"suffix"`
	SetAt    string `json:"set_at,omitempty"`
}
type controlAIKey struct {
	Stored   bool            `json:"stored"`
	Offer    string          `json:"offer"`
	Version  int             `json:"version"`
	SiteKey  *controlSiteKey `json:"site_key,omitempty"`
	Previous *controlSiteKey `json:"previous,omitempty"`
}

var aiKeyProviders = []string{"openai", "anthropic", "deepseek"}

// aiKeyOffers are the replacement offers delete accepts: everything but
// site_key itself.
var aiKeyOffers = []string{"all", "chatgpt", "claude", "openai_key", "anthropic_key", "deepseek_key"}

var aiKeyShape = regexp.MustCompile(`^sk-[A-Za-z0-9_-]{20,200}$`)

const aiKeyEffects = "new people's Pi gets a copy at the sign-in that creates their account, only where they have no key for this provider; the key's own account pays for their use; people who already joined are not changed; a copy cannot be recalled, only revoked at the provider"

// readAIKey reads one key from a file or stdin. A single trailing newline, as
// echo and editors leave it, is not part of it.
func readAIKey(path string) (string, error) {
	var r io.Reader = os.Stdin
	if path != "-" {
		f, e := os.Open(path)
		if e != nil {
			return "", usage(fmt.Sprintf("cannot read --key-file %q; give a readable file or - for stdin", path))
		}
		defer f.Close()
		if info, e := f.Stat(); e != nil || !info.Mode().IsRegular() {
			return "", usage(fmt.Sprintf("--key-file %q is not a regular file", path))
		}
		r = f
	}
	b, e := io.ReadAll(io.LimitReader(r, 260))
	if e != nil {
		return "", usage("the API key could not be read")
	}
	return strings.TrimSuffix(strings.TrimSuffix(string(b), "\n"), "\r"), nil
}

func aiKeyRejection(err error) error {
	c, ok := err.(*cliError)
	if !ok {
		return err
	}
	switch c.code {
	case "invalid_key":
		return &cliError{code: c.code, message: "the gateway refused the key: it must be one literal sk-… key of 23–203 characters, sk-ant-… exactly for anthropic; nothing was changed", exit: 1}
	case "site_key_unavailable":
		return &cliError{code: c.code, message: "this server holds no site AI key; nothing to delete", exit: 1}
	}
	return err
}

func adminAIKeyCommand(args []string) (any, error) {
	const shape = "expected admin ai-key show, admin ai-key set --provider openai|anthropic|deepseek --key-file <path|-> [--dry-run], or admin ai-key delete --offer <offer> [--dry-run]"
	if len(args) == 0 {
		return nil, usage(shape)
	}
	verb := args[0]
	var allowed []string
	switch verb {
	case "show":
	case "set":
		allowed = []string{"--provider", "--key-file"}
	case "delete":
		allowed = []string{"--offer"}
	default:
		return nil, usage(shape)
	}
	flags := map[string]string{}
	dry := false
	for i := 1; i < len(args); i++ {
		switch {
		case args[i] == "--dry-run" && verb != "show":
			if dry {
				return nil, usage("--dry-run given twice")
			}
			dry = true
		case slices.Contains(allowed, args[i]):
			if _, seen := flags[args[i]]; seen || i+1 >= len(args) {
				return nil, usage(shape)
			}
			flags[args[i]] = args[i+1]
			i++
		default:
			return nil, usage(fmt.Sprintf("unknown option %q; %s", args[i], shape))
		}
	}
	var request map[string]any
	operation := "ai_key_show"
	switch verb {
	case "set":
		provider, ok := flags["--provider"]
		if !ok || !slices.Contains(aiKeyProviders, provider) {
			return nil, usage(fmt.Sprintf("invalid --provider %q; expected openai, anthropic or deepseek", provider))
		}
		path, ok := flags["--key-file"]
		if !ok {
			return nil, usage(shape)
		}
		key, e := readAIKey(path)
		if e != nil {
			return nil, e
		}
		// The gateway's own rule, checked before anything is sent; the
		// message never echoes the value.
		if !aiKeyShape.MatchString(key) || strings.HasPrefix(key, "sk-ant-") != (provider == "anthropic") {
			return nil, usage("expected one literal API key on --key-file: sk-… of 23–203 letters, digits, _ or -, and sk-ant-… exactly for --provider anthropic")
		}
		request = map[string]any{"provider": provider, "key": key}
		operation = "ai_key_set"
	case "delete":
		offer, ok := flags["--offer"]
		if !ok || !slices.Contains(aiKeyOffers, offer) {
			return nil, usage(fmt.Sprintf("invalid --offer %q; deleting the key needs the offer new people get instead: %s", offer, strings.Join(aiKeyOffers, ", ")))
		}
		request = map[string]any{"offer": offer}
		operation = "ai_key_delete"
	}
	if dry {
		operation += "_check"
	}
	var v controlAIKey
	if e := adminOperation(operation, request, &v); e != nil {
		return nil, aiKeyRejection(e)
	}
	if v.Offer == "" || v.Stored != (v.SiteKey != nil) {
		return nil, system("invalid_control_response", "gateway returned an invalid site AI key reply")
	}
	switch {
	case verb == "show":
		return envelope(v), nil
	case dry:
		effect := aiKeyEffects
		if verb == "set" && v.Previous != nil {
			effect = "replace the stored key for future seeds only; people seeded before keep their copy of the old key; " + aiKeyEffects
		}
		if verb == "delete" {
			effect = "remove the key and make offer " + v.Offer + "; people seeded before keep their copies, which only revoking the key at the provider stops"
		}
		input := map[string]any{"offer": flags["--offer"]}
		if verb == "set" {
			input = map[string]any{"provider": flags["--provider"], "key_suffix": v.SiteKey.Suffix}
		}
		return envelope(map[string]any{"dry_run": true, "would": []any{map[string]any{
			"action": verb, "resource": "site-ai-key", "input": input,
			"known_effects":       map[string]any{"current": v.Previous, "offer": v.Offer, "effect": effect},
			"unknown_until_apply": []string{"version_at_commit"},
		}}}), nil
	}
	return envelope(map[string]any{"updated": true, "stored": v.Stored, "offer": v.Offer, "version": v.Version, "site_key": v.SiteKey}), nil
}
