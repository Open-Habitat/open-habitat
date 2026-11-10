//go:build linux

package cli

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/daemon"
)

func TestAgentWorkspaceRequests(t *testing.T) {
	for _, tc := range []struct{ args, path, body string }{
		{"workspace create --name example --user-observation-token obs_example", daemon.AgentWorkspaceOperationsPath, `{"action":"create","name":"example","git":false,"user_observation_token":"obs_example"}`},
		{"workspace update --workspace ws_example123 --hidden true --observation-token obs_example", daemon.AgentWorkspaceOperationsPath, `{"action":"visibility","workspace_id":"ws_example123","hidden":true,"observation_token":"obs_example"}`},
		{"workspace delete --workspace ws_example123 --observation-token obs_example --disposal permanent", daemon.AgentWorkspaceOperationsPath, `{"action":"delete","workspace_id":"ws_example123","observation_token":"obs_example","disposal":"permanent"}`},
		{"worktree delete --workspace ws_example123 --entry branch --observation-token wt_example123 --disposal force --confirmation branch", daemon.AgentWorkspaceOperationsPath, `{"action":"worktree_remove","workspace_id":"ws_example123","entry":"branch","observation_token":"wt_example123","disposal":"force","confirmation":"branch"}`},
		{"worktree delete --merged-only --listing-token listing_example", daemon.AgentWorkspaceOperationsPath, `{"action":"worktree_clean_merged","listing_token":"listing_example"}`},
		{"trash delete --entry example --confirmation example", daemon.AgentWorkspaceOperationsPath, `{"action":"trash_delete","entry":"example","confirmation":"example"}`},
		{"trash delete --all --listing-token listing_example", daemon.AgentWorkspaceOperationsPath, `{"action":"trash_empty","listing_token":"listing_example"}`},
		{"clone create --repository example/project --mode full", daemon.AgentClonesPath, `{"action":"start","full_name":"example/project","mode":"full"}`},
		{"clone restart --repository example/project --mode blobless", daemon.AgentClonesPath, `{"action":"restart","full_name":"example/project","mode":"blobless"}`},
		{"clone stop --job 00000000000000000000000000000001", daemon.AgentClonesPath, `{"action":"cancel","job_id":"00000000000000000000000000000001"}`},
		{"clone delete --repository example/project --interrupted-only", daemon.AgentClonesPath, `{"action":"remove","full_name":"example/project"}`},
	} {
		args := strings.Fields(tc.args)
		req, err := parseWorkspaceRequest(args)
		if err != nil {
			t.Fatalf("%s: %v", tc.args, err)
		}
		var got, want any
		json.Unmarshal(req.body, &got)
		json.Unmarshal([]byte(tc.body), &want)
		g, _ := json.Marshal(got)
		w, _ := json.Marshal(want)
		if req.method != "POST" || req.path != tc.path || !bytes.Equal(g, w) {
			t.Fatalf("%s: %+v %s", tc.args, req, req.body)
		}
		_, err = parseWorkspaceRequest(append(args, "--dry-run"))
		ce, ok := err.(*cliError)
		if !ok || ce.code != "dry_run_unsupported" {
			t.Fatalf("dry-run %s: %v", tc.args, err)
		}
	}
	req, err := parseWorkspaceRequest([]string{"workspace", "update", "--workspace", "ws_example123", "--observation-token", "obs_example", "--display-name", ""})
	if err != nil || !bytes.Contains(req.body, []byte(`"display_name":""`)) {
		t.Fatalf("clear display: %+v %v", req, err)
	}
	for _, command := range []string{
		"workspace create --name ../escape --user-observation-token obs_example",
		"workspace create --name -flag --user-observation-token obs_example",
		"workspace create --name example",
		"workspace update --workspace ws_example123 --hidden true --display-name both --observation-token obs_example",
		"workspace update --workspace ws_example123 --hidden yes --observation-token obs_example",
		"workspace delete --workspace ws_example123 --disposal permanent",
		"workspace delete --workspace ws_example123 --observation-token obs_example --disposal force",
		"workspace show --workspace ws_example123 --uid 0",
		"worktree delete --workspace ws_example123 --entry branch --disposal force --observation-token wt_example",
		"worktree delete --merged-only --listing-token listing_example --entry branch",
		"worktree delete --merged-only",
		"trash delete --entry example",
		"trash delete --all --listing-token listing_example --confirmation example",
		"trash delete --entry ../escape --confirmation escape",
		"trash restore --entry example --entry other",
		"repository show --repository https://token@github.com/example/project",
		"repository show --repository example/..",
		"repository list --output list.json",
		"clone create --repository example/project --mode shallow",
		"clone stop --job clone_guess",
		"clone delete --repository example/project",
		"clone delete --job 00000000000000000000000000000001 --interrupted-only --repository example/project",
		"clone create --repository example/project --mode full --token secret",
	} {
		if _, err := parseWorkspaceRequest(strings.Fields(command)); err == nil {
			t.Fatalf("accepted %s", command)
		}
	}
	for _, spec := range workspaceCommandSpecs {
		if _, err := commandHelp(append([]string{"agent"}, strings.Fields(spec.key)...)); err != nil {
			t.Fatalf("missing help %s: %v", spec.key, err)
		}
	}
}

func TestAgentWorkspaceIncompleteIsNotSuccess(t *testing.T) {
	for _, body := range []string{`{"schema_version":1,"state":"blocked","blockers":[{"kind":"process"}]}`, `{"schema_version":1,"state":"partial","remaining":1}`, `{"schema_version":1,"state":"trashed","kept_reason":"changed_after_check"}`, `{"schema_version":1,"state":"cleaned","removed":1,"kept":[{"entry":"changed"}]}`} {
		err := workspaceOperationError("workspace delete", json.RawMessage(body))
		if err == nil {
			t.Fatal("reported incomplete as success")
		}
		var out bytes.Buffer
		if emitError(err, options{json: true}, &out) != 1 || !bytes.Contains(out.Bytes(), []byte(`"result":`)) {
			t.Fatal("lost partial result", out.String())
		}
	}
	if workspaceOperationError("trash delete", json.RawMessage(`{"state":"emptied","kept":[]}`)) != nil {
		t.Fatal("rejected complete")
	}
}

func TestAgentRepositoryCredentialURLRedacted(t *testing.T) {
	_, err := parseWorkspaceRequest([]string{"repository", "show", "--repository", "https://user:secret@github.com/example/project"})
	if err == nil || strings.Contains(err.Error(), "secret") {
		t.Fatal("credential-bearing URL was not safely rejected")
	}
}

func TestAgentCloneStopPendingIsIncomplete(t *testing.T) {
	for _, body := range []string{`{"schema_version":1,"job":{"state":"running"}}`, `{"schema_version":1,"job":{"state":"cancelled","leftover":"kept"}}`} {
		if workspaceOperationError("clone stop", json.RawMessage(body)) == nil {
			t.Fatal("cancel pending/leftover reported complete", body)
		}
		if workspaceOperationError("clone create", json.RawMessage(body)) != nil {
			t.Fatal("create confused with stop", body)
		}
	}
	if workspaceOperationError("clone stop", json.RawMessage(`{"job":{"state":"cancelled","leftover":"removed"}}`)) != nil {
		t.Fatal("completed cancellation rejected")
	}
}
