//go:build linux

package daemon

import (
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
)

type bashFailure struct {
	Kind       string `json:"kind"`
	Amount     *int   `json:"amount,omitempty"`
	StatusLine string `json:"status_line"`
}

var bashStatus = regexp.MustCompile(`^Command (?:exited with code (-?[0-9]+)|timed out after ([0-9]+) seconds|aborted)$`)

// Only Pi's terminal status on an explicitly failed bash result is recognized.
// This is a presentation hint, never evidence about process or control state.
func parseBashFailure(name string, failed bool, text string) *bashFailure {
	if name != "bash" || !failed {
		return nil
	}
	line := strings.TrimRight(text, "\r\n")
	if i := strings.LastIndexByte(line, '\n'); i >= 0 {
		line = line[i+1:]
	}
	line = strings.TrimSuffix(line, "\r")
	if len(line) > 120 {
		return nil
	}
	match := bashStatus.FindStringSubmatch(line)
	if match == nil {
		return nil
	}
	out := &bashFailure{Kind: "aborted", StatusLine: line}
	for i, kind := range []string{"exit", "timeout"} {
		if match[i+1] != "" {
			n, err := strconv.Atoi(match[i+1])
			if err != nil || n < -2147483648 || n > 2147483647 {
				return nil
			}
			out.Kind, out.Amount = kind, &n
		}
	}
	return out
}

func nativeBashFailure(name string, failed bool, content json.RawMessage) *bashFailure {
	if name != "bash" || !failed {
		return nil
	}
	var text string
	if json.Unmarshal(content, &text) == nil {
		return parseBashFailure(name, failed, text)
	}
	var blocks []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if json.Unmarshal(content, &blocks) != nil {
		return nil
	}
	var texts []string
	for _, b := range blocks {
		if b.Type == "text" {
			texts = append(texts, b.Text)
		}
	}
	return parseBashFailure(name, failed, strings.Join(texts, "\n"))
}

func liveBashFailure(name string, failed bool, result json.RawMessage) *bashFailure {
	if name != "bash" || !failed {
		return nil
	}
	var r struct {
		Content json.RawMessage `json:"content"`
	}
	if json.Unmarshal(result, &r) != nil {
		return nil
	}
	return nativeBashFailure(name, failed, r.Content)
}
