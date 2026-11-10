package provision

import "testing"

func TestCandidateIsGitHubHandleNotLocalAccountName(t *testing.T) {
	for _, name := range []string{"OctoCat", "4example", "A23456789012345678901234567890123456789"} {
		if _, err := EncodeRequest(Request{Version: 1, Operation: "ensure", Provider: "github", ID: "42", Candidate: name}); err != nil {
			t.Fatalf("rejected verified provider handle %q: %v", name, err)
		}
	}
	for _, name := range []string{"", "../root", "a_b", "a b", "ä", "A234567890123456789012345678901234567890"} {
		if _, err := EncodeRequest(Request{Version: 1, Operation: "ensure", Provider: "github", ID: "42", Candidate: name}); err == nil {
			t.Fatalf("accepted invalid provider handle %q", name)
		}
	}
}
