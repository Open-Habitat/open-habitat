//go:build linux

package provision

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestPiSelectorDoesNotChangeJITBinding(t *testing.T) {
	e := NewLinuxHostExecutor(21003, 21003)
	for _, i := range []ExecutorIdentity{
		{provider: "github", id: "42", username: "agent-a", uid: 21001},
		{provider: "github", id: "43", username: "agent-b", uid: 21002},
	} {
		got, err := e.config(i)
		if err != nil {
			t.Fatal(err)
		}
		// Exact canonical bytes are what Verify compares against on every ensure.
		want := []byte(`{"component":"daemon","handoff":{"gateway_uid":21003,"uid":`)
		if !bytes.HasPrefix(got, want) {
			t.Fatalf("binding changed: %s", got)
		}
		var obj map[string]json.RawMessage
		if err := json.Unmarshal(got, &obj); err != nil {
			t.Fatal(err)
		}
		if len(obj) != 2 || obj["pi_runtime"] != nil {
			t.Fatalf("Pi entered broker binding: %s", got)
		}
	}
}
