//go:build linux

package daemon

import (
	"go/ast"
	"go/parser"
	"go/token"
	"strconv"
	"strings"
	"testing"
)

// This is a documentation contract, not a source-shape assertion about runtime
// behavior. Removing a service advertised to the agent must prompt a guide
// review. Native provider tests separately prove the guide reaches the model;
// the service suites prove behavior. Route names and handler refactors remain
// free to change together with this small contract.
func TestHostContextCapabilitiesHaveRoutes(t *testing.T) {
	// Worktrees and Trash share the workspace route. Keep their advertised
	// operations tied to the actual dispatcher, not just the shared mount.
	for _, action := range []string{"worktree_list", "worktree_remove"} {
		if !worktreeAction(action) {
			t.Fatalf("advertised worktree operation %s disappeared", action)
		}
	}
	for _, action := range []string{"delete", "trash_list", "trash_restore", "trash_delete"} {
		if !deletionAction(action) {
			t.Fatalf("advertised Trash operation %s disappeared", action)
		}
	}
	for _, tc := range []struct {
		section, file, route string
	}{
		{"Workspaces", "handoff_linux.go", "WorkspacePath"},
		{"Workspaces", "handoff_linux.go", "RepoClonesPath"},
		{"Conversations", "handoff_linux.go", "/api/v1/conversations"},
		{"Conversations", "handoff_linux.go", "/api/v1/agents/"},
		{"Worktree agents", "handoff_linux.go", "WorkspacePath"},
		{"Editor and shell", "handoff_linux.go", "EditorStartPath"},
		{"Editor and shell", "handoff_linux.go", "TerminalsPath"},
		{"Integrations", "handoff_linux.go", "integrations.ListPath"},
		{"Trash and storage", "handoff_linux.go", "WorkspacePath"},
		{"Trash and storage", "../gateway/server.go", "/api/v1/account/storage"},
	} {
		t.Run(tc.section+"/"+tc.route, func(t *testing.T) {
			if !strings.Contains(hostContext, "## "+tc.section+"\n") {
				t.Fatal("guide section missing; review the advertised capabilities")
			}
			file, err := parser.ParseFile(token.NewFileSet(), tc.file, nil, 0)
			if err != nil {
				t.Fatal(err)
			}
			mounted := false
			ast.Inspect(file, func(node ast.Node) bool {
				call, ok := node.(*ast.CallExpr)
				if !ok || len(call.Args) < 2 {
					return true
				}
				method, ok := call.Fun.(*ast.SelectorExpr)
				if !ok || (method.Sel.Name != "Handle" && method.Sel.Name != "HandleFunc") {
					return true
				}
				if routeName(call.Args[0]) == tc.route {
					mounted = true
				}
				return true
			})
			// Editor and integration registrations use a range over a route
			// slice. Match only a slice whose value is actually mounted.
			ast.Inspect(file, func(node ast.Node) bool {
				loop, ok := node.(*ast.RangeStmt)
				if !ok || loop.Value == nil {
					return true
				}
				paths, ok := loop.X.(*ast.CompositeLit)
				if !ok {
					return true
				}
				contains := false
				for _, path := range paths.Elts {
					contains = contains || routeName(path) == tc.route
				}
				if contains {
					ast.Inspect(loop.Body, func(node ast.Node) bool {
						call, ok := node.(*ast.CallExpr)
						if ok && len(call.Args) >= 2 {
							method, ok := call.Fun.(*ast.SelectorExpr)
							if ok && method.Sel.Name == "Handle" && routeName(call.Args[0]) == routeName(loop.Value) {
								mounted = true
							}
						}
						return true
					})
				}
				return true
			})
			if !mounted {
				t.Fatalf("advertised %s route %s disappeared; update the host guide", tc.section, tc.route)
			}
		})
	}
}

func routeName(expr ast.Expr) string {
	switch e := expr.(type) {
	case *ast.Ident:
		return e.Name
	case *ast.SelectorExpr:
		return routeName(e.X) + "." + e.Sel.Name
	case *ast.BasicLit:
		value, _ := strconv.Unquote(e.Value)
		return value
	}
	return ""
}
