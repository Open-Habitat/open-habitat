//go:build linux

package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var heavyID = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// appendHeavyHistory grows a browser conversation's own session file to at
// least mib MiB the way a real one grows: hidden padding records of picture
// data first, then a screenshot turn whose twenty pictures (3 MiB each) show
// folded, and the agent's reply. Every record continues the file's parent
// chain, as Pi's own appends do. The data is invented zero bytes.
func appendHeavyHistory(home, id string, mib int) error {
	if !heavyID.MatchString(id) || mib < 1 || mib > 2048 {
		return fmt.Errorf("invalid heavy fixture")
	}
	paths, err := filepath.Glob(filepath.Join(home, ".pi", "agent", "sessions", "*", "*_"+id+".jsonl"))
	if err != nil || len(paths) != 1 {
		return fmt.Errorf("heavy fixture session not found")
	}
	var parent any
	in, err := os.Open(paths[0])
	if err != nil {
		return err
	}
	scan := bufio.NewScanner(in)
	scan.Buffer(make([]byte, 64<<10), 256<<20)
	for scan.Scan() {
		var row struct {
			ID   string `json:"id"`
			Type string `json:"type"`
		}
		if json.Unmarshal(scan.Bytes(), &row) == nil && row.Type != "session" && row.ID != "" {
			parent = row.ID
		}
	}
	in.Close()
	if scan.Err() != nil {
		return scan.Err()
	}
	f, err := os.OpenFile(paths[0], os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	// Each growth names its records apart: a repeated id is a damaged tree.
	batch := time.Now().UnixNano()
	n := 0
	write := func(row map[string]any) error {
		n++
		row["id"] = fmt.Sprintf("heavy%x-%04d", batch, n)
		row["parentId"] = parent
		row["timestamp"] = time.Now().Add(time.Duration(n) * time.Millisecond).UTC().Format(time.RFC3339Nano)
		parent = row["id"]
		return enc.Encode(row)
	}
	picture := map[string]any{"type": "image", "mimeType": "image/png", "data": strings.Repeat("AAAA", 1<<20)}
	pictures := make([]any, 20)
	for i := range pictures {
		pictures[i] = picture
	}
	tail := int64(len(pictures))*(4<<20) + 1<<20
	for {
		st, err := f.Stat()
		if err != nil {
			return err
		}
		if st.Size()+tail >= int64(mib)<<20 {
			break
		}
		if err := write(map[string]any{"type": "custom", "customType": "heavy-fixture", "data": map[string]any{"picture": picture}}); err != nil {
			return err
		}
	}
	steps := []map[string]any{
		{"type": "message", "message": map[string]any{"role": "user", "content": []any{map[string]any{"type": "text", "text": "Ota kuvakaappaukset jokaisesta näkymästä."}}}},
		{"type": "message", "message": map[string]any{"role": "assistant", "stopReason": "toolUse", "content": []any{map[string]any{"type": "toolCall", "id": "heavyshot", "name": "screenshot", "arguments": map[string]any{}}}}},
		{"type": "message", "message": map[string]any{"role": "toolResult", "toolCallId": "heavyshot", "toolName": "screenshot", "content": pictures}},
		{"type": "message", "message": map[string]any{"role": "assistant", "stopReason": "stop", "content": []any{map[string]any{"type": "text", "text": "Korjaus on haarassa `fix/history-read`. Testasin sen kolmella kuvalla."}}}},
	}
	for _, row := range steps {
		if err := write(row); err != nil {
			return err
		}
	}
	return f.Sync()
}
