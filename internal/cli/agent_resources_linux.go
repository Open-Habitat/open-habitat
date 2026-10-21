//go:build linux

package cli

import (
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/daemon"
)

var resourceEntry = regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}$`)
var resourceProcess = regexp.MustCompile(`^proc_[a-f0-9]{4}$`)

type resourceRequest struct {
	conversationRequest
	key    string
	binary bool
}

func parseResourceRequest(args []string) (resourceRequest, error) {
	r := resourceRequest{conversationRequest: conversationRequest{method: "GET"}}
	if len(args) < 2 {
		return r, usage("expected resource and verb; inspect agent --help")
	}
	r.key = strings.Join(args[:2], " ")
	allowed := ""
	switch r.key {
	case "history list":
		allowed = "--conversation --output"
	case "history-block show":
		allowed = "--conversation --entry --block --revision --offset --output"
	case "receipt show":
		allowed = "--conversation --command"
	case "process list":
		allowed = "--conversation --output"
	case "process show":
		allowed = "--conversation --process --owner-generation --process-token --tail-lines --output"
	case "process stop":
		allowed = "--conversation --process --owner-generation --process-token --force --dry-run"
		r.method = "POST"
	case "process delete":
		allowed = "--conversation --owner-generation --finished-only --dry-run"
		r.method = "POST"
	case "attachment create":
		allowed = "--input-file --dry-run"
		r.method = "POST"
	case "attachment show":
		allowed = "--attachment --output"
		r.binary = true
	default:
		return r, usage(fmt.Sprintf("unknown agent command %q", r.key))
	}
	v := map[string]string{}
	for i := 2; i < len(args); i++ {
		f := args[i]
		if !strings.Contains(" "+allowed+" ", " "+f+" ") {
			return r, usage(fmt.Sprintf("unknown flag %q for %s", f, r.key))
		}
		if _, ok := v[f]; ok {
			return r, usage("duplicate " + f)
		}
		if f == "--dry-run" || f == "--force" || f == "--finished-only" {
			v[f] = "true"
			continue
		}
		i++
		if i == len(args) {
			return r, usage("missing value for " + f)
		}
		if args[i] == "" || strings.TrimSpace(args[i]) != args[i] || !utf8.ValidString(args[i]) || strings.ContainsAny(args[i], "\x00\r\n") {
			return r, usage("invalid value for " + f)
		}
		v[f] = args[i]
	}
	if v["--dry-run"] != "" {
		return r, &cliError{code: "dry_run_unsupported", message: "native resource operations cannot reserve state; inspect observations, then apply explicitly", exit: 1}
	}
	if o := v["--output"]; o != "" {
		if !r.binary && !strings.HasSuffix(o, ".jsonl") {
			return r, usage("--output requires a new FILE.jsonl")
		}
		r.output = o
	}
	id := v["--conversation"]
	if r.key != "attachment create" && r.key != "attachment show" && !(r.key == "history list" && id == "") {
		if !agentIDPattern.MatchString(id) {
			return r, usage(fmt.Sprintf("invalid --conversation %q; expected explicit pi:UUID", id))
		}
	}
	base := daemon.AgentConversationsPath + "/" + strings.TrimPrefix(id, "pi:")
	q := url.Values{}
	body := map[string]any{}
	token := func(flag string) bool { s := v[flag]; return len(s) > 0 && len(s) <= 200 }
	number := func(flag string, def, min, max int) (int, error) {
		if v[flag] == "" {
			return def, nil
		}
		n, e := strconv.Atoi(v[flag])
		if e != nil || n < min || n > max {
			return 0, usage(fmt.Sprintf("invalid %s %q; expected %d..%d", flag, v[flag], min, max))
		}
		return n, nil
	}
	switch r.key {
	case "history list":
		r.path = daemon.AgentHistoryPath
		if id != "" {
			r.path += "/" + id
		}
	case "history-block show":
		if !resourceEntry.MatchString(v["--entry"]) || !token("--revision") || v["--block"] == "" {
			return r, usage("--entry, --block (0..127), and native --revision are required")
		}
		block, e := number("--block", 0, 0, 127)
		if e != nil {
			return r, e
		}
		offset, e := number("--offset", 0, 0, 512<<20)
		if e != nil {
			return r, e
		}
		r.path = daemon.AgentHistoryPath + "/" + id + "/entries/" + v["--entry"] + "/blocks/" + strconv.Itoa(block)
		q.Set("revision", v["--revision"])
		q.Set("offset", strconv.Itoa(offset))
		q.Set("limit_bytes", "262144")
	case "receipt show":
		if !launchPattern.MatchString(v["--command"]) {
			return r, usage("--command requires the original message UUID; missing receipt is not rejection")
		}
		r.path = base + "/receipt"
		q.Set("command_id", v["--command"])
	case "process list":
		r.path = base + "/processes"
	case "process show", "process stop", "process delete":
		if !token("--owner-generation") {
			return r, usage("--owner-generation from process list is required")
		}
		r.path = base + "/processes"
		if r.key == "process delete" {
			if v["--finished-only"] == "" {
				return r, usage("process delete requires --finished-only; it clears finished records, never running tools")
			}
			r.path += "/clear-finished"
			body["owner_generation"] = v["--owner-generation"]
		} else {
			if !resourceProcess.MatchString(v["--process"]) || !token("--process-token") {
				return r, usage("--process proc_HEX and --process-token from the selected observation are required")
			}
			r.path += "/" + v["--process"]
			if r.key == "process show" {
				n, e := number("--tail-lines", 100, 1, 2000)
				if e != nil {
					return r, e
				}
				r.path += "/output"
				q.Set("owner_generation", v["--owner-generation"])
				q.Set("process_token", v["--process-token"])
				q.Set("tail_lines", strconv.Itoa(n))
			} else {
				r.path += "/stop"
				body["owner_generation"] = v["--owner-generation"]
				body["process_token"] = v["--process-token"]
				body["force"] = v["--force"] != ""
			}
		}
	case "attachment create":
		if v["--input-file"] == "" {
			return r, usage("--input-file FILE|- is required (1..20 MiB)")
		}
		var input io.Reader = os.Stdin
		if v["--input-file"] != "-" {
			f, e := os.Open(v["--input-file"])
			if e != nil {
				return r, system("io_input", "attachment input unavailable")
			}
			defer f.Close()
			st, e := f.Stat()
			if e != nil || !st.Mode().IsRegular() {
				return r, usage("attachment input must be a regular file")
			}
			input = f
		}
		b, e := io.ReadAll(io.LimitReader(input, (20<<20)+1))
		if e != nil {
			return r, system("io_input", "attachment input unreadable")
		}
		if len(b) == 0 || len(b) > 20<<20 {
			return r, usage("attachment must contain 1..20 MiB")
		}
		r.body = b
		r.path = daemon.AgentAttachmentsPath
	case "attachment show":
		if !launchPattern.MatchString(v["--attachment"]) || r.output == "" {
			return r, usage("--attachment UUID and --output FILE required; binary content is never printed inline")
		}
		r.path = daemon.AgentAttachmentsPath + "/" + v["--attachment"]
	}
	if len(body) > 0 {
		r.body, _ = json.Marshal(body)
	}
	if len(q) > 0 {
		r.path += "?" + q.Encode()
	}
	return r, nil
}

func agentResourceCommand(args []string) (any, error) {
	req, err := parseResourceRequest(args)
	if err != nil {
		return nil, err
	}
	return runResourceRequest(req, func(method, path string, body []byte, binary bool) (json.RawMessage, error) {
		return exchangeAgentPayload(method, path, body, binary)
	})
}

type resourceExchange func(string, string, []byte, bool) (json.RawMessage, error)

func resourceFailure(key string, data json.RawMessage) error {
	var v struct {
		Result string `json:"result"`
	}
	if json.Unmarshal(data, &v) != nil {
		return system("invalid_agent_response", "invalid resource result")
	}
	if key == "process stop" && v.Result != "killed" {
		return &cliError{code: "process_stop_incomplete", message: "process stop did not confirm termination; inspect fresh process state", exit: 1, result: data}
	}
	return nil
}

func runResourceRequest(req resourceRequest, exchange resourceExchange) (any, error) {
	fetch := func(path string) (json.RawMessage, error) {
		b, e := exchange(req.method, path, req.body, req.binary)
		if e == nil && !req.binary {
			e = resourceFailure(req.key, b)
		}
		return b, e
	}
	if req.output == "" {
		b, e := fetch(req.path)
		if e != nil {
			return nil, e
		}
		return envelope(map[string]any{"cli_version": version, "result": b}), nil
	}
	// Stream bounded native pages/chunks to a private no-clobber file. Any missing
	// boundary or changing revision aborts and removes the incomplete export.
	f, e := os.OpenFile(req.output, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if os.IsExist(e) {
		return nil, &cliError{code: "already_exists", message: "output exists; choose a new path", exit: 1}
	}
	if e != nil {
		return nil, system("io_output", "output file could not be created")
	}
	complete := false
	defer func() {
		f.Close()
		if !complete {
			os.Remove(req.output)
		}
	}()
	encoder := json.NewEncoder(f)
	path := req.path
	count := 0
	revision := ""
	seen := map[string]bool{}
	for {
		seenKey := path + string(req.body)
		if seen[seenKey] {
			return nil, system("invalid_agent_response", "nonadvancing export boundary")
		}
		seen[seenKey] = true
		data, err := fetch(path)
		if err != nil {
			return nil, err
		}
		if req.binary {
			if _, err = f.Write(data); err != nil {
				return nil, system("io_output", "attachment export failed")
			}
			count = len(data)
			break
		}
		var wire map[string]any
		if json.Unmarshal(data, &wire) != nil {
			return nil, system("invalid_agent_response", "invalid export result")
		}
		if r, ok := wire["native_revision"].(string); ok {
			if revision != "" && r != revision {
				return nil, &cliError{code: "stale_precondition", message: "native history changed during export; choose a new export after it settles", exit: 1}
			}
			revision = r
		}
		if req.key == "history list" && wire["cut_off"] == true {
			return nil, system("native_source_unavailable", "native history has an incomplete tail; export again after it settles")
		}
		// Each record is the existing bounded native response, preserving completeness,
		// owner tokens, interrupted records and offsets rather than discarding fences.
		wire["schema_version"] = 1
		if encoder.Encode(wire) != nil {
			return nil, system("io_output", "resource export failed")
		}
		count++
		if req.key == "history list" && strings.HasPrefix(req.path, daemon.AgentHistoryPath+"/") {
			if wire["boundary_found"] != true {
				return nil, system("invalid_agent_response", "history export boundary unavailable")
			}
			if wire["older_complete"] == true {
				break
			}
			next, ok := wire["next_before"].(string)
			if !ok || !resourceEntry.MatchString(next) {
				return nil, system("invalid_agent_response", "history export incomplete")
			}
			path = req.path + "?before=" + url.QueryEscape(next)
			continue
		}

		if req.key == "history-block show" {
			chunk, ok := wire["chunk"].(map[string]any)
			if !ok {
				return nil, system("invalid_agent_response", "missing block chunk")
			}
			if chunk["complete"] == true {
				break
			}
			next, ok := chunk["next_offset"].(float64)
			u, e := url.Parse(path)
			if !ok || e != nil || next <= 0 {
				return nil, system("invalid_agent_response", "invalid block offset")
			}
			q := u.Query()
			old, _ := strconv.Atoi(q.Get("offset"))
			if next <= float64(old) {
				return nil, system("invalid_agent_response", "nonadvancing block offset")
			}
			q.Set("offset", strconv.Itoa(int(next)))
			u.RawQuery = q.Encode()
			path = u.String()
			continue
		}
		break
	}
	if f.Close() != nil {
		return nil, system("io_output", "export close failed")
	}
	complete = true
	absolute, _ := filepath.Abs(req.output)
	unit := "records"
	format := "jsonl"
	if req.binary {
		unit = "bytes"
		format = "binary"
	}
	return envelope(map[string]any{"path": absolute, "count": count, "count_unit": unit, "format": format, "cli_version": version}), nil
}
