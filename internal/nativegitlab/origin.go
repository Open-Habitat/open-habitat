package nativegitlab

import (
	"strings"

	"github.com/Open-Habitat/open-habitat/internal/nativeforge"
)

// MatchOrigin names the project a clone's origin address points to on one of
// bases: the base and the project path as the address spells them. Only the
// credential-free HTTPS form GitLab's clone URL has matches,
// https://<base>/<group>/.../<project>[.git], with the exact host, port and
// base path. An SSH address, userinfo, a query, an encoded or dotted path,
// or a path that is not a project below a base is no proof of which project
// it is, and is not ok: GitLab's SSH host may differ from its web address,
// and guessing would call another project this one.
func MatchOrigin(origin string, bases []Base) (Base, string, bool) {
	if len(origin) > nativeforge.MaxAddress {
		return Base{}, "", false
	}
	for i := 0; i < len(origin); i++ {
		if c := origin[i]; c <= ' ' || c > '~' || strings.IndexByte(`%\?#@`, c) >= 0 {
			return Base{}, "", false
		}
	}
	i := strings.Index(origin, "://")
	if i < 0 || !strings.EqualFold(origin[:i], "https") {
		return Base{}, "", false
	}
	rest := origin[i+3:]
	authority, path := rest, ""
	if j := strings.IndexByte(rest, '/'); j >= 0 {
		authority, path = rest[:j], rest[j:]
	}
	host, port, ok := nativeforge.ParseAuthority(authority)
	if !ok {
		return Base{}, "", false
	}
	path = strings.TrimSuffix(path, ".git")
	var found Base
	name, matches := "", 0
	for _, b := range bases {
		if b.Host != host || b.Port != port || !strings.HasPrefix(path, b.Path+"/") || (matches > 0 && b == found) {
			continue
		}
		full := path[len(b.Path)+1:]
		if !ValidFullName(full) {
			continue
		}
		found, name, matches = b, full, matches+1
	}
	if matches != 1 {
		return Base{}, "", false
	}
	return found, name, true
}
