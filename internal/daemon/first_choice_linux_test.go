//go:build linux

package daemon

import (
	"context"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/transport"
)

func TestFirstChoiceCannotSwitchUsedOrWorkingConversation(t *testing.T) {
	for _, mode := range []string{"working", "used", "previously-rejected", "question"} {
		t.Run(mode, func(t *testing.T) {
			id := "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
			s := &conversation{id: id, state: "idle", commands: map[string]bool{}, rpc: &piRPC{}}
			switch mode {
			case "working":
				s.state = "accepted"
			case "used":
				s.acceptedMessages = 1
			case "previously-rejected":
				s.commands[id] = true
			case "question":
				s.questionID = "q"
			}
			c := &ConversationController{fixture: true, cfg: transport.Config{UID: os.Geteuid()}, sessions: map[string]*conversation{id: s}}
			req := httptest.NewRequest("POST", "http://unix/api/v1/conversations/"+id+"/send", strings.NewReader(`{"message":"do not send","command_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","first_choice":{"model":"gpt-6-nova","thinking":"high"}}`))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			c.send(w, req, id)
			if w.Code != 409 {
				t.Fatalf("got %d %s", w.Code, w.Body.String())
			}
		})
	}
}
func TestFirstChoiceRejectsInvalidNativeSelection(t *testing.T) {
	c := &ConversationController{fixture: true}
	for _, choice := range []piStartupChoice{{Model: ""}, {Model: "model", Thinking: "invented"}, {Provider: "other", Model: "model", Thinking: "high"}} {
		if c.validFirstChoice(context.Background(), &choice) {
			t.Fatalf("accepted %+v", choice)
		}
	}
}
