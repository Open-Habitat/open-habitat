//go:build linux

package daemon

import (
	"errors"
	"io"
	"regexp"
	"strconv"
	"strings"

	"golang.org/x/sys/unix"
)

// gitRead runs one bounded Git command in the pinned workspace as the user.
type gitRead func(args ...string) ([]byte, error)

// gitStatus is one `git status --porcelain=v2 --branch -z` reading: the
// branch, its upstream with Git's own ahead/behind, and the changed paths. A
// single command gives all three, which keeps the per-snapshot summary cheap.
type gitStatus struct {
	Branch         string
	Detached       bool
	Upstream       string
	Ahead, Behind  *int
	Files          []workspaceGitFile
	DirtyCount     int
	FilesTruncated bool
}

func readGitStatus(read gitRead, keep int) (gitStatus, error) {
	var out gitStatus
	raw, err := read("status", "--porcelain=v2", "--branch", "-z", "--untracked-files=all")
	if err != nil || len(raw) > 1<<20 {
		return out, errors.New("status unavailable")
	}
	records := strings.Split(strings.TrimSuffix(string(raw), "\x00"), "\x00")
	for i := 0; i < len(records); i++ {
		record := records[i]
		if record == "" {
			continue
		}
		var file workspaceGitFile
		switch record[0] {
		case '#':
			key, value, _ := strings.Cut(strings.TrimPrefix(record, "# "), " ")
			switch key {
			case "branch.head":
				// Git says (unknown) when HEAD cannot be read: not a branch name.
				if value == "(detached)" {
					out.Detached = true
				} else if value != "(unknown)" {
					out.Branch = value
				}
			case "branch.upstream":
				out.Upstream = value
			case "branch.ab":
				parts := strings.Fields(value)
				if len(parts) == 2 && strings.HasPrefix(parts[0], "+") && strings.HasPrefix(parts[1], "-") {
					ahead, e1 := strconv.Atoi(parts[0][1:])
					behind, e2 := strconv.Atoi(parts[1][1:])
					if e1 == nil && e2 == nil && ahead >= 0 && behind >= 0 {
						out.Ahead, out.Behind = &ahead, &behind
					}
				}
			}
			continue
		case '1':
			fields := strings.SplitN(record, " ", 9)
			if len(fields) != 9 {
				return out, errors.New("invalid status")
			}
			file = workspaceGitFile{Status: fields[1], Path: fields[8]}
		case '2':
			fields := strings.SplitN(record, " ", 10)
			if len(fields) != 10 || i+1 >= len(records) {
				return out, errors.New("invalid status")
			}
			i++
			file = workspaceGitFile{Status: fields[1], Path: fields[9], PreviousPath: records[i]}
		case 'u':
			fields := strings.SplitN(record, " ", 11)
			if len(fields) != 11 {
				return out, errors.New("invalid status")
			}
			file = workspaceGitFile{Status: fields[1], Path: fields[10]}
		case '?':
			if len(record) < 3 || record[1] != ' ' {
				return out, errors.New("invalid status")
			}
			file = workspaceGitFile{Status: "??", Path: record[2:]}
		default:
			return out, errors.New("invalid status")
		}
		// Version 2 marks an unchanged side with '.', version 1 with a space;
		// the contract keeps the version 1 spelling.
		file.Status = strings.ReplaceAll(file.Status, ".", " ")
		if len(file.Status) != 2 || len(file.Path) > 4096 || len(file.PreviousPath) > 4096 {
			return out, errors.New("oversize status")
		}
		out.DirtyCount++
		if len(out.Files) < keep {
			out.Files = append(out.Files, file)
		} else {
			out.FilesTruncated = true
		}
	}
	if out.Detached {
		short, err := read("rev-parse", "--short", "HEAD")
		if err != nil || len(short) > 256 {
			return out, errors.New("branch unavailable")
		}
		out.Branch = strings.TrimSpace(string(short))
	}
	if out.Branch == "" || len(out.Branch) > 256 || len(out.Upstream) > 256 {
		return out, errors.New("branch unavailable")
	}
	return out, nil
}

// gitBase is the comparison against the branch this work would merge into.
type gitBase struct {
	Name   string `json:"name"`
	Ref    string `json:"ref"`
	Source string `json:"source"`
	Ahead  int    `json:"ahead"`
	Behind int    `json:"behind"`
	Merged bool   `json:"merged"`

	full string
}

var gitBaseName = regexp.MustCompile(`^[A-Za-z0-9_][A-Za-z0-9._/-]{0,199}$`)

func validGitBaseName(name string) bool {
	return gitBaseName.MatchString(name) && !strings.Contains(name, "..") && !strings.Contains(name, "//") && !strings.HasSuffix(name, "/") && !strings.HasSuffix(name, ".lock") && !strings.HasSuffix(name, ".")
}

// readGitBase chooses the base branch from native records only:
//
//  1. the source branch recorded for this branch (`branch.<name>.workmux-base`,
//     written when a worktree is made from another branch);
//  2. otherwise the remote's default branch, `refs/remotes/origin/HEAD`, which
//     `git clone` and (since Git 2.48) `git fetch` set from the remote, so for a
//     GitHub clone it is GitHub's default branch;
//  3. otherwise none: the comparison is left out rather than guessed.
//
// A base that is the branch itself or its own upstream says nothing new and
// is left out too. Merged means every commit of HEAD is in the base (HEAD is
// an ancestor of it); a squash merge is not recognised.
func readGitBase(read gitRead, status gitStatus) *gitBase {
	var base *gitBase
	if !status.Detached {
		if raw, err := read("config", "--get", "branch."+status.Branch+".workmux-base"); err == nil {
			name := strings.TrimSpace(string(raw))
			if validGitBaseName(name) {
				if refs, err := read("for-each-ref", "--format=%(refname)", "refs/heads/"+name, "refs/remotes/"+name); err == nil {
					lines := strings.Split(string(refs), "\n")
					for _, want := range []string{"refs/heads/" + name, "refs/remotes/" + name} {
						for _, line := range lines {
							if line == want && base == nil {
								base = &gitBase{Name: name, Ref: name, Source: "recorded", full: want}
							}
						}
					}
				}
			}
		}
	}
	if base == nil {
		if raw, err := read("symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"); err == nil {
			full := strings.TrimSpace(string(raw))
			name := strings.TrimPrefix(full, "refs/remotes/origin/")
			if name != full && validGitBaseName(name) {
				base = &gitBase{Name: name, Ref: "origin/" + name, Source: "origin_head", full: full}
			}
		}
	}
	if base == nil || base.full == "refs/heads/"+status.Branch && !status.Detached || status.Upstream != "" && base.full == "refs/remotes/"+status.Upstream {
		return nil
	}
	counts, err := read("rev-list", "--left-right", "--count", "HEAD..."+base.full, "--")
	parts := strings.Fields(string(counts))
	if err != nil || len(parts) != 2 {
		return nil
	}
	ahead, e1 := strconv.Atoi(parts[0])
	behind, e2 := strconv.Atoi(parts[1])
	if e1 != nil || e2 != nil || ahead < 0 || behind < 0 {
		return nil
	}
	base.Ahead, base.Behind, base.Merged = ahead, behind, ahead == 0
	return base
}

const gitCommitListLimit = 20

// readGitCommits names at most limit commits of one range, newest first.
func readGitCommits(read gitRead, revisions ...string) ([]workspaceGitCommit, error) {
	args := append([]string{"log", "--max-count=" + strconv.Itoa(gitCommitListLimit), "-z", "--no-show-signature", "--format=%H%x00%s%x00%ct"}, revisions...)
	raw, err := read(append(args, "--")...)
	if err != nil {
		return nil, err
	}
	commits := []workspaceGitCommit{}
	if len(raw) == 0 {
		return commits, nil
	}
	parts := strings.Split(strings.TrimSuffix(string(raw), "\x00"), "\x00")
	if len(parts)%3 != 0 {
		return nil, errors.New("invalid log")
	}
	for i := 0; i < len(parts); i += 3 {
		timestamp, e := strconv.ParseInt(parts[i+2], 10, 64)
		if e != nil || timestamp < 0 || timestamp > 8640000000000 || !workspaceCommitHash.MatchString(parts[i]) || len(parts[i+1]) > 4096 {
			return nil, errors.New("invalid commit")
		}
		commits = append(commits, workspaceGitCommit{Hash: parts[i], Subject: parts[i+1], Timestamp: timestamp})
	}
	return commits, nil
}

// addGitLineCounts adds Git's numstat against HEAD to tracked files and counts
// the lines of untracked regular files through the pinned descriptor. A
// binary file, an unborn HEAD or a file over the bounds keeps no counts.
func addGitLineCounts(read gitRead, fd int, files []workspaceGitFile) {
	if len(files) == 0 {
		return
	}
	if raw, err := read("diff", "--numstat", "-z", "--no-renames", "--no-ext-diff", "--no-textconv", "HEAD", "--"); err == nil && len(raw) <= 1<<20 {
		counts := map[string][2]int{}
		for _, record := range strings.Split(strings.TrimSuffix(string(raw), "\x00"), "\x00") {
			fields := strings.SplitN(record, "\t", 3)
			if len(fields) != 3 {
				continue
			}
			added, e1 := strconv.Atoi(fields[0])
			deleted, e2 := strconv.Atoi(fields[1])
			if e1 == nil && e2 == nil && added >= 0 && deleted >= 0 {
				counts[fields[2]] = [2]int{added, deleted}
			}
		}
		for i := range files {
			if c, ok := counts[files[i].Path]; ok && files[i].Status != "??" {
				files[i].Added, files[i].Deleted = intPtr(c[0]), intPtr(c[1])
			}
		}
	}
	untracked := 0
	for i := range files {
		if files[i].Status != "??" || untracked >= 50 {
			continue
		}
		untracked++
		if lines, ok := countUntrackedLines(fd, files[i].Path); ok {
			files[i].Added, files[i].Deleted = intPtr(lines), intPtr(0)
		}
	}
}

func intPtr(v int) *int { return &v }

func countUntrackedLines(fd int, path string) (int, bool) {
	file, err := open(unix.Openat2, fd, path, unix.O_RDONLY|unix.O_NONBLOCK|unix.O_NOCTTY, true)
	if err != nil {
		return 0, false
	}
	defer unix.Close(file)
	st, err := stat(file)
	if err != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Size > 1<<20 {
		return 0, false
	}
	buf := make([]byte, st.Size+1)
	n, err := io.ReadFull(fdReader(file), buf)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) || n > int(st.Size) {
		return 0, false
	}
	buf = buf[:n]
	lines := 0
	for _, b := range buf {
		if b == 0 {
			return 0, false // binary, as Git's numstat would say
		}
		if b == '\n' {
			lines++
		}
	}
	if n > 0 && buf[n-1] != '\n' {
		lines++
	}
	return lines, true
}

type fdReader int

func (f fdReader) Read(b []byte) (int, error) {
	n, err := unix.Read(int(f), b)
	if n == 0 && err == nil {
		return 0, io.EOF
	}
	if n < 0 {
		n = 0
	}
	return n, err
}
