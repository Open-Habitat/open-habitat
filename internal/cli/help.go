package cli

import (
	"fmt"
	"sort"
	"strings"

	"github.com/open-habitat/open-habitat/internal/integrationapps"
)

type helpSpec struct {
	path, description, example string
	flags                      []string
}

var helpSpecs = []helpSpec{
	{"host config path", "Inspect the site selector and fixed trusted release, key and operation paths; no environment overrides", "host config path --json", []string{"--site"}},
	{"host config show", "Read the effective site and its provenance; protected references only, never secret contents", "host config show --site /etc/open-habitat/site.json --json", []string{"--site"}},
	{"host check", "Read-only site/host checks; blocked exit 1 has error.result.data; unavailable is not pass", "host check --site /etc/open-habitat/site.json --json", []string{"--site"}},
	{"host plan", "Read-only observation fingerprint and typed qualification checks; approve only an approvable plan", "host plan --site /etc/open-habitat/site.json --json", []string{"--site"}},
	{"host apply", "Install or converge the qualified declared site under the operation lock; same-input continuation and verified no-op repeat; live form requires --approved-plan and --output=jsonl (not --json)", "host apply --site /etc/open-habitat/site.json --dry-run --json", []string{"--site", "--approved-plan", "--dry-run", "--output=jsonl"}},
	{"host upgrade", "Stage an authenticated named successor, then invoke its immutable owner_binary to perform explicitly approved maintenance; fixed-forward only", "host upgrade --site /etc/open-habitat/site.json --dry-run --json", []string{"--site", "--approved-plan", "--approve-maintenance", "--approve-interruption", "--dry-run", "--output=jsonl"}},
	{"host prepare", "Plan and execute bounded EDQUOT preparation, numeric-GID policy files and disruptive proc/logind/polkit restarts; verified session_restarting continuation uses a fresh preview approval; no listener instance or host activation; real form requires --approved-plan, --approve-disruption and --output=jsonl", "host prepare --site /etc/open-habitat/site.json --dry-run --json", []string{"--site", "--approved-plan", "--approve-disruption", "--dry-run", "--output=jsonl"}},
	{"host operation show", "Read root-only durable phase intent, not proof of host action completion", "host operation show 00000000000000000000000000000001 --json", nil},
	{"agent history list", "Discover native histories, or read/export one explicit conversation", "agent history list --output histories.jsonl --json", []string{"--conversation", "--output"}},
	{"agent history-block show", "Read a revision-bound block; export all remaining chunks to JSONL", "agent history-block show --conversation pi:00000000-0000-4000-8000-000000000001 --entry entry1 --block 0 --revision rev_example --output block.jsonl --json", []string{"--conversation", "--entry", "--block", "--revision", "--offset", "--output"}},
	{"agent receipt show", "Read the original command acknowledgement, not turn completion", "agent receipt show --conversation pi:00000000-0000-4000-8000-000000000001 --command 00000000-0000-4000-8000-000000000002 --json", []string{"--conversation", "--command"}},
	{"agent process list", "Read owned process inventory and owner-generation/token fences", "agent process list --conversation pi:00000000-0000-4000-8000-000000000001 --output processes.jsonl --json", []string{"--conversation", "--output"}},
	{"agent process show", "Read a selected process output tail with both ownership fences", "agent process show --conversation pi:00000000-0000-4000-8000-000000000001 --process proc_abcd --owner-generation GENERATION --process-token pt_1000 --output output.jsonl --json", []string{"--conversation", "--process", "--owner-generation", "--process-token", "--tail-lines", "--output"}},
	{"agent process stop", "Stop exactly the selected process; --force requests immediate kill", "agent process stop --conversation pi:00000000-0000-4000-8000-000000000001 --process proc_abcd --owner-generation GENERATION --process-token pt_1000 --json", []string{"--conversation", "--process", "--owner-generation", "--process-token", "--force", "--dry-run"}},
	{"agent process delete", "Clear only finished process records of the selected owner generation", "agent process delete --conversation pi:00000000-0000-4000-8000-000000000001 --owner-generation GENERATION --finished-only --json", []string{"--conversation", "--owner-generation", "--finished-only", "--dry-run"}},
	{"agent attachment create", "Register bytes in the native attachments directory (1..20 MiB)", "agent attachment create --input-file - --json", []string{"--input-file", "--dry-run"}},
	{"agent attachment show", "Download registered bytes into a private new file, never inline", "agent attachment show --attachment 00000000-0000-4000-8000-000000000001 --output image.png --json", []string{"--attachment", "--output"}},

	{"agent integration list", "Read native accounts and sync state; no login tokens", "agent integration list --json", nil},
	{"agent question answer", "Answer the observed pending native question; protected JSON: request_id, value (boolean or string)", "agent question answer --conversation pi:00000000-0000-4000-8000-000000000001 --input-file - --json", []string{"--conversation", "--input-file", "--dry-run"}},
	{"agent question cancel", "Cancel the observed native question; protected JSON: request_id; delivery remains uncertain", "agent question cancel --conversation pi:00000000-0000-4000-8000-000000000001 --input-file - --json", []string{"--conversation", "--input-file", "--dry-run"}},
	{"agent integration-login create", "Start own-UID OAuth; JSON: provider, optional existing address, optional account level (full, drafts, read, app_folder) from integrations list; give URL/device code to the person", "agent integration-login create --input-file - --json", []string{"--input-file", "--dry-run"}},
	{"agent integration-login show", "Observe own-UID OAuth attempt, never a browser lease", "agent integration-login show --json", nil},
	{"agent integration-login update", "Submit protected JSON: attempt_id and either redirect_url (loopback) or folders (IDs)", "agent integration-login update --input-file - --json", []string{"--input-file", "--dry-run"}},
	{"agent integration-login delete", "Cancel own-UID OAuth; protected JSON: attempt_id; not grant revocation", "agent integration-login delete --input-file - --json", []string{"--input-file", "--dry-run"}},
	{"agent pi-login create", "Start native Pi device login; give URL and device code to the person, never handle their password", "agent pi-login create --json", []string{"--dry-run"}},
	{"agent pi-login show", "Observe the exact own-UID Pi attempt from create", "agent pi-login show --attempt 00000000000000000000000000000001 --json", []string{"--attempt"}},
	{"agent pi-login delete", "Cancel the exact own-UID Pi attempt; not logout", "agent pi-login delete --attempt 00000000000000000000000000000001 --json", []string{"--attempt", "--dry-run"}},
	{"agent claude-login create", "Start native Claude subscription login; give browser URL to the person", "agent claude-login create --json", []string{"--dry-run"}},
	{"agent claude-login show", "Read own-UID Claude attempt or native subscription presence", "agent claude-login show --json", nil},
	{"agent claude-login update", "Submit one-time Claude code through protected JSON: attempt_id, code", "agent claude-login update --input-file - --json", []string{"--input-file", "--dry-run"}},
	{"agent claude-login delete", "Cancel own-UID Claude attempt through protected JSON: attempt_id; not logout", "agent claude-login delete --input-file - --json", []string{"--input-file", "--dry-run"}},
	{"agent integration-account create", "Connect a password account using protected integration-account JSON, excluding action", "agent integration-account create --input-file - --json", []string{"--input-file", "--dry-run"}},
	{"agent integration-account update", "Change a password using protected JSON: provider, address, password", "agent integration-account update --input-file - --json", []string{"--input-file", "--dry-run"}},
	{"agent integration-account delete", "Remove native account using protected JSON: provider, address, delete_directories (Trash when true)", "agent integration-account delete --input-file - --json", []string{"--input-file", "--dry-run"}},
	{"agent credential list", "Read Pi credential presence, never keys or references", "agent credential list --json", nil},
	{"agent credential update", "Save a literal OpenAI, Anthropic or DeepSeek API key from protected raw input; not argv or environment", "agent credential update --provider anthropic --secret-file - --json", []string{"--provider", "--secret-file", "--dry-run"}},
	{"agent credential delete", "Remove one provider's API key from native Pi auth; subscriptions unchanged", "agent credential delete --provider openai --json", []string{"--provider", "--dry-run"}},
	{"agent code-host create", "Connect a Gitea or GitLab account with the person's personal access token from protected raw input, exactly as Settings → code hosts does; the token goes only into tea's or glab's own file", "agent code-host create --provider gitea --base-url https://gitea.example.test --secret-file - --json", []string{"--provider", "--base-url", "--secret-file", "--dry-run"}},
	{"agent code-host update", "Replace the token of one connection from integration list with a new token of the same account", "agent code-host update --connection gitea_0123456789abcdef01234567 --secret-file - --json", []string{"--connection", "--secret-file", "--dry-run"}},
	{"agent code-host check", "Ask the server whether the stored token still works and may push; writes nothing", "agent code-host check --connection gitea_0123456789abcdef01234567 --json", []string{"--connection"}},
	{"agent code-host repair", "Register Git's credential helper again for a connection whose git state is not registered", "agent code-host repair --connection gitea_0123456789abcdef01234567 --json", []string{"--connection", "--dry-run"}},
	{"agent code-host delete", "Remove one connection's local tea or glab login; the token is not revoked on the server", "agent code-host delete --connection gitlab_0123456789abcdef01234567 --json", []string{"--connection", "--dry-run"}},
	{"agent speech-key show", "Read whether the person has a dictation (Soniox) key: presence, region, source (own or site) and at most its last four characters", "agent speech-key show --json", nil},
	{"agent speech-key update", "Save the person's own Soniox key from protected raw input, as Settings → dictation does; stored only after Soniox takes it, under the region it answered in", "agent speech-key update --secret-file - --json", []string{"--secret-file", "--dry-run"}},
	{"agent speech-key delete", "Remove the dictation key file; dictation stops until a key is saved again", "agent speech-key delete --json", []string{"--dry-run"}},
	{"agent recap-settings show", "Read the conversation recap settings Pi keeps in its settings.json", "agent recap-settings show --json", nil},
	{"agent recap-settings update", "Replace the recap settings with a complete document (every field of show's settings)", "agent recap-settings update --input-file - --json", []string{"--input-file", "--dry-run"}},
	{"agent conversation list", "List daemon handles with title (native name, then first message, then Uusi keskustelu); manual names beat automatic titles; never starts Pi", "agent conversation list --output conversations.jsonl --json", []string{"--output"}},
	{"agent conversation create", "Start a conversation; lost replies are uncertain, inspect list before acting", "agent conversation create --workspace ws_example123 --json", []string{"--workspace", "--provider", "--model", "--thinking", "--worktree", "--dry-run"}},
	{"agent conversation resume", "Resume after the existing native ownership and one-writer proof", "agent conversation resume --conversation pi:00000000-0000-4000-8000-000000000001 --json", []string{"--conversation", "--dry-run"}},
	{"agent conversation stop", "Stop the daemon-owned Pi, not its detached tools", "agent conversation stop --conversation pi:00000000-0000-4000-8000-000000000001 --json", []string{"--conversation", "--dry-run"}},
	{"agent conversation delete", "Close only a fresh empty daemon-owned conversation", "agent conversation delete --conversation pi:00000000-0000-4000-8000-000000000001 --empty-only --json", []string{"--conversation", "--empty-only", "--dry-run"}},
	{"agent conversation update", "Change archive annotation using an explicit fresh observation", "agent conversation update --conversation pi:00000000-0000-4000-8000-000000000001 --workspace ws_example123 --archived true --previous-archive active --observation-token obs_example --json", []string{"--conversation", "--workspace", "--archived", "--previous-archive", "--observation-token", "--dry-run"}},
	{"agent archive show", "Read the native archive state and freshness token", "agent archive show --conversation pi:00000000-0000-4000-8000-000000000001 --json", []string{"--conversation"}},
	{"agent continuation show", "Read native continuation eligibility without starting Pi", "agent continuation show --conversation pi:00000000-0000-4000-8000-000000000001 --json", []string{"--conversation"}},
	{"agent message create", "Send, steer or follow up on an explicit own conversation", "agent message create --conversation pi:00000000-0000-4000-8000-000000000001 --idempotency-key 00000000-0000-4000-8000-000000000002 --text-file - --json", []string{"--conversation", "--idempotency-key", "--text-file", "--delivery", "--dry-run"}},
	{"agent queue show", "Read status including queued and held messages", "agent queue show --conversation pi:00000000-0000-4000-8000-000000000001 --json", []string{"--conversation"}},
	{"agent queue delete", "Clear the native queue or cancel held messages with --held", "agent queue delete --conversation pi:00000000-0000-4000-8000-000000000001 --idempotency-key 00000000-0000-4000-8000-000000000002 --json", []string{"--conversation", "--idempotency-key", "--held", "--dry-run"}},
	{"agent turn interrupt", "Interrupt the active turn without stopping Pi", "agent turn interrupt --conversation pi:00000000-0000-4000-8000-000000000001 --idempotency-key 00000000-0000-4000-8000-000000000002 --json", []string{"--conversation", "--idempotency-key", "--dry-run"}},
	{"agent title create", "Generate a native title; --workspace selects settled history naming", "agent title create --conversation pi:00000000-0000-4000-8000-000000000001 --json", []string{"--conversation", "--workspace", "--dry-run"}},
	{"agent recap show", "Read the latest native recap", "agent recap show --conversation pi:00000000-0000-4000-8000-000000000001 --json", []string{"--conversation"}},
	{"agent recap create", "Generate a native recap; inspect recap show after an uncertain reply", "agent recap create --conversation pi:00000000-0000-4000-8000-000000000001 --json", []string{"--conversation", "--dry-run"}},
	{"agent model list", "Read native Pi catalog and global defaults without starting Pi", "agent model list --json", nil},
	{"agent model update", "Select global defaults for future conversations; omitted thinking is preserved", "agent model update --provider openai-codex --model gpt-5.5 --thinking medium --json", []string{"--provider", "--model", "--thinking", "--dry-run"}},
	{"agent browser status", "Read the person's server browser: whether it runs, who has control, its windows and the DevTools address (ws+unix) for Playwright or Puppeteer", "agent browser status --json", nil},
	{"agent browser start", "Start the person's server browser if it is not running; it stops after a day unused", "agent browser start --json", nil},
	{"agent browser request", "Ask the person to handle one window (sign-in, MFA code); the window id comes from status; --clear withdraws the request", "agent browser request --text \"Enter the confirmation code\" --window 0123456789ABCDEF0123456789ABCDEF --json", []string{"--text", "--window", "--clear"}},
	{"version", "Show binary and skill provenance", "version --json", nil},
	{"config path", "Locate personal native settings (or explicit operator component)", "config path --json", []string{"--component"}},
	{"config show", "Inspect non-secret configuration and sources", "config show --json", []string{"--component"}},
	{"doctor", "Check personal settings and socket (or explicit operator component)", "doctor --json", []string{"--component"}},
	{"gateway exec", "Run the gateway service", "gateway exec --config /etc/open-habitat/gateway.json --verbose", []string{"--config"}},
	{"daemon exec", "Run the per-user daemon with both activated sockets", "daemon exec --config /etc/open-habitat/daemon.json --verbose", []string{"--config"}},
	{"daemon browser-host", "Run the person's server browser; their daemon starts it as them with every path chosen", "daemon browser-host --dir /run/user/1000/open-habitat/browser --xvnc /usr/bin/Xtigervnc --chrome /opt/google/chrome/google-chrome --profile /home/a/.local/share/open-habitat/browser/profile --cache /home/a/.cache/open-habitat/browser", []string{"--dir", "--xvnc", "--chrome", "--profile", "--cache", "--idle-seconds"}},
	{"broker exec", "Run the root provisioning broker", "broker exec --verbose", nil},
	{"admin readiness show", "Inspect privileged readiness", "admin readiness show --json", nil},
	{"admin settings show", "Inspect host settings", "admin settings show --json", nil},
	{"admin settings update", "Update host name or default quota", "admin settings update --name Example --dry-run --json", []string{"--name", "--default-limit-bytes", "--dry-run"}},
	{"admin onboarding show", "Read the site onboarding configuration and its version: repositories {mode, defaults}, integrations [{provider, required}], ai_account {offer}", "admin onboarding show --json", nil},
	{"admin onboarding update", "Replace the whole site onboarding configuration when --expected-version is current; affects only onboardings that start afterwards", "admin onboarding update --file onboarding.json --expected-version 3 --dry-run --json", []string{"--file", "--expected-version", "--dry-run"}},
	{"admin ai-key show", "Read whether the site holds an AI key: provider, its last four characters and when it was set, never the key; with the AI offer and onboarding version", "admin ai-key show --json", nil},
	{"admin ai-key copies", "List joined people with the site key copy the site gave each (provider, last four characters, when, whether it is the current key) and how many allowed people have not signed in; what their Pi holds now is checked only by seed", "admin ai-key copies --json", nil},
	{"admin ai-key set", "Store the site AI key and make the AI offer site_key; new people's Pi gets a copy at the sign-in that creates their account, never over a key they have; a new key also replaces every copy the site gave of an earlier key of the same provider, in those people's own credentials; the key's own account pays; read from a file or stdin, never argv", "admin ai-key set --provider anthropic --key-file - --dry-run --json", []string{"--provider", "--key-file", "--dry-run"}},
	{"admin ai-key delete", "Remove the site AI key and set the offer new people get instead; copies already given stay with their people until the key is revoked at the provider, and a later key replaces them", "admin ai-key delete --offer all --dry-run --json", []string{"--offer", "--dry-run"}},
	{"admin ai-key seed", "Give the stored site key to one joined person: their own daemon writes it into their Pi credentials only where they have none for its provider or exactly an earlier site copy, never over their own key or subscription; --dry-run asks their daemon what it would do and writes nothing", "admin ai-key seed --github-id 583231 --dry-run --json", []string{"--github-id", "--dry-run"}},
	{"admin access list", "List who may sign in: site.json (operator), runtime (site_admin) and GitHub team admissions with state, actor and time, the listed teams, administrators and unconfirmed withdrawals", "admin access list --state joined --json", []string{"--state"}},
	{"admin access lookup", "Resolve a GitHub login to its numeric id through GitHub's public users API; organisations and bots are refused", "admin access lookup --login octocat --json", []string{"--login"}},
	{"admin access add", "Admit a GitHub id at runtime, or restore a withdrawn one to the same Unix account; refused while site.json identities.runtime_admission is false", "admin access add --github-id 583231 --dry-run --json", []string{"--github-id", "--dry-run"}},
	{"admin access remove", "Withdraw a runtime-admitted id's web access; its Unix account, files, SSH and processes stay; site.json admissions are refused", "admin access remove --github-id 583231 --dry-run --json", []string{"--github-id", "--dry-run"}},
	{"admin integrations list", "List the Google, Microsoft and Dropbox app credentials in integrations.json: client id, whether daemons use it, and who set it when; secrets are never shown", "admin integrations list --json", nil},
	{"admin integrations set", "Have the broker write one provider's app credentials, replacing any there; the secret is read from a file or stdin, never argv; refused while site.json integrations.browser_setup is false or host maintenance runs", "admin integrations set --provider google --client-id 704213598812-example.apps.googleusercontent.com --client-secret-file - --dry-run --json", []string{"--provider", "--client-id", "--client-secret-file", "--tenant-id", "--dry-run"}},
	{"admin integrations clear", "Have the broker remove one provider's app credentials; people can no longer connect or sign in again with that provider", "admin integrations clear --provider dropbox --dry-run --json", []string{"--provider", "--dry-run"}},
	{"admin users list", "List bound host users, each with the onboarding receipt of the sign-in that created the account", "admin users list --json", nil},
	{"admin role update", "Update a subject's administrator role", "admin role update 123 --administrator true --dry-run --json", []string{"--administrator", "--dry-run"}},
	{"admin storage list", "Inspect host user quotas", "admin storage list --json", nil},
	{"admin storage update", "Update a subject's hard quota", "admin storage update 123 --limit-bytes 1073741824 --dry-run --json", []string{"--limit-bytes", "--dry-run"}},
	{"maintenance enter", "Enter maintenance", "maintenance enter --idempotency-key example --dry-run --json", []string{"--idempotency-key", "--dry-run"}},
	{"maintenance leave", "Leave maintenance", "maintenance leave --idempotency-key example --dry-run --json", []string{"--idempotency-key", "--dry-run"}},
	{"revoke subject", "Revoke a bound subject as root", "revoke subject 123 --json", nil},
	{"gitea git-credential", "Git credential-helper protocol for tea's native Gitea PAT logins: Git appends get, store or erase; get prints username/password only to Git for one unique HTTPS host:port, base path and username match; store and erase keep nothing", "gitea git-credential get", []string{"--login"}},
	{"gitlab git-credential", "Git credential-helper protocol for glab's native GitLab token logins: Git appends get, store or erase; get prints username/password only to Git for the one HTTPS host:port glab holds a token for, a project path below its base and its own username; store and erase keep nothing", "gitlab git-credential get", nil},
	{"skill list", "List version-matched companion skills", "skill list --json", nil},
	{"skill print", "Read a bundled skill without installing", "skill print agent --json", nil},
	{"skill install", "Install operator or agent skill to native runtime layouts", "skill install agent --target ./skills-example --dry-run --json", []string{"--agent", "--target", "--dry-run", "--force"}},
	{"agent notice create", "Send an agent notice through the native conversation writer; persistence is explicit", "agent notice create --current --text Blocked --idempotency-key 00000000-0000-4000-8000-000000000001 --json", []string{"--conversation", "--current", "--text", "--text-file", "--idempotency-key", "--dry-run"}},
	{"agent notice list", "Read the latest 200 native conversation notices", "agent notice list --current --json", []string{"--conversation", "--current", "--output"}},
	{"agent view offer", "Offer a readable HTML file, or a directory with --entry-file, as a frozen view the person opens in a side panel or own tab; publishes a card in the --current or --conversation conversation, never opens anything; refused with views_unavailable where the site has no view origin", "agent view offer --current --source /var/tmp/report.html --title Quarterly-results --idempotency-key 00000000-0000-4000-8000-000000000002 --json", []string{"--workspace", "--source", "--entry-file", "--title", "--conversation", "--current", "--idempotency-key", "--dry-run"}},
	{"agent view list", "List the person's frozen views, newest first", "agent view list --json", []string{"--output"}},
	{"agent view remove", "Remove one frozen view's export; open cards say it is gone", "agent view remove --view vabcdefghijklmnopqrstuvwxyz --dry-run --json", []string{"--view", "--dry-run"}},
	{"agent file offer", "Offer readable files (repeat --source; a directory keeps its folders) as a frozen copy the person previews and downloads; publishes a card in the --current or --conversation conversation, never sends anything elsewhere", "agent file offer --current --source /var/tmp/report.pdf --title Quarterly-results --idempotency-key 00000000-0000-4000-8000-000000000003 --json", []string{"--workspace", "--source", "--title", "--conversation", "--current", "--idempotency-key", "--dry-run"}},
	{"agent file list", "List the person's file offers, newest first", "agent file list --json", []string{"--output"}},
	{"agent file remove", "Remove one file offer's frozen copy; its card says it was removed", "agent file remove --offer-id fabcdefghijklmnopqrstuvwxyz --dry-run --json", []string{"--offer-id", "--dry-run"}},
	{"agent environment show", "Read own quota, capacity, daemon version, the site's public origin for links and whether it shows views", "agent environment show --json", nil},
	{"agent workspace list", "Discover native workspaces", "agent workspace list --json", []string{"--output"}},
	{"agent conversation show", "Read an explicit live record or verified inherited context", "agent conversation show --current --json", []string{"--current", "--conversation"}},
}

func init() {
	for _, spec := range workspaceCommandSpecs {
		helpSpecs = append(helpSpecs, helpSpec{"agent " + spec.key, spec.description, "agent " + spec.example + " --json", strings.Fields(spec.flags)})
	}
}

func helpRequested(args []string) bool {
	for _, a := range args {
		if a == "--help" || a == "-h" || a == "help" {
			return true
		}
	}
	return false
}
func commandHelp(args []string) (any, error) {
	path := []string{}
	for _, a := range args {
		if a == "--help" || a == "-h" || a == "help" {
			continue
		}
		path = append(path, a)
	}
	key := strings.Join(path, " ")
	matches := []helpSpec{}
	children := map[string]bool{}
	var exact *helpSpec
	for _, spec := range helpSpecs {
		if key == spec.path {
			v := spec
			exact = &v
		}
		if key == "" || spec.path == key || strings.HasPrefix(spec.path, key+" ") {
			matches = append(matches, spec)
			suffix := strings.TrimSpace(strings.TrimPrefix(spec.path, key))
			if suffix != "" {
				children[strings.Fields(suffix)[0]] = true
			}
		}
	}
	if len(matches) == 0 {
		return nil, usage(fmt.Sprintf("unknown help command path %q", key))
	}
	subs := []string{}
	for s := range children {
		subs = append(subs, s)
	}
	sort.Strings(subs)
	flags := []any{helpFlag("--json"), helpFlag("--verbose"), helpFlag("--help")}
	if key == "" {
		flags = append(flags, helpFlag("--version"))
	}
	examples := []any{}
	for _, spec := range matches {
		examples = append(examples, map[string]any{"description": spec.description, "argv": append([]string{"open-habitat"}, strings.Fields(spec.example)...)})
	}
	description := "Open Habitat: personal agent operations and explicit operator services"
	if exact != nil {
		description = exact.description
		for _, f := range exact.flags {
			flag := helpFlag(f)
			if f == "--provider" && strings.HasPrefix(key, "agent credential ") {
				flag["description"] = "Required provider whose API key Pi stores; subscriptions are separate"
				flag["possible_values"] = []string{"openai", "anthropic", "deepseek"}
			}
			if f == "--provider" && key == "agent code-host create" {
				flag["description"] = "Required code host; later commands take it from the connection ID"
				flag["possible_values"] = []string{"gitea", "gitlab"}
			}
			if f == "--secret-file" && strings.HasPrefix(key, "agent code-host ") {
				flag["description"] = "The person's personal access token (Gitea: read:user and write:repository; GitLab: read_api and write_repository), maximum 1024 printable ASCII bytes and one trailing newline; regular own-UID mode 0600 file or - for redirected stdin; never argv/environment"
			}
			if f == "--secret-file" && key == "agent speech-key update" {
				flag["description"] = "The person's own Soniox API key, 16–256 bytes and one trailing newline; regular own-UID mode 0600 file or - for redirected stdin; never argv/environment"
			}
			if f == "--input-file" && key == "agent recap-settings update" {
				flag["description"] = "Complete recap settings JSON (level short|standard|thorough|custom, delay_seconds 60–540, model provider/id or null for automatic, words 10–80, next_words 4–25, messages 4–128, history_tokens 2000–32000, message_tokens 250–4000, response_tokens 128–2048, first_after_turns 1–10), at most 1024 bytes; own-UID mode 0600 file or - for stdin"
			}
			if f == "--provider" && strings.HasPrefix(key, "admin integrations ") {
				flag["description"] = "Required provider whose app credentials change; microsoft_nosend, microsoft_drafts, microsoft_read and dropbox_app_folder are the applications of a narrower account level"
				flag["possible_values"] = integrationapps.Providers
			}
			if f == "--workspace" && (key == "agent view offer" || key == "agent file offer") {
				flag["description"] = "Own conversation workspace ws_ ID the offer belongs to; defaults to the launch context's workspace with --current"
			}
			if f == "--source" && key == "agent file offer" {
				flag["description"] = "Absolute path, or path relative to the current working directory as in any shell command, readable as the person; file or directory, repeatable up to 20; a file keeps its name, a directory its folders (one directory alone is the package); symlinks and special files refuse the offer, hidden entries in a directory are skipped; at most 200 files and 512 MiB"
			}
			if f == "--title" && key == "agent file offer" {
				flag["description"] = "Always supply a short descriptive title in the person's language, not a filename; plain text, 1–200 UTF-8 bytes; defaults to the file or directory name if omitted; required with several --source"
			}
			if f == "--login" && key == "admin access lookup" {
				flag["description"] = "Required GitHub login to resolve to its numeric id; read-only"
			}
			flags = append(flags, flag)
		}
	}
	arguments := []any{}
	switch key {
	case "host operation show":
		arguments = append(arguments, map[string]any{"name": "operation_id", "required": true, "description": "Exact 32-character lowercase hexadecimal durable operation ID"})
	case "agent conversation show":
		arguments = append(arguments, map[string]any{"name": "pi:UUID", "required": false, "description": "Explicit live controller record; mutually exclusive with --current"})
	case "gitea git-credential", "gitlab git-credential":
		arguments = append(arguments, map[string]any{"name": "operation", "required": true, "possible_values": []string{"get", "store", "erase"}, "description": "Appended by Git; request attributes arrive on stdin"})
	case "skill print", "skill install":
		arguments = append(arguments, map[string]any{"name": "name", "required": true, "possible_values": []string{"operator", "agent"}})
	case "admin role update", "admin storage update", "revoke subject":
		arguments = append(arguments, map[string]any{"name": "subject", "required": true, "description": "Canonical positive decimal GitHub subject"})
	}
	return envelope(map[string]any{"name": "open-habitat", "command_path": append([]string{"open-habitat"}, path...), "description": description, "subcommands": subs, "flags": flags, "args": arguments, "examples": examples, "exit_codes": map[string]string{"0": "success (including help/version)", "1": "caller or domain error", "2": "system or internal error", "130": "SIGINT", "143": "SIGTERM"}}), nil
}
func helpFlag(name string) map[string]any {
	v := map[string]any{"long": name, "description": name, "default": nil, "env": nil, "possible_values": []string{}, "deprecated": false}
	switch name {
	case "--approve-maintenance":
		v["description"] = "Explicitly approve the maintenance window for a real host upgrade; does not approve interruption of native work"
		v["default"] = false
	case "--approve-interruption":
		v["description"] = "Additionally approve interruption of observed native work and persistent service activators; does not override unavailable inventory"
		v["default"] = false
	case "--approved-plan":
		v["description"] = "Exact current 64-character lowercase observation plan ID; required without --dry-run; never bypasses qualification; stale IDs are refused"
	case "--output=jsonl":
		v["description"] = "Versioned stdout progress and exactly one terminal event; required for live host maintenance, mutually exclusive with --json"
	case "--site":
		v["description"] = "Required absolute strict version-1 site file; source=flag; root-owned private regular file, trusted parents; no environment/includes/overrides"
	case "--owner-generation":
		v["description"] = "Exact owner_generation from process list, not a conversation ID"
	case "--process-token":
		v["description"] = "Exact process_token from the selected process list row; never reuse after a record changes"
	case "--process":
		v["description"] = "Selected native proc_ ID; owner generation and process token are also required"
	case "--tail-lines":
		v["description"] = "Output tail length, 1..2000"
		v["default"] = 100
	case "--offset":
		v["description"] = "Block byte/base64 offset (0..512 MiB)"
		v["default"] = 0
	case "--block":
		v["description"] = "Zero-based history block index, 0..127; required"
	case "--revision":
		v["description"] = "Native revision from the history entry; changed revisions refuse block reads"
	case "--command":
		v["description"] = "Original message command UUID; acknowledgement is not turn completion"
	case "--attachment":
		v["description"] = "Registered attachment UUID; binary downloads require --output"
	case "--source":
		v["description"] = "Absolute path, or path relative to the current working directory as in any shell command, readable as the person; HTML file, or a directory exported with --entry-file; symlinks and special files refuse the offer, hidden entries are skipped; at most 500 files and 50 MiB"
	case "--entry-file":
		v["description"] = "The .html file the view opens, relative to a --source directory; for a file it may only repeat the file's name"
	case "--title":
		v["description"] = "Always supply a short descriptive title in the person's language, naming the subject and useful iteration, not a filename; plain text, 1–200 UTF-8 bytes; defaults to the HTML filename if omitted, not the document's <title>"
	case "--view":
		v["description"] = "Exact view_id from agent view list"
	case "--offer-id":
		v["description"] = "Exact offer_id from agent file list"
	case "--workspace":
		v["description"] = "Explicit own ws_ ID from workspace list; required for creation/archive and settled-history title generation"
	case "--name":
		v["description"] = "Workspace directory name beneath native src; 1–255 UTF-8 bytes, no slash/control characters or leading dot/hyphen"
	case "--display-name":
		v["description"] = "Display override up to 255 UTF-8 bytes; update accepts empty string to clear it"
	case "--entry":
		v["description"] = "Exact history entry key, registry entry or Trash entry from its matching observation, never a path"
	case "--repository":
		v["description"] = "Exact GitHub owner/repo, never a URL or credentials"
	case "--job":
		v["description"] = "Exact 32-character lowercase hexadecimal clone job ID from clone create/list"
	case "--deletion":
		v["description"] = "Read native deletion checks without removing anything; not a reservation"
		v["default"] = false
	case "--checkout":
		v["description"] = "Observe the local import destination rather than remote repository metadata"
		v["default"] = false
	case "--merged-only":
		v["description"] = "Remove only the exact merged set named by --listing-token; forbids single-entry flags"
		v["default"] = false
	case "--all":
		v["description"] = "Empty only the exact Trash set named by --listing-token; forbids entry/confirmation"
		v["default"] = false
	case "--interrupted-only":
		v["description"] = "Explicitly remove the interrupted --repository destination; forbids --job"
		v["default"] = false
	case "--mode":
		v["possible_values"] = []string{"full", "blobless"}
	case "--disposal":
		v["description"] = "Workspace: trash|permanent; worktree: remove|commit|force|prune"
	case "--confirmation":
		v["description"] = "Exact typed name for permanent Trash deletion or forced worktree removal"
	case "--listing-token", "--user-observation-token":
		v["description"] = "Fresh token from the matching native listing; never infer or reuse across targets"
	case "--git", "--hidden":
		v["possible_values"] = []string{"true", "false"}
	case "--archived":
		v["possible_values"] = []string{"true", "false"}
	case "--previous-archive":
		v["possible_values"] = []string{"active", "archived"}
	case "--observation-token":
		v["description"] = "Fresh token from the matching archive/workspace/worktree observation; checked again on write"
	case "--worktree":
		v["description"] = "Create a browser worktree conversation, not a Taskfleet run; 1–40 lowercase alphanumeric/hyphen characters"
	case "--delivery":
		v["possible_values"] = []string{"send", "steer", "follow-up"}
		v["default"] = "send"
	case "--empty-only":
		v["description"] = "Required opt-in: only a fresh, provably empty daemon-owned conversation may close"
		v["default"] = false
	case "--held":
		v["description"] = "Cancel daemon-held messages instead of clearing Pi's queue"
		v["default"] = false
	case "--provider":
		v["description"] = "Required model provider from model list"
		v["possible_values"] = []string{"openai-codex", "openai", "anthropic", "deepseek", "claude-bridge"}
	case "--model":
		v["description"] = "Required native model ID from model list; repeat the current provider/model to change only thinking"
	case "--thinking":
		v["description"] = "Optional default thinking level; must be supported by the selected model; omission preserves native thinking settings"
		v["possible_values"] = []string{"off", "minimal", "low", "medium", "high", "xhigh", "max"}
	case "--conversation":
		v["description"] = "Explicit own pi:UUID target; mutually exclusive with --current"
	case "--text":
		v["description"] = "Plain agent text, 1–4096 UTF-8 bytes; mutually exclusive with --text-file"
	case "--base-url":
		v["description"] = "Required HTTPS address of the Gitea or GitLab server (with a path when it is served below one), at most 2048 bytes"
	case "--connection":
		v["description"] = "Exact gitea_ or gitlab_ connection id from integration list (gitea.connections or gitlab.connections)"
	case "--attempt":
		v["description"] = "Exact 32-lowercase-hex Pi attempt_id returned by create; stale IDs never select a successor"
	case "--input-file":
		v["description"] = "Protected command JSON (no action), maximum 8192 bytes (question: 66000); regular own-UID mode 0600 file or - for redirected stdin"
	case "--secret-file":
		v["description"] = "Raw literal API key of --provider, maximum 256 bytes; regular own-UID mode 0600 file or - for redirected stdin; never argv/environment"
	case "--text-file":
		v["description"] = "Read UTF-8 from FILE or - for stdin; notice maximum 4096 bytes, message maximum 65536 raw bytes and 66000 encoded request bytes"
	case "--login":
		v["description"] = "Optional tea login name that narrows the match; never selects a login whose HTTPS host:port, base path or username differs from Git's request"
	case "--idempotency-key":
		v["description"] = "Explicit UUID for notice/view-offer/file-offer/control intent; spent message/control IDs are refused, never replayed; never use a new key to retry uncertain work"
	case "--output":
		v["description"] = "Export result rows to a new FILE.jsonl (refuses overwrite); stdout reports path and count"
	case "--component":
		v["possible_values"] = []string{"gateway", "daemon"}
		v["description"] = "Explicit operator component; omit for personal native configuration"
	case "--config":
		v["description"] = "Required trusted service configuration path"
	case "--agent":
		v["possible_values"] = []string{"claude", "pi", "codex", "all"}
		v["default"] = "all"
	case "--target":
		v["description"] = "Skill installation base directory"
		v["default"] = "."
	case "--current":
		v["description"] = "Resolve inherited OPEN_HABITAT_CONVERSATION_ID, OPEN_HABITAT_WORKSPACE_ID and OPEN_HABITAT_LAUNCH_GENERATION against the daemon"
	case "--administrator":
		v["possible_values"] = []string{"true", "false"}
	case "--file":
		v["description"] = "Onboarding JSON from FILE or - for stdin, at most 7680 bytes; admin onboarding show output (envelope or data) is accepted, its version must equal --expected-version"
	case "--key-file":
		v["description"] = "Required: FILE or - for stdin holding one literal API key of --provider (sk-…, sk-ant-… for anthropic); one trailing newline is ignored; never passed in argv"
	case "--offer":
		v["description"] = "Required: what new people are offered once the site key is gone"
		v["possible_values"] = []string{"all", "chatgpt", "claude", "openai_key", "anthropic_key", "deepseek_key"}
	case "--client-id":
		v["description"] = "Required public client id: Google's ends in .apps.googleusercontent.com, Microsoft's Application (client) ID is a GUID, Dropbox's is the App key"
	case "--client-secret-file":
		v["description"] = "Required for google, dropbox and dropbox_app_folder: FILE or - for stdin holding the client secret (Dropbox App secret); one trailing newline is ignored; never passed in argv"
	case "--tenant-id":
		v["description"] = "Required for microsoft, microsoft_nosend, microsoft_drafts and microsoft_read: the organisation's Directory (tenant) ID GUID; the app is single tenant, so common, organizations and consumers are refused"
	case "--github-id":
		v["description"] = "Required canonical numeric GitHub id, as admin access lookup prints it; a login is never accepted here"
	case "--state":
		v["description"] = "Show only entries in this state"
		v["possible_values"] = []string{"allowed", "joined", "withdrawn"}
	case "--expected-version":
		v["description"] = "Required version printed by admin onboarding show (0 before the first save); a newer stored version refuses the write with version_conflict"
	case "--json", "--verbose", "--dry-run", "--force", "--finished-only":
		v["default"] = false
	}
	return v
}
func helpText(out any) string {
	data := out.(map[string]any)["data"].(map[string]any)
	var b strings.Builder
	fmt.Fprintf(&b, "%s\n%s\n", strings.Join(data["command_path"].([]string), " "), data["description"])
	if subs := data["subcommands"].([]string); len(subs) > 0 {
		fmt.Fprintf(&b, "Subcommands: %s\n", strings.Join(subs, ", "))
	}
	for _, f := range data["flags"].([]any) {
		v := f.(map[string]any)
		fmt.Fprintf(&b, "  %s  %s\n", v["long"], v["description"])
	}
	for _, e := range data["examples"].([]any) {
		v := e.(map[string]any)
		fmt.Fprintf(&b, "Example: %s\n", strings.Join(v["argv"].([]string), " "))
	}
	b.WriteString("Exit codes: 0 success; 1 caller/domain error; 2 system/internal error; 130 SIGINT; 143 SIGTERM.\n")
	return strings.TrimSuffix(b.String(), "\n")
}
