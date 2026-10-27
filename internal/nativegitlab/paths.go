package nativegitlab

import (
	"regexp"
	"strings"
)

// A GitLab project's path is its namespace (a user, or a group with up to 19
// subgroups below it, 20 levels in all) and the project's own path:
// group/subgroup/.../project. Paths are the only thing that differs in shape
// from a Gitea owner/name, and every rule that names a repository (the Git
// helper, the clone address, the origin match, the interrupted clone) checks
// them the same way.
const (
	// MaxSegments is the deepest path GitLab allows: 20 namespace levels
	// and the project.
	MaxSegments = 21
	// MaxFullName bounds a whole path. GitLab allows longer ones in theory;
	// a project beyond this is left out of the list as one the adapter
	// cannot describe, never shortened.
	MaxFullName = 1024
)

var pathSegment = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,255}$`)

// ValidSegment is one namespace or project path as GitLab spells it: only
// [A-Za-z0-9_.-], never a dot segment, never GitLab's route separator "-"
// (/-/ starts GitLab's own pages, never a project) and never ending in .git
// or .atom, which GitLab refuses and a clone address would read twice.
func ValidSegment(s string) bool {
	return pathSegment.MatchString(s) && s != "." && s != ".." && s != "-" &&
		!strings.HasSuffix(s, ".git") && !strings.HasSuffix(s, ".atom")
}

// ValidFullName is a project path: two to MaxSegments valid segments.
func ValidFullName(s string) bool {
	if s == "" || len(s) > MaxFullName {
		return false
	}
	segs := strings.Split(s, "/")
	if len(segs) < 2 || len(segs) > MaxSegments {
		return false
	}
	for _, seg := range segs {
		if !ValidSegment(seg) {
			return false
		}
	}
	return true
}

// Name is the project's own path, the last segment: what a clone's
// directory is called.
func Name(fullName string) string { return fullName[strings.LastIndexByte(fullName, '/')+1:] }

// Namespace is everything before the project's own path.
func Namespace(fullName string) string {
	i := strings.LastIndexByte(fullName, '/')
	if i < 0 {
		return ""
	}
	return fullName[:i]
}
