//go:build linux

package cli

import (
	"errors"
	"fmt"
	"io"
	"os"
	"slices"
	"strings"

	"github.com/Open-Habitat/open-habitat/internal/integrationapps"
)

type controlIntegrationApp struct {
	Provider string `json:"provider"`
	ClientID string `json:"client_id,omitempty"`
	TenantID string `json:"tenant_id,omitempty"`
	Usable   bool   `json:"usable"`
	Source   string `json:"source"`
	Actor    string `json:"actor,omitempty"`
	At       string `json:"at,omitempty"`
}
type controlIntegrations struct {
	SchemaVersion int                     `json:"schema_version"`
	BrowserSetup  bool                    `json:"browser_setup"`
	Apps          []controlIntegrationApp `json:"apps"`
}

// integrationRejections are the broker's definite refusals: nothing was
// written and the caller can act on each (exit 1).
var integrationRejections = map[string]string{
	"browser_setup_disabled":    "site.json integrations.browser_setup is false, so app credentials are root's to edit in integrations.json; set it to true and run host apply to allow this",
	"host_busy":                 "a host operation (apply, prepare or upgrade) holds the maintenance lock; nothing was changed, run this again after it ends",
	"integrations_file_invalid": "/opt/open-habitat/integrations.json is absent, not root's, or not one JSON object, or /var/lib/open-habitat/host is not root's private directory; run host apply or repair it as root",
	"integration_refused":       "the broker refused the change; nothing was written",
}

func integrationRejection(err error) error {
	var c *cliError
	if !errors.As(err, &c) {
		return err
	}
	if m, ok := integrationRejections[c.code]; ok {
		return &cliError{code: c.code, message: m, exit: 1}
	}
	if c.code == "outcome_uncertain" {
		return system("outcome_uncertain", "the change may or may not have been written; read admin integrations list before deciding to repeat it (nothing was retried)")
	}
	return err
}

func readIntegrations() (controlIntegrations, error) {
	var v controlIntegrations
	if e := adminOperation("integration_list", nil, &v); e != nil {
		return v, integrationRejection(e)
	}
	if v.SchemaVersion != 1 || v.Apps == nil {
		return v, system("invalid_control_response", "gateway returned an invalid integrations list")
	}
	return v, nil
}

func integrationAppFor(v controlIntegrations, provider string) *controlIntegrationApp {
	for i := range v.Apps {
		if v.Apps[i].Provider == provider {
			return &v.Apps[i]
		}
	}
	return nil
}

// readSecret reads one secret from a file or stdin, never from argv. A single
// trailing newline, as echo and editors leave it, is not part of it.
func readSecret(path string) (string, error) {
	var r io.Reader = os.Stdin
	if path != "-" {
		f, e := os.Open(path)
		if e != nil {
			return "", usage(fmt.Sprintf("cannot read --client-secret-file %q; give a readable file or - for stdin", path))
		}
		defer f.Close()
		if info, e := f.Stat(); e != nil || !info.Mode().IsRegular() {
			return "", usage(fmt.Sprintf("--client-secret-file %q is not a regular file", path))
		}
		r = f
	}
	b, e := io.ReadAll(io.LimitReader(r, 260))
	if e != nil {
		return "", usage("the client secret could not be read")
	}
	s := strings.TrimSuffix(strings.TrimSuffix(string(b), "\n"), "\r")
	if len(s) == 0 || len(s) > 256 {
		return "", usage("expected one client secret of 1–256 characters on --client-secret-file")
	}
	return s, nil
}

func adminIntegrationsCommand(args []string) (any, error) {
	const shape = "expected admin integrations list, admin integrations set --provider google|dropbox --client-id <id> --client-secret-file <path|-> [--dry-run], admin integrations set --provider microsoft --client-id <id> --tenant-id <id> [--dry-run] or admin integrations clear --provider <provider> [--dry-run]"
	if len(args) == 0 {
		return nil, usage(shape)
	}
	switch args[0] {
	case "list":
		if len(args) != 1 {
			return nil, usage("expected admin integrations list")
		}
		v, e := readIntegrations()
		if e != nil {
			return nil, e
		}
		return envelope(map[string]any{"browser_setup": v.BrowserSetup, "apps": v.Apps, "count": len(v.Apps)}), nil
	case "set", "clear":
	default:
		return nil, usage(shape)
	}
	verb := args[0]
	flags := map[string]string{}
	dry := false
	allowed := []string{"--provider"}
	if verb == "set" {
		allowed = append(allowed, "--client-id", "--client-secret-file", "--tenant-id")
	}
	for i := 1; i < len(args); i++ {
		switch {
		case args[i] == "--dry-run":
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
	provider := flags["--provider"]
	if !slices.Contains(integrationapps.Providers, provider) {
		return nil, usage(fmt.Sprintf("invalid --provider %q; expected google, microsoft or dropbox", provider))
	}
	var fields map[string]string
	if verb == "set" {
		secretField := integrationapps.SecretField(provider)
		_, hasSecret := flags["--client-secret-file"]
		_, hasTenant := flags["--tenant-id"]
		if hasSecret != (secretField != "") || hasTenant != (provider == "microsoft") {
			return nil, usage(fmt.Sprintf("--provider %s takes --client-id and %s", provider, map[bool]string{true: "--client-secret-file", false: "--tenant-id"}[secretField != ""]))
		}
		fields = map[string]string{"client_id": flags["--client-id"]}
		if hasTenant {
			fields["tenant_id"] = flags["--tenant-id"]
		}
		if hasSecret {
			secret, e := readSecret(flags["--client-secret-file"])
			if e != nil {
				return nil, e
			}
			fields[secretField] = secret
		}
		if !integrationapps.Valid(provider, fields) {
			return nil, usage(integrationFormat[provider])
		}
	}
	if dry {
		return integrationDryRun(verb, provider, fields)
	}
	request := map[string]any{"provider": provider}
	operation := "integration_clear"
	if fields != nil {
		request["fields"] = fields
		operation = "integration_set"
	}
	var v controlIntegrations
	if e := adminOperation(operation, request, &v); e != nil {
		return nil, integrationRejection(e)
	}
	if v.SchemaVersion != 1 || v.Apps == nil {
		return nil, system("invalid_control_response", "gateway returned an invalid integrations list")
	}
	return envelope(map[string]any{"provider": provider, "app": integrationAppFor(v, provider), "updated": true}), nil
}

// integrationFormat says what each provider's console shows, without echoing
// the rejected values: one of them may be a secret.
var integrationFormat = map[string]string{
	"google":    "invalid Google OAuth client: --client-id is the Desktop app client's id ending in .apps.googleusercontent.com, the secret is its Client secret, and the two differ",
	"microsoft": "invalid Microsoft app: --client-id is the Application (client) ID and --tenant-id the organisation's Directory (tenant) ID, both GUIDs from the single-tenant app's Overview page, and the two differ",
	"dropbox":   "invalid Dropbox app: --client-id is the App key and the secret the App secret, each 1–256 letters, digits, _ or -, and the two differ",
}

// integrationDryRun reports what set or clear would do from the current list.
// The broker rereads the file under its lock at commit.
func integrationDryRun(verb, provider string, fields map[string]string) (any, error) {
	v, e := readIntegrations()
	if e != nil {
		return nil, e
	}
	if !v.BrowserSetup {
		return nil, integrationRejection(&cliError{code: "browser_setup_disabled"})
	}
	current := integrationAppFor(v, provider)
	effects := map[string]any{"current": current}
	switch {
	case verb == "clear" && current == nil:
		effects["effect"] = "nothing to remove"
	case verb == "clear":
		effects["effect"] = "remove; people can no longer connect new accounts, and connected ones cannot sign in again"
	case current == nil:
		effects["effect"] = "set; people can connect accounts once their daemon reads the file"
	default:
		effects["effect"] = "replace; accounts already connected keep using the previous credentials until they are revoked at the provider"
	}
	input := map[string]any{"provider": provider}
	if fields != nil {
		input["client_id"] = fields["client_id"]
		if t, ok := fields["tenant_id"]; ok {
			input["tenant_id"] = t
		}
	}
	return envelope(map[string]any{"dry_run": true, "would": []any{map[string]any{"action": verb, "resource": "integration-app", "input": input, "known_effects": effects, "unknown_until_apply": []string{"host_lock_at_commit", "integrations_file_at_commit"}}}}), nil
}
