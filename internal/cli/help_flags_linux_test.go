//go:build linux

package cli

import (
	"bytes"
	"encoding/json"
	"go/ast"
	"go/parser"
	"go/token"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// The CLI has hand-written, sometimes stateful parsers rather than flag.FlagSets.
// Read their argv-consumption sites without running services or native writes.
// helpFlag shares metadata by name: require every parser's evidence to agree,
// then check every command's rendered and structured help against that evidence.
// Unrecognized flags fail rather than falling back to help's own switch list.
func TestHelpFlagArityMatchesParsers(t *testing.T) {
	arities := parserFlagArities(t)
	for _, spec := range helpSpecs {
		t.Run(spec.path, func(t *testing.T) {
			out, err := commandHelp(strings.Fields(spec.path))
			if err != nil {
				t.Fatal(err)
			}
			rendered := helpText(out)
			data := out.(map[string]any)["data"].(map[string]any)
			for _, raw := range data["flags"].([]any) {
				flag := raw.(map[string]any)
				name := flag["long"].(string)
				// Help/version are dispatched before the command parsers.
				if name == "--help" || name == "--version" {
					continue
				}
				takes, ok := arities[name]
				if !ok {
					t.Errorf("no parser arity evidence for %s", name)
					continue
				}
				if strings.Contains(name, "=") {
					takes = true
				}
				if flag["takes_value"] != takes {
					t.Errorf("%s takes_value=%v, parser=%v", name, flag["takes_value"], takes)
				}
				prefix := "  " + name
				if takes && !strings.Contains(name, "=") {
					prefix += " <"
				} else {
					prefix += "  "
				}
				if !strings.Contains(rendered, "\n"+prefix) {
					t.Errorf("missing flag form %q in help", prefix)
				}
			}
		})
	}
}

func parserFlagArities(t *testing.T) map[string]bool {
	t.Helper()
	result := map[string]bool{}
	origin := ""
	record := func(names []string, takes bool) {
		for _, name := range names {
			if old, ok := result[name]; ok && old != takes {
				t.Fatalf("parser arities disagree for %s: %v and %v in %s", name, old, takes, origin)
			}
			result[name] = takes
		}
	}
	files, err := filepath.Glob("*.go")
	if err != nil {
		t.Fatal(err)
	}
	files = append(files, "../msmcp/command_linux.go")
	for _, path := range files {
		if path == "help.go" || strings.HasSuffix(path, "_test.go") {
			continue
		}
		file, err := parser.ParseFile(token.NewFileSet(), path, nil, 0)
		if err != nil {
			t.Fatal(err)
		}
		for _, decl := range file.Decls {
			fn, ok := decl.(*ast.FuncDecl)
			if !ok {
				continue
			}
			local := map[string]bool{}
			// Fixed-position parsers take a value at the next argv index.
			fixedFlagArities(fn, local)
			common := false
			ast.Inspect(fn, func(n ast.Node) bool {
				if loop, ok := n.(*ast.RangeStmt); ok {
					// Range parsers cannot advance over a following argv token.
					if id, ok := loop.X.(*ast.Ident); ok && id.Name == "args" || nodeSliceName(loop.X) == "args" {
						ast.Inspect(loop.Body, func(n ast.Node) bool {
							if c, ok := n.(*ast.CaseClause); ok {
								for _, name := range flagLiterals(c.List) {
									local[name] = false
								}
							}
							return true
						})
					}
				}
				loop, ok := n.(*ast.ForStmt)
				if !ok {
					return true
				}
				if step, ok := loop.Post.(*ast.AssignStmt); ok && step.Tok == token.ADD_ASSIGN {
					common = true
					return true
				}
				post, ok := loop.Post.(*ast.IncDecStmt)
				if !ok {
					return true
				}
				index, ok := post.X.(*ast.Ident)
				if !ok {
					return true
				}
				// Common parsers consume values after a switch/if of switches; others
				// consume inside each case. Only direct increments count as the common tail.
				commonValue := false
				for _, stmt := range loop.Body.List {
					if incrementsIndex(stmt, index.Name) {
						commonValue = true
					}
				}
				if commonValue {
					common = true
				}
				consumed := false
				for _, stmt := range loop.Body.List {
					if incrementsIndex(stmt, index.Name) {
						consumed = true
					}
					switch s := stmt.(type) {
					case *ast.SwitchStmt:
						for _, raw := range s.Body.List {
							clause := raw.(*ast.CaseClause)
							names := flagLiterals(clause.List)
							if len(names) == 0 {
								if consumesIndex(&ast.BlockStmt{List: clause.Body}, index.Name) {
									common = true
								}
								continue
							}
							body := &ast.BlockStmt{List: clause.Body}
							takes := consumesIndex(body, index.Name)
							if commonValue && !continuesLoop(body) {
								takes = true
							}
							for _, name := range names {
								local[name] = takes
							}
						}
					case *ast.IfStmt:
						names := flagLiterals([]ast.Expr{s.Cond})
						if len(names) > 0 {
							for _, name := range names {
								if _, classified := local[name]; !classified || !consumed {
									local[name] = consumed || consumesIndex(s.Body, index.Name)
								}
							}
							ast.Inspect(s.Body, func(n ast.Node) bool {
								if inner, ok := n.(*ast.IfStmt); ok && continuesLoop(inner.Body) && !consumesIndex(inner.Body, index.Name) {
									for _, name := range flagLiterals([]ast.Expr{inner.Cond}) {
										local[name] = false
									}
								}
								return true
							})
						}
					}
				}
				return true
			})
			if common {
				ast.Inspect(fn, func(n ast.Node) bool {
					lit, ok := n.(*ast.BasicLit)
					if !ok || lit.Kind != token.STRING {
						return true
					}
					s, _ := strconv.Unquote(lit.Value)
					fields := strings.Fields(s)
					for _, field := range fields {
						if !strings.HasPrefix(field, "--") || len(field) <= 2 {
							return true
						}
					}
					for _, name := range fields {
						if _, ok := local[name]; !ok {
							local[name] = true
						}
					}
					return true
				})
				if fn.Name.Name == "parseWorkspaceRequest" {
					for _, spec := range workspaceCommandSpecs {
						for _, name := range strings.Fields(spec.flags) {
							if _, ok := local[name]; !ok {
								local[name] = true
							}
						}
					}
				}
			}
			origin = fn.Name.Name
			for name, takes := range local {
				record([]string{name}, takes)
			}
		}
	}
	return result
}

func nodeSliceName(n ast.Expr) string {
	if s, ok := n.(*ast.SliceExpr); ok {
		if id, ok := s.X.(*ast.Ident); ok {
			return id.Name
		}
	}
	return ""
}

func fixedFlagArities(fn *ast.FuncDecl, result map[string]bool) {
	indexOf := func(expr ast.Expr) (string, int, bool) {
		idx, ok := expr.(*ast.IndexExpr)
		if !ok {
			return "", 0, false
		}
		array, ok := idx.X.(*ast.Ident)
		if !ok || array.Name != "args" {
			return "", 0, false
		}
		lit, ok := idx.Index.(*ast.BasicLit)
		if !ok || lit.Kind != token.INT {
			return "", 0, false
		}
		i, err := strconv.Atoi(lit.Value)
		return array.Name, i, err == nil
	}
	var scan func(ast.Node)
	scan = func(scope ast.Node) {
		ast.Inspect(scope, func(n ast.Node) bool {
			if branch, ok := n.(*ast.IfStmt); ok && n != scope {
				scan(branch)
				return false
			}
			if clause, ok := n.(*ast.CaseClause); ok && n != scope {
				scan(clause)
				return false
			}
			cmp, ok := n.(*ast.BinaryExpr)
			if !ok || cmp.Op != token.EQL && cmp.Op != token.NEQ {
				return true
			}
			_, i, ok := indexOf(cmp.X)
			lit, literal := cmp.Y.(*ast.BasicLit)
			if !ok || !literal || lit.Kind != token.STRING {
				return true
			}
			name, _ := strconv.Unquote(lit.Value)
			if !strings.HasPrefix(name, "--") {
				return true
			}
			takes := false
			valueScope := scope
			if cmp.Op == token.NEQ {
				valueScope = fn
			}
			ast.Inspect(valueScope, func(n ast.Node) bool {
				if expr, ok := n.(ast.Expr); ok {
					if _, next, ok := indexOf(expr); ok && next == i+1 {
						takes = true
					}
				}
				return true
			})
			result[name] = takes
			return true
		})
	}
	scan(fn)
}

func flagLiterals(exprs []ast.Expr) []string {
	var names []string
	for _, expr := range exprs {
		ast.Inspect(expr, func(n ast.Node) bool {
			if comparison, ok := n.(*ast.BinaryExpr); ok && comparison.Op == token.NEQ {
				return false
			}
			if unary, ok := n.(*ast.UnaryExpr); ok && unary.Op == token.NOT {
				return false
			}
			if lit, ok := n.(*ast.BasicLit); ok && lit.Kind == token.STRING {
				s, err := strconv.Unquote(lit.Value)
				if err == nil && strings.HasPrefix(s, "--") && !strings.ContainsAny(s, " \t\n") {
					names = append(names, s)
				}
			}
			return true
		})
	}
	return names
}
func incrementsIndex(n ast.Node, index string) bool {
	inc, ok := n.(*ast.IncDecStmt)
	if !ok {
		return false
	}
	id, ok := inc.X.(*ast.Ident)
	return ok && id.Name == index && inc.Tok == token.INC
}
func consumesIndex(n ast.Node, index string) bool {
	found := false
	ast.Inspect(n, func(n ast.Node) bool {
		if incrementsIndex(n, index) {
			found = true
		}
		return true
	})
	return found
}
func continuesLoop(n ast.Node) bool {
	found := false
	ast.Inspect(n, func(n ast.Node) bool {
		if b, ok := n.(*ast.BranchStmt); ok && b.Tok == token.CONTINUE {
			found = true
		}
		return true
	})
	return found
}

func TestBooleanValueHelp(t *testing.T) {
	for _, tc := range []struct{ path, flag string }{
		{"agent workspace update", "--hidden"},
		{"agent workspace create", "--git"},
		{"agent conversation update", "--archived"},
		{"admin role update", "--administrator"},
	} {
		t.Run(tc.flag, func(t *testing.T) {
			args := append(strings.Fields(tc.path), "--help")
			var stdout, stderr bytes.Buffer
			if code := Run(args, &stdout, &stderr); code != 0 || stderr.Len() != 0 {
				t.Fatalf("help: %d %s", code, &stderr)
			}
			if !strings.Contains(stdout.String(), tc.flag+" <true|false>") {
				t.Fatalf("missing boolean value syntax: %s", &stdout)
			}
			stdout.Reset()
			if code := Run(append(args, "--json"), &stdout, &stderr); code != 0 || stderr.Len() != 0 {
				t.Fatalf("JSON help: %d %s", code, &stderr)
			}
			var help struct {
				Data struct {
					Flags []struct {
						Long       string
						TakesValue bool     `json:"takes_value"`
						Choices    []string `json:"possible_values"`
					}
				}
			}
			if err := json.Unmarshal(stdout.Bytes(), &help); err != nil {
				t.Fatal(err)
			}
			for _, flag := range help.Data.Flags {
				if flag.Long == tc.flag {
					if !flag.TakesValue || strings.Join(flag.Choices, "|") != "true|false" {
						t.Fatalf("incorrect JSON flag: %+v", flag)
					}
					return
				}
			}
			t.Fatal("flag absent from JSON help")
		})
	}
}

func TestExplicitBooleanValuesAndVisibilityExamples(t *testing.T) {
	for _, tc := range []struct {
		args  []string
		flag  string
		parse func([]string) (conversationRequest, error)
	}{
		{[]string{"workspace", "update"}, "--hidden", parseWorkspaceRequest},
		{[]string{"workspace", "create"}, "--git", parseWorkspaceRequest},
		{[]string{"conversation", "update"}, "--archived", parseConversationRequest},
	} {
		for _, suffix := range [][]string{nil, {"--observation-token", "obs_example"}} {
			args := append(append(append([]string{}, tc.args...), tc.flag), suffix...)
			_, err := tc.parse(args)
			if err == nil || !strings.Contains(err.Error(), "missing value for "+tc.flag) {
				t.Errorf("%v: %v", args, err)
			}
		}
	}
	out, err := commandHelp([]string{"agent", "workspace", "update"})
	if err != nil {
		t.Fatal(err)
	}
	data := out.(map[string]any)["data"].(map[string]any)
	seen := map[string]bool{}
	for _, raw := range data["examples"].([]any) {
		argv := raw.(map[string]any)["argv"].([]string)
		for i, a := range argv {
			if a == "--hidden" {
				seen[argv[i+1]] = true
			}
		}
		_, args, err := globals(argv[2:])
		if err != nil {
			t.Fatal(err)
		}
		if _, err := parseWorkspaceRequest(args); err != nil {
			t.Fatalf("example %v: %v", argv, err)
		}
	}
	if !seen["true"] || !seen["false"] {
		t.Fatal("missing hide/unhide examples")
	}
}
