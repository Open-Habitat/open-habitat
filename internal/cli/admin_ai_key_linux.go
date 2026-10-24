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
type controlRotation struct {
	Subject string `json:"subject"`
	Outcome string `json:"outcome"`
}
type controlAIKey struct {
	Stored   bool              `json:"stored"`
	Offer    string            `json:"offer"`
	Version  int               `json:"version"`
	SiteKey  *controlSiteKey   `json:"site_key,omitempty"`
	Previous *controlSiteKey   `json:"previous,omitempty"`
	Rotation []controlRotation `json:"rotation,omitempty"`
	Replaces []string          `json:"replaces,omitempty"`
	Holders  []string          `json:"holders,omitempty"`
}
type controlCopy struct {
	Provider string `json:"provider"`
	Suffix   string `json:"suffix"`
	At       string `json:"at"`
	Current  bool   `json:"current"`
}
type controlSeed struct {
	Subject string          `json:"subject"`
	State   string          `json:"state,omitempty"`
	Outcome string          `json:"outcome,omitempty"`
	SiteKey *controlSiteKey `json:"site_key,omitempty"`
	Copy    *controlCopy    `json:"copy,omitempty"`
}

var aiKeyProviders = []string{"openai", "anthropic", "deepseek"}

// aiKeyOffers are the replacement offers delete accepts: everything but
// site_key itself.
var aiKeyOffers = []string{"all", "chatgpt", "claude", "openai_key", "anthropic_key", "deepseek_key"}

var aiKeyShape = regexp.MustCompile(`^sk-[A-Za-z0-9_-]{20,200}$`)

const aiKeyEffects = "new people's Pi gets a copy at the sign-in that creates their account, only where they have no key for this provider; the key's own account pays for their use; people who already joined get it only with admin ai-key seed; a copy cannot be recalled, only revoked at the provider"

// The seed's known effect for each answer of the person's daemon. Root is
// writing into another person's own credentials, and the output says so.
var seedEffects = map[string]string{
	"absent":  "write the site key into this person's own Pi credentials, where they have none for its provider; it becomes their default only if they have none",
	"earlier": "replace the copy of an earlier site key in this person's own Pi credentials with the current key",
	"current": "nothing: this person's Pi already holds the current site key",
	"own":     "nothing: this person has their own credential for this provider, which is never overwritten",
	"unknown": "unknown: the person's daemon did not answer; nothing is written unless it answers at apply",
}

const seedNotice = "root writes into another person's own Pi credentials: their agents can read and use the key, its account pays, and the copy can only be stopped by revoking the key at the provider; the write is decided again under Pi's lock and never replaces their own key or subscription"

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
		return &cliError{code: c.code, message: "this server holds no site AI key; store one with admin ai-key set first", exit: 1}
	case "subject_unavailable":
		return &cliError{code: c.code, message: "that GitHub id is not a joined, admitted person whose daemon the broker routes; check admin access list --state joined; nothing was written", exit: 1}
	case "site_key_busy":
		return &cliError{code: c.code, message: "another site key change is replacing copies; wait for it to finish and run the command again; nothing was written", exit: 1}
	}
	return err
}

func adminAIKeySeed(args []string) (any, error) {
	const shape = "expected admin ai-key seed --github-id <id> [--dry-run]"
	id, dry, e := githubIDFlag(args, shape)
	if e != nil {
		return nil, e
	}
	operation := "ai_key_seed"
	if dry {
		operation = "ai_key_seed_check"
	}
	var v controlSeed
	if e := adminOperation(operation, map[string]any{"subject": id}, &v); e != nil {
		return nil, aiKeyRejection(e)
	}
	if v.Subject != id || v.SiteKey == nil || dry == (v.State == "") || dry == (v.Outcome != "") {
		return nil, system("invalid_control_response", "gateway returned an invalid site AI key reply")
	}
	if dry {
		effect, ok := seedEffects[v.State]
		if !ok {
			return nil, system("invalid_control_response", "gateway returned an invalid site AI key reply")
		}
		return envelope(map[string]any{"dry_run": true, "would": []any{map[string]any{
			"action": "seed", "resource": "site-ai-key-copy", "input": map[string]any{"github_id": id},
			"known_effects":       map[string]any{"site_key": v.SiteKey, "check": v.State, "given": v.Copy, "effect": effect, "notice": seedNotice},
			"unknown_until_apply": []string{"credential_under_pi_lock"},
		}}}), nil
	}
	switch v.Outcome {
	case "seeded", "replaced", "already_current", "kept":
		return envelope(map[string]any{"updated": v.Outcome == "seeded" || v.Outcome == "replaced", "outcome": v.Outcome, "github_id": id, "site_key": v.SiteKey, "notice": seedNotice}), nil
	case "not_reached":
		return nil, system("not_reached", "the person's daemon could not be reached; nothing was written; run the command again once it runs")
	case "unknown":
		return nil, system("outcome_uncertain", "the person's daemon did not answer; the key may or may not have been written; check with --dry-run before running it again")
	}
	return nil, system("invalid_control_response", "gateway returned an invalid site AI key reply")
}

func adminAIKeyCommand(args []string) (any, error) {
	const shape = "expected admin ai-key show, admin ai-key copies, admin ai-key set --provider openai|anthropic|deepseek --key-file <path|-> [--dry-run], admin ai-key delete --offer <offer> [--dry-run], or admin ai-key seed --github-id <id> [--dry-run]"
	if len(args) == 0 {
		return nil, usage(shape)
	}
	verb := args[0]
	var allowed []string
	switch verb {
	case "seed":
		return adminAIKeySeed(args[1:])
	case "copies":
		if len(args) != 1 {
			return nil, usage("admin ai-key copies takes no options")
		}
		var v struct {
			SchemaVersion int             `json:"schema_version"`
			SiteKey       *controlSiteKey `json:"site_key,omitempty"`
			People        []struct {
				ID        string       `json:"id"`
				LoginHint string       `json:"login_hint,omitempty"`
				Username  string       `json:"username,omitempty"`
				Copy      *controlCopy `json:"copy,omitempty"`
			} `json:"people"`
			Waiting int `json:"waiting"`
		}
		if e := adminOperation("ai_key_copies", nil, &v); e != nil {
			return nil, aiKeyRejection(e)
		}
		if v.SchemaVersion != 1 || v.People == nil {
			return nil, system("invalid_control_response", "gateway returned an invalid site AI key reply")
		}
		return envelope(v), nil
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
		effects := map[string]any{"current": v.Previous, "offer": v.Offer}
		unknown := []string{"version_at_commit"}
		if verb == "set" {
			effects["replaces"] = nonNil(v.Replaces)
			if len(v.Replaces) > 0 {
				effect = "replace every copy the site gave of an earlier key of this provider, in those people's own Pi credentials, where it is still exactly that copy; " + aiKeyEffects
				unknown = append(unknown, "replacement_outcomes")
			}
		}
		if verb == "delete" {
			effect = "remove the key and make offer " + v.Offer + "; people given a copy keep it, which only revoking the key at the provider stops; a later key replaces those copies"
			effects["holders"] = nonNil(v.Holders)
		}
		effects["effect"] = effect
		input := map[string]any{"offer": flags["--offer"]}
		if verb == "set" {
			input = map[string]any{"provider": flags["--provider"], "key_suffix": v.SiteKey.Suffix}
		}
		return envelope(map[string]any{"dry_run": true, "would": []any{map[string]any{
			"action": verb, "resource": "site-ai-key", "input": input,
			"known_effects":       effects,
			"unknown_until_apply": unknown,
		}}}), nil
	}
	out := map[string]any{"updated": true, "stored": v.Stored, "offer": v.Offer, "version": v.Version, "site_key": v.SiteKey}
	if verb == "set" {
		// Each earlier copy's replacement, in the person's own credentials.
		out["replaced"] = nonNil(v.Rotation)
	}
	return envelope(out), nil
}

func nonNil[T any](xs []T) []T {
	if xs == nil {
		return []T{}
	}
	return xs
}
