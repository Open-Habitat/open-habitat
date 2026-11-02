//go:build linux

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// seedToolHeavyHistory writes a long conversation shaped like a conductor's
// Pi session on Birch (2026-11): every prompt and reply is separated by five
// thinking+tool steps with a few KiB of output, so 100 messages are about 600
// entries and 0.9 MB, as measured there.
func seedToolHeavyHistory(path, cwd string, turns int) error {
	f, e := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if e != nil {
		return e
	}
	defer f.Close()
	encode := json.NewEncoder(f)
	if e := encode.Encode(map[string]any{"type": "session", "version": 3, "id": "11111111-1111-4111-8111-111111111111", "cwd": cwd}); e != nil {
		return e
	}
	var parent any
	write := func(id string, message map[string]any) error {
		e := encode.Encode(map[string]any{"type": "message", "id": id, "parentId": parent, "message": message})
		parent = id
		return e
	}
	output := strings.Repeat("-rw-r--r-- 1 alice alice 4096 Nov  2 09:00 synthetic-file.txt\n", 24)
	thinking := strings.Repeat("Synthetic reasoning about which file to read next. ", 6)
	for turn := 0; turn < turns; turn++ {
		if e := write(fmt.Sprintf("heavy%03d-user", turn), map[string]any{"role": "user", "content": fmt.Sprintf("Synthetic prompt %d", turn)}); e != nil {
			return e
		}
		for step := 0; step < 5; step++ {
			call := fmt.Sprintf("heavy%03d-call%d", turn, step)
			if e := write(call, map[string]any{"role": "assistant", "stopReason": "toolUse", "content": []any{
				map[string]any{"type": "thinking", "thinking": thinking},
				map[string]any{"type": "toolCall", "id": call, "name": "bash", "arguments": map[string]any{"command": fmt.Sprintf("ls -la step-%d", step)}},
			}}); e != nil {
				return e
			}
			if e := write(fmt.Sprintf("heavy%03d-result%d", turn, step), map[string]any{"role": "toolResult", "toolCallId": call, "toolName": "bash", "content": []any{map[string]any{"type": "text", "text": output}}}); e != nil {
				return e
			}
		}
		reply := fmt.Sprintf("Synthetic reply %d.\n\n- The listing showed the files.\n- Nothing needed changing.\n\n%s", turn, strings.Repeat("A paragraph of synthetic explanation. ", 12))
		if e := write(fmt.Sprintf("heavy%03d-reply", turn), map[string]any{"role": "assistant", "stopReason": "stop", "content": []any{map[string]any{"type": "text", "text": reply}}}); e != nil {
			return e
		}
	}
	return f.Sync()
}
