//go:build linux

package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strconv"
)

// onboardingFileLimit leaves room for the control envelope inside the
// gateway's 8192-byte request.
const onboardingFileLimit = 7680

type controlOnboarding struct {
	Version      int `json:"version"`
	Repositories struct {
		Mode     string   `json:"mode"`
		Defaults []string `json:"defaults"`
	} `json:"repositories"`
	Integrations []struct {
		Provider string `json:"provider"`
		Required bool   `json:"required"`
	} `json:"integrations"`
	AIAccount struct {
		Offer string `json:"offer"`
	} `json:"ai_account"`
}

// onboardingReasons are the gateway's fixed rejections, the same words the
// browser receives as error codes.
var onboardingReasons = map[string]string{
	"invalid_document":        "expected one JSON object with repositories {mode, defaults}, integrations [{provider, required}] and ai_account {offer}; nothing else",
	"invalid_mode":            "repositories.mode must be preselected, auto or skip",
	"invalid_repository_name": "every default must be a GitHub owner/repo name",
	"too_many_defaults":       "at most 20 default repositories",
	"duplicate_default":       "a default repository is listed twice (names compare case-insensitively)",
	"duplicate_destination":   "two defaults share a repository name under different owners; each is cloned into ~/src/<name>, so only one can be",
	"unknown_provider":        "integration provider must be google, microsoft, imap, caldav, carddav or dropbox",
	"duplicate_provider":      "an integration provider is listed twice",
	"invalid_offer":           "ai_account.offer must be all, chatgpt, claude, openai_key, anthropic_key or deepseek_key",
	"site_key_unavailable":    "offer site_key needs a stored site AI key, and this server has none; store one with admin ai-key set",
	"site_key_stored":         "ai_account.offer stays site_key while the site AI key is stored; delete the key with admin ai-key delete --offer <offer>",
	"invalid_key":             "the site AI key must be one literal sk-… key, sk-ant-… exactly for anthropic",
}

func onboardingRejection(reason string) *cliError {
	return &cliError{code: reason, message: "onboarding rejected: " + onboardingReasons[reason], exit: 1}
}

func readOnboarding(reply *controlOnboarding) error {
	if e := adminOperation("onboarding_show", nil, reply); e != nil {
		return e
	}
	if reply.Version < 0 || reply.Repositories.Defaults == nil || reply.Integrations == nil || reply.AIAccount.Offer == "" {
		return system("invalid_control_response", "gateway returned an invalid onboarding configuration")
	}
	return nil
}

// readOnboardingFile reads the document from a file or stdin. A version field,
// as admin onboarding show prints it, must agree with --expected-version.
func readOnboardingFile(path string, expected int) (json.RawMessage, error) {
	var r io.Reader
	if path == "-" {
		r = os.Stdin
	} else {
		f, e := os.Open(path)
		if e != nil {
			return nil, usage(fmt.Sprintf("cannot read onboarding file %q; give a readable file or - for stdin", path))
		}
		defer f.Close()
		if info, e := f.Stat(); e != nil || !info.Mode().IsRegular() {
			return nil, usage(fmt.Sprintf("onboarding file %q is not a regular file", path))
		}
		r = f
	}
	b, e := io.ReadAll(io.LimitReader(r, onboardingFileLimit+1))
	if e != nil {
		return nil, usage("onboarding input could not be read")
	}
	if len(b) > onboardingFileLimit {
		return nil, usage(fmt.Sprintf("onboarding document exceeds %d bytes", onboardingFileLimit))
	}
	var doc map[string]json.RawMessage
	dec := json.NewDecoder(bytes.NewReader(b))
	if dec.Decode(&doc) != nil || dec.Decode(new(any)) != io.EOF || doc == nil {
		return nil, onboardingRejection("invalid_document")
	}
	// admin onboarding show --json prints the envelope; accept its data too.
	if data, ok := doc["data"]; ok && len(doc) <= 3 {
		doc = nil
		if json.Unmarshal(data, &doc) != nil || doc == nil {
			return nil, onboardingRejection("invalid_document")
		}
	}
	if v, ok := doc["version"]; ok {
		var n int
		if json.Unmarshal(v, &n) != nil || n != expected {
			return nil, usage(fmt.Sprintf("the document's version %s is not --expected-version %d; read the current configuration again", v, expected))
		}
		delete(doc, "version")
	}
	out, _ := json.Marshal(doc)
	return out, nil
}

func adminOnboardingCommand(args []string) (any, error) {
	const shape = "expected admin onboarding show, or admin onboarding update --file <path|-> --expected-version <n> [--dry-run]"
	if len(args) == 0 {
		return nil, usage(shape)
	}
	switch args[0] {
	case "show":
		if e := noArgs(args[1:]); e != nil {
			return nil, e
		}
		var c controlOnboarding
		if e := readOnboarding(&c); e != nil {
			return nil, e
		}
		return envelope(c), nil
	case "update":
		file, version, dry := "", "", false
		for i := 1; i < len(args); i++ {
			switch args[i] {
			case "--file", "--expected-version":
				if i+1 >= len(args) || (args[i+1] != "-" && len(args[i+1]) > 1 && args[i+1][:2] == "--") {
					return nil, usage(args[i] + " requires a value; " + shape)
				}
				target := &file
				if args[i] == "--expected-version" {
					target = &version
				}
				if *target != "" {
					return nil, usage(args[i] + " given twice")
				}
				i++
				*target = args[i]
			case "--dry-run":
				if dry {
					return nil, usage("--dry-run given twice")
				}
				dry = true
			default:
				return nil, usage(fmt.Sprintf("unknown option %q; %s", args[i], shape))
			}
		}
		if file == "" || version == "" {
			return nil, usage(shape)
		}
		expected, e := strconv.Atoi(version)
		if e != nil || expected < 0 || strconv.Itoa(expected) != version {
			return nil, usage(fmt.Sprintf("invalid --expected-version %q; expected the non-negative version admin onboarding show printed", version))
		}
		doc, err := readOnboardingFile(file, expected)
		if err != nil {
			return nil, err
		}
		request := map[string]any{"expected_version": expected, "document": doc}
		if dry {
			// The gateway checks the document and the version without writing.
			var current, next controlOnboarding
			if e := readOnboarding(&current); e != nil {
				return nil, e
			}
			if e := adminOperation("onboarding_check", request, &next); e != nil {
				return nil, e
			}
			return envelope(map[string]any{"dry_run": true, "would": []any{map[string]any{
				"action": "update", "resource": "site-onboarding",
				"input": map[string]any{"expected_version": expected, "document": doc},
				"known_effects": map[string]any{
					"previous":   current,
					"next":       next,
					"changed":    onboardingChanges(current, next),
					"applies_to": "onboardings that start after the change; people who finished onboarding are unchanged",
				},
				"unknown_until_apply": []string{"version_at_commit"},
			}}}), nil
		}
		var next controlOnboarding
		if e := adminOperation("onboarding_update", request, &next); e != nil {
			return nil, e
		}
		return envelope(map[string]any{"updated": true, "onboarding": next}), nil
	}
	return nil, usage(shape)
}

// onboardingChanges names the parts of the document a replacement changes.
func onboardingChanges(a, b controlOnboarding) []string {
	changed := []string{}
	same := func(x, y any) bool {
		bx, _ := json.Marshal(x)
		by, _ := json.Marshal(y)
		return bytes.Equal(bx, by)
	}
	if a.Repositories.Mode != b.Repositories.Mode {
		changed = append(changed, "repositories.mode")
	}
	if !same(a.Repositories.Defaults, b.Repositories.Defaults) {
		changed = append(changed, "repositories.defaults")
	}
	if !same(a.Integrations, b.Integrations) {
		changed = append(changed, "integrations")
	}
	if a.AIAccount.Offer != b.AIAccount.Offer {
		changed = append(changed, "ai_account.offer")
	}
	return changed
}
