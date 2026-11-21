//go:build linux

package cli

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/open-habitat/open-habitat/internal/daemon"
)

var wakeIDArg = regexp.MustCompile(`^wk_[0-9a-f]{16}$`)

// agentWakeCommand schedules the agent's own wakes (experimental
// scheduled-wake): agent wake create|list|update|delete --current, and
// `due`, which the person's own systemd timer runs to fire what is due.
// Only the current conversation's wakes can be changed; there is no
// --conversation.
func agentWakeCommand(args []string) (any, error) {
	if len(args) == 0 {
		return nil, usage("expected agent wake create|list|update|delete|due; inspect --help")
	}
	verb, rest := args[0], args[1:]
	values := map[string]string{}
	current, all, id := false, false, ""
	allowed := map[string][]string{
		"create": {"--at", "--note", "--idempotency-key"},
		"list":   {"--output"},
		"update": {"--at", "--note"},
		"delete": {},
		"due":    {},
	}
	flags, known := allowed[verb]
	if !known {
		return nil, usage(fmt.Sprintf("unknown wake command %q; expected create, list, update, delete or due", verb))
	}
	for i := 0; i < len(rest); i++ {
		a := rest[i]
		switch {
		case a == "--dry-run":
			return nil, &cliError{code: "dry_run_unsupported", message: "a wake is applied explicitly; repeat a create with the same --idempotency-key to recover a lost reply, inspect with wake list --current, and remove a wake with wake delete", exit: 1}
		case a == "--current" && verb != "due":
			if current {
				return nil, usage("duplicate --current")
			}
			current = true
		case a == "--all" && verb == "list":
			if all {
				return nil, usage("duplicate --all")
			}
			all = true
		case (verb == "update" || verb == "delete") && id == "" && !strings.HasPrefix(a, "--"):
			if !wakeIDArg.MatchString(a) {
				return nil, usage(fmt.Sprintf("invalid wake id %q; expected wk_ and 16 hex digits from wake list --current", a))
			}
			id = a
		default:
			ok := false
			for _, f := range flags {
				ok = ok || f == a
			}
			if !ok {
				return nil, usage(fmt.Sprintf("unknown flag %q for agent wake %s", a, verb))
			}
			if _, dup := values[a]; dup {
				return nil, usage("duplicate " + a)
			}
			i++
			if i == len(rest) {
				return nil, usage("missing value for " + a)
			}
			values[a] = rest[i]
		}
	}
	if verb == "due" {
		data, err := exchangeAgentBody("POST", daemon.AgentWakesPath+"/due", []byte("{}"))
		if err != nil {
			return nil, err
		}
		return envelope(map[string]any{"cli_version": version, "result": data}), nil
	}
	if verb == "list" && current == all {
		return nil, usage("expected exactly one of --current (this conversation's wakes) or --all (every pending wake)")
	}
	if verb != "list" && !current {
		return nil, usage("--current is required; an agent schedules only its own conversation's wakes")
	}
	if (verb == "update" || verb == "delete") && id == "" {
		return nil, usage("missing wake id; take it from wake list --current")
	}
	body := map[string]string{}
	if at, ok := values["--at"]; ok {
		when, err := time.Parse(time.RFC3339, at)
		if err != nil {
			return nil, usage(fmt.Sprintf("invalid --at %q; expected RFC 3339 with an explicit offset or Z, for example %s; a bare local time is refused so the zone is never guessed", at, time.Now().Add(48*time.Hour).Truncate(time.Hour).Format(time.RFC3339)))
		}
		if !when.After(time.Now()) {
			return nil, usage(fmt.Sprintf("--at %s is not in the future; the current time is %s", at, time.Now().Format(time.RFC3339)))
		}
		body["at"] = at
	}
	if note, ok := values["--note"]; ok {
		if strings.TrimSpace(note) == "" || len(note) > 1000 || strings.ContainsRune(note, 0) {
			return nil, usage("invalid --note; expected 1 to 1000 bytes saying what to do when woken")
		}
		body["note"] = note
	}
	if key, ok := values["--idempotency-key"]; ok {
		if !launchPattern.MatchString(strings.ToLower(key)) {
			return nil, usage(fmt.Sprintf("invalid --idempotency-key %q; expected UUID; reuse it only for the same wake", key))
		}
		body["idempotency_key"] = key
	}
	if verb == "create" && (body["at"] == "" || body["note"] == "") {
		return nil, usage("wake create needs --at and --note")
	}
	if verb == "update" && len(body) == 0 {
		return nil, usage("wake update needs --at, --note or both")
	}
	output := values["--output"]
	if output != "" && (strings.TrimSpace(output) != output || !strings.HasSuffix(output, ".jsonl")) {
		return nil, usage(fmt.Sprintf("invalid --output %q; expected a nonempty .jsonl path", output))
	}
	path := daemon.AgentWakesPath
	if id != "" {
		path += "/" + id
	}
	if all {
		path += "?all=true"
	} else {
		cur, err := currentQuery()
		if err != nil {
			return nil, err
		}
		path += "?" + cur
	}
	var data json.RawMessage
	var err error
	switch verb {
	case "list":
		data, err = exchangeAgent(path)
	case "create":
		b, _ := json.Marshal(body)
		data, err = exchangeAgentBody("POST", path, b)
	case "update":
		b, _ := json.Marshal(body)
		data, err = exchangeAgentBody("PATCH", path, b)
	case "delete":
		data, err = exchangeAgentBody("DELETE", path, nil)
	}
	if err != nil {
		return nil, err
	}
	if output != "" {
		var list struct {
			Wakes []map[string]any `json:"wakes"`
		}
		if json.Unmarshal(data, &list) != nil {
			return nil, system("invalid_agent_response", "wake list could not be decoded")
		}
		return writeRowsOutput(output, list.Wakes)
	}
	return envelope(map[string]any{"cli_version": version, "result": data}), nil
}

// currentQuery is the --current launch context as the daemon checks it.
func currentQuery() (string, error) {
	id, workspace, generation := os.Getenv("OPEN_HABITAT_CONVERSATION_ID"), os.Getenv("OPEN_HABITAT_WORKSPACE_ID"), os.Getenv("OPEN_HABITAT_LAUNCH_GENERATION")
	if !agentIDPattern.MatchString(id) || !workspacePattern.MatchString(workspace) || !launchPattern.MatchString(generation) {
		return "", &cliError{code: "current_context_unavailable", message: "--current requires a daemon-launched Pi context", exit: 1}
	}
	q := url.Values{}
	q.Set("id", id)
	q.Set("workspace_id", workspace)
	q.Set("generation", generation)
	q.Set("current", "true")
	return q.Encode(), nil
}

// wakeError explains the daemon's refusals of a wake command to the agent.
func wakeError(code string) error {
	messages := map[string]string{
		"feature_disabled":      "scheduled wakes are an experimental feature the person has not turned on (Settings › Kokeelliset ominaisuudet › Ajastettu herätys); tell the person you cannot set a reminder until they turn it on",
		"wake_limit_reached":    "the person already has 100 pending wakes, the limit; nothing was set; delete wakes that are no longer needed (wake list --all) or tell the person",
		"wake_time_past":        "the wake time is not in the future; nothing was set",
		"idempotency_conflict":  "this --idempotency-key already names a wake with another time or note; use a new key for a new wake",
		"conversation_archived": "the conversation is archived; nothing is scheduled for an archived conversation",
		"wake_not_found":        "no wake with this id belongs to this conversation; inspect wake list --current",
		"wake_not_pending":      "the wake has already fired or been cancelled; inspect wake list --current",
		"current_context_stale": "this launch of the conversation has ended or been replaced; nothing was changed",
	}
	if m, ok := messages[code]; ok {
		return &cliError{code: code, message: m, exit: 1}
	}
	return nil
}
