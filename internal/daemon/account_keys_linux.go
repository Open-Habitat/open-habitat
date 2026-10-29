//go:build linux

package daemon

import (
	"bytes"
	"context"
	"crypto/ecdh"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

const AccountKeysPath = "/api/v1/account/keys"

// The account's own keys: SSH identities in ~/.ssh and the age identities
// SOPS finds by default in ~/.config/sops/age/keys.txt. Only public halves
// and SSH fingerprints leave this file. A public half is always derived from
// the private file, never read from a .pub file or an agent's reply, so
// what the page shows is the key whose private half is on the account.
//
// readAccountKeys and createAccountKey are the small API other daemon
// surfaces (the own-machine connection) reuse; the HTTP handler below is one
// caller.

const (
	keyKindSSH = "ssh"
	keyKindAge = "age"

	defaultSSHKey = "id_ed25519"
	ageKeysFile   = "keys.txt"

	maxKeyFile     = 16384
	maxAgeKeysFile = 65536
	maxSSHEntries  = 512
	maxAccountKeys = 32
	maxAgeKeys     = 16
	maxKeyComment  = 200
)

var (
	errKeyExists          = errors.New("key_exists")
	errKeyToolUnavailable = errors.New("key_tool_unavailable")
)

// accountKey is one public half. Fingerprint is SSH's SHA256 form, the same
// `ssh-keygen -lf` prints; an age recipient has none of its own.
type accountKey struct {
	Kind        string    `json:"kind"`
	File        string    `json:"file"`
	Algorithm   string    `json:"algorithm"`
	PublicKey   string    `json:"public_key"`
	Fingerprint string    `json:"fingerprint,omitempty"`
	Comment     string    `json:"comment,omitempty"`
	ModifiedAt  time.Time `json:"modified_at"`
}

// missingKey is a default key file that does not exist and may be created.
type missingKey struct {
	Kind      string `json:"kind"`
	File      string `json:"file"`
	CanCreate bool   `json:"can_create"`
}

type accountKeys struct {
	Keys    []accountKey `json:"keys"`
	Missing []missingKey `json:"missing"`
}

// keyTools are the native programs that make keys. Tests replace them.
type keyTools struct{ sshKeygen, ageKeygen string }

var systemKeyTools = keyTools{sshKeygen: "/usr/bin/ssh-keygen", ageKeygen: "/usr/bin/age-keygen"}

func (t keyTools) program(kind string) string {
	if kind == keyKindSSH {
		return t.sshKeygen
	}
	return t.ageKeygen
}

func (t keyTools) available(kind string) bool {
	st, err := os.Stat(t.program(kind))
	return err == nil && st.Mode().IsRegular() && st.Mode().Perm()&0111 != 0
}

func defaultKeyFile(kind string) string {
	if kind == keyKindSSH {
		return "~/.ssh/" + defaultSSHKey
	}
	return "~/.config/sops/age/" + ageKeysFile
}

// keyDir opens the directory of kind's keys without following links. A
// creation writes only where personalDir's rules hold (the person's own,
// writable by no one else). A read asks only that each directory is the
// person's own: a group-writable ~/.config under a user-private group must
// not hide the keys, and a key planted there is what the unseen-key mark is
// for.
func keyDir(home string, create bool, kind string) (*os.File, error) {
	parts := []string{".ssh"}
	if kind == keyKindAge {
		parts = []string{".config", "sops", "age"}
	}
	if create {
		return personalDir(home, true, parts...)
	}
	fd, err := unix.Open(home, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, err
	}
	for _, part := range parts {
		next, e := unix.Openat(fd, part, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
		unix.Close(fd)
		if e != nil {
			return nil, e
		}
		fd = next
		var st unix.Stat_t
		if e = unix.Fstat(fd, &st); e != nil || st.Uid != uint32(os.Geteuid()) {
			unix.Close(fd)
			return nil, errors.New("foreign key directory")
		}
	}
	return os.NewFile(uintptr(fd), "keys"), nil
}

func defaultKeyName(kind string) string {
	if kind == keyKindSSH {
		return defaultSSHKey
	}
	return ageKeysFile
}

// readAccountKeys reads the account's keys as the daemon's own UID. A missing
// directory is no keys; an unsafe or unreadable one is an error, never an
// empty list.
func readAccountKeys(home string, tools keyTools) (accountKeys, error) {
	result := accountKeys{Keys: []accountKey{}, Missing: []missingKey{}}
	for _, kind := range []string{keyKindSSH, keyKindAge} {
		dir, err := keyDir(home, false, kind)
		if errors.Is(err, os.ErrNotExist) {
			result.Missing = append(result.Missing, missingKey{Kind: kind, File: defaultKeyFile(kind), CanCreate: tools.available(kind)})
			continue
		}
		if err != nil {
			return result, err
		}
		var keys []accountKey
		if kind == keyKindSSH {
			keys, err = readSSHKeys(dir)
		} else {
			keys, err = readAgeKeys(dir)
		}
		present := true
		if err == nil {
			var st unix.Stat_t
			if e := unix.Fstatat(int(dir.Fd()), defaultKeyName(kind), &st, unix.AT_SYMLINK_NOFOLLOW); errors.Is(e, unix.ENOENT) {
				present = false
			} else if e != nil {
				err = e
			}
		}
		dir.Close()
		if err != nil {
			return result, err
		}
		result.Keys = append(result.Keys, keys...)
		if !present {
			result.Missing = append(result.Missing, missingKey{Kind: kind, File: defaultKeyFile(kind), CanCreate: tools.available(kind)})
		}
	}
	if len(result.Keys) > maxAccountKeys {
		result.Keys = result.Keys[:maxAccountKeys]
	}
	return result, nil
}

// readKeyFile opens one regular file below dir without following a link.
func readKeyFile(dir *os.File, name string, limit int64) ([]byte, time.Time, error) {
	fd, err := unix.Openat(int(dir.Fd()), name, unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, time.Time{}, err
	}
	f := os.NewFile(uintptr(fd), name)
	defer f.Close()
	var st unix.Stat_t
	if err = unix.Fstat(fd, &st); err != nil {
		return nil, time.Time{}, err
	}
	if st.Mode&unix.S_IFMT != unix.S_IFREG || st.Size > limit {
		return nil, time.Time{}, errors.New("not a key file")
	}
	b, err := io.ReadAll(io.LimitReader(f, limit+1))
	if err != nil || int64(len(b)) > limit {
		return nil, time.Time{}, errors.New("not a key file")
	}
	return b, time.Unix(st.Mtim.Unix()).UTC(), nil
}

const opensshPrivateHeader = "-----BEGIN OPENSSH PRIVATE KEY-----"

// readSSHKeys lists the private keys in ~/.ssh: every regular file holding
// a key in OpenSSH's own format that opensshKey can check. A .pub file is
// never read: it may be someone else's key (an administrator's copied in) or
// one replaced beside its private key.
func readSSHKeys(dir *os.File) ([]accountKey, error) {
	entries, err := dir.ReadDir(maxSSHEntries)
	if err != nil && !errors.Is(err, io.EOF) {
		return nil, err
	}
	// ReadDir continues from the offset; rewind so a second read starts over.
	defer dir.Seek(0, io.SeekStart)
	names := []string{}
	for _, e := range entries {
		if e.Type().IsRegular() && !strings.HasPrefix(e.Name(), ".") && !strings.HasSuffix(e.Name(), ".pub") {
			names = append(names, e.Name())
		}
	}
	sort.Slice(names, func(i, j int) bool {
		// The default file first, then by name.
		if (names[i] == defaultSSHKey) != (names[j] == defaultSSHKey) {
			return names[i] == defaultSSHKey
		}
		return names[i] < names[j]
	})
	keys := []accountKey{}
	for _, name := range names {
		if len(keys) == maxAccountKeys {
			break
		}
		b, modified, err := readKeyFile(dir, name, maxKeyFile)
		if err != nil || !bytes.HasPrefix(b, []byte(opensshPrivateHeader)) {
			continue
		}
		blob, algorithm, comment, err := opensshKey(b)
		if err != nil {
			continue
		}
		sum := sha256.Sum256(blob)
		key := accountKey{
			Kind:        keyKindSSH,
			File:        "~/.ssh/" + name,
			Algorithm:   algorithm,
			PublicKey:   algorithm + " " + base64.StdEncoding.EncodeToString(blob),
			Fingerprint: "SHA256:" + base64.RawStdEncoding.EncodeToString(sum[:]),
			Comment:     comment,
			ModifiedAt:  modified,
		}
		if comment != "" {
			key.PublicKey += " " + comment
		}
		keys = append(keys, key)
	}
	return keys, nil
}

// opensshKey reads an unencrypted openssh-key-v1 file and returns its
// public key blob, algorithm and comment. The blob is rebuilt from the
// private section and must equal the public copy in the header, and the
// private part must produce the public one: a file that only wraps someone
// else's public key is not a key of this account. A key with a passphrase
// cannot be checked without it (and the account has no SSH agent to use
// one), so it is left out, as are hardware (sk-) keys.
func opensshKey(file []byte) ([]byte, string, string, error) {
	bad := errors.New("not a verifiable OpenSSH private key")
	block, rest := pem.Decode(file)
	if block == nil || block.Type != "OPENSSH PRIVATE KEY" || len(bytes.TrimSpace(rest)) != 0 {
		return nil, "", "", bad
	}
	data, ok := bytes.CutPrefix(block.Bytes, []byte("openssh-key-v1\x00"))
	if !ok {
		return nil, "", "", bad
	}
	var cipher, kdf, header, private []byte
	if cipher, data, ok = sshString(data); !ok || string(cipher) != "none" {
		return nil, "", "", bad
	}
	if kdf, data, ok = sshString(data); !ok || string(kdf) != "none" {
		return nil, "", "", bad
	}
	if _, data, ok = sshString(data); !ok || len(data) < 4 || binary.BigEndian.Uint32(data) != 1 {
		return nil, "", "", bad
	}
	if header, data, ok = sshString(data[4:]); !ok || len(header) == 0 || len(header) > 4096 {
		return nil, "", "", bad
	}
	if private, data, ok = sshString(data); !ok || len(data) != 0 || len(private) < 8 || binary.BigEndian.Uint32(private) != binary.BigEndian.Uint32(private[4:]) {
		return nil, "", "", bad
	}
	fields := private[8:]
	next := func() []byte {
		if !ok {
			return nil
		}
		var v []byte
		v, fields, ok = sshString(fields)
		return v
	}
	algorithm := string(next())
	var blob []byte
	switch algorithm {
	case "ssh-ed25519":
		pub, priv := next(), next()
		if !ok || len(pub) != ed25519.PublicKeySize || len(priv) != ed25519.PrivateKeySize || !bytes.Equal(priv[32:], pub) ||
			!bytes.Equal(ed25519.NewKeyFromSeed(priv[:32]).Public().(ed25519.PublicKey), pub) {
			return nil, "", "", bad
		}
		blob = sshBlob(algorithm, pub)
	case "ssh-rsa":
		n, e, _, _, p, q := next(), next(), next(), next(), next(), next()
		if !ok || len(n) == 0 || len(n) > 2048 || new(big.Int).Mul(new(big.Int).SetBytes(p), new(big.Int).SetBytes(q)).Cmp(new(big.Int).SetBytes(n)) != 0 || len(p) < 2 || len(q) < 2 {
			return nil, "", "", bad
		}
		blob = sshBlob(algorithm, e, n)
	case "ecdsa-sha2-nistp256", "ecdsa-sha2-nistp384", "ecdsa-sha2-nistp521":
		curve, point, scalar := next(), next(), next()
		c, size := map[string]ecdh.Curve{"nistp256": ecdh.P256(), "nistp384": ecdh.P384(), "nistp521": ecdh.P521()}[string(curve)], map[string]int{"nistp256": 32, "nistp384": 48, "nistp521": 66}[string(curve)]
		scalar = bytes.TrimLeft(scalar, "\x00")
		if !ok || c == nil || "ecdsa-sha2-"+string(curve) != algorithm || len(scalar) > size {
			return nil, "", "", bad
		}
		key, err := c.NewPrivateKey(append(make([]byte, size-len(scalar)), scalar...))
		if err != nil || !bytes.Equal(key.PublicKey().Bytes(), point) {
			return nil, "", "", bad
		}
		blob = sshBlob(algorithm, curve, point)
	default:
		return nil, "", "", bad
	}
	comment := next()
	if !ok || !bytes.Equal(blob, header) {
		return nil, "", "", bad
	}
	// What remains is OpenSSH's padding: 1, 2, 3, ...
	for i, b := range fields {
		if int(b) != i+1 {
			return nil, "", "", bad
		}
	}
	return blob, algorithm, keyCommentText(comment), nil
}

// sshBlob is the wire encoding of a public key: each part as an SSH string.
func sshBlob(algorithm string, parts ...[]byte) []byte {
	out := binary.BigEndian.AppendUint32(nil, uint32(len(algorithm)))
	out = append(out, algorithm...)
	for _, p := range parts {
		out = binary.BigEndian.AppendUint32(out, uint32(len(p)))
		out = append(out, p...)
	}
	return out
}

func sshString(data []byte) ([]byte, []byte, bool) {
	if len(data) < 4 {
		return nil, nil, false
	}
	n := binary.BigEndian.Uint32(data)
	if uint64(n) > uint64(len(data)-4) {
		return nil, nil, false
	}
	return data[4 : 4+n], data[4+n:], true
}

// keyCommentText is a key's comment when it is short printable text, else
// nothing: it is shown to the person and goes into the copied line.
func keyCommentText(b []byte) string {
	comment := strings.TrimSpace(string(b))
	if comment == "" || len(comment) > maxKeyComment || !utf8.ValidString(comment) {
		return ""
	}
	for _, r := range comment {
		if !unicode.IsPrint(r) {
			return ""
		}
	}
	return comment
}

// readAgeKeys derives each native X25519 identity's recipient from keys.txt.
// Plugin identities and lines that are not identities are left out; the
// "# public key:" comment age-keygen writes is never trusted.
func readAgeKeys(dir *os.File) ([]accountKey, error) {
	b, modified, err := readKeyFile(dir, ageKeysFile, maxAgeKeysFile)
	if errors.Is(err, unix.ENOENT) {
		return []accountKey{}, nil
	}
	if err != nil {
		return nil, err
	}
	keys := []accountKey{}
	seen := map[string]bool{}
	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "AGE-SECRET-KEY-1") {
			continue
		}
		recipient, ok := ageRecipient(line)
		if !ok || seen[recipient] {
			continue
		}
		seen[recipient] = true
		keys = append(keys, accountKey{Kind: keyKindAge, File: defaultKeyFile(keyKindAge), Algorithm: "X25519", PublicKey: recipient, ModifiedAt: modified})
		if len(keys) == maxAgeKeys {
			break
		}
	}
	return keys, nil
}

func ageRecipient(identity string) (string, bool) {
	hrp, data, ok := bech32Decode(identity)
	if !ok || hrp != "age-secret-key-" || len(data) != 32 {
		return "", false
	}
	private, err := ecdh.X25519().NewPrivateKey(data)
	if err != nil {
		return "", false
	}
	return bech32Encode("age", private.PublicKey().Bytes()), true
}

// createAccountKey makes the default key of kind with the native tool, as the
// daemon's own UID, and never replaces an existing file: the tool writes into
// a fresh directory beside the target and the result is linked into place,
// which fails if anything (a file, a link, an agent's concurrent write)
// already holds the name.
func createAccountKey(ctx context.Context, home string, tools keyTools, comment, kind string) (accountKey, error) {
	if !tools.available(kind) {
		return accountKey{}, errKeyToolUnavailable
	}
	dir, err := keyDir(home, true, kind)
	if err != nil {
		return accountKey{}, err
	}
	defer dir.Close()
	name := defaultKeyName(kind)
	var st unix.Stat_t
	if e := unix.Fstatat(int(dir.Fd()), name, &st, unix.AT_SYMLINK_NOFOLLOW); e == nil {
		return accountKey{}, errKeyExists
	} else if !errors.Is(e, unix.ENOENT) {
		return accountKey{}, e
	}
	var random [12]byte
	if _, err = rand.Read(random[:]); err != nil {
		return accountKey{}, err
	}
	stage := ".open-habitat-key-" + hex.EncodeToString(random[:])
	if err = unix.Mkdirat(int(dir.Fd()), stage, 0700); err != nil {
		return accountKey{}, err
	}
	defer unix.Unlinkat(int(dir.Fd()), stage, unix.AT_REMOVEDIR)
	// Everything below works in the staging directory through this one
	// descriptor, so renaming or replacing its name changes nothing here.
	stageDir, err := openStage(dir, stage)
	if err != nil {
		return accountKey{}, err
	}
	defer stageDir.Close()
	staged := []string{name}
	if kind == keyKindSSH {
		staged = append(staged, name+".pub")
	}
	defer func() {
		for _, n := range staged {
			_ = unix.Unlinkat(int(stageDir.Fd()), n, 0)
		}
	}()
	// The tool reaches the held directory as its fd 3, so no path is
	// resolved again between the checks above and the write.
	target := "/dev/fd/3/" + name
	args := []string{"-o", target}
	if kind == keyKindSSH {
		args = []string{"-q", "-t", "ed25519", "-N", "", "-C", comment, "-f", target}
	}
	run, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	cmd := exec.CommandContext(run, tools.program(kind), args...)
	cmd.Dir = home
	cmd.Env = []string{"HOME=" + home, "PATH=/usr/bin:/bin", "LANG=C.UTF-8"}
	cmd.Stdin = nil
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	cmd.ExtraFiles = []*os.File{stageDir}
	if err = cmd.Run(); err != nil {
		return accountKey{}, errors.New("key tool failed")
	}
	var made []accountKey
	if kind == keyKindSSH {
		made, err = readSSHKeys(stageDir)
	} else {
		made, err = readAgeKeys(stageDir)
	}
	if err != nil || len(made) != 1 {
		return accountKey{}, errors.New("key tool wrote no key")
	}
	// linkat never replaces: EEXIST means something took the name since
	// the check above, and that file stays as it is.
	if err = unix.Linkat(int(stageDir.Fd()), name, int(dir.Fd()), name, 0); errors.Is(err, unix.EEXIST) {
		return accountKey{}, errKeyExists
	} else if err != nil {
		return accountKey{}, err
	}
	if kind == keyKindSSH {
		// An existing .pub without its private key stays; the page reads
		// the public half from the private file anyway.
		if e := unix.Linkat(int(stageDir.Fd()), name+".pub", int(dir.Fd()), name+".pub", 0); e != nil && !errors.Is(e, unix.EEXIST) {
			_ = dir.Sync()
			return accountKey{}, e
		}
	}
	_ = dir.Sync()
	key := made[0]
	key.File = defaultKeyFile(kind)
	return key, nil
}

func openStage(dir *os.File, stage string) (*os.File, error) {
	fd, err := unix.Openat(int(dir.Fd()), stage, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, err
	}
	return os.NewFile(uintptr(fd), stage), nil
}

// keyComment names the key for the administrator who receives it: the
// account and this site's public host, not the machine's internal name that
// ssh-keygen's default would show.
func keyComment(username string) string {
	host := "open-habitat"
	if site, err := loadSite(siteOriginPath); err == nil {
		if u, e := url.Parse(site.Origin); e == nil && u.Hostname() != "" {
			host = u.Hostname()
		}
	}
	user := username
	if user == "" {
		user = "habitat"
	}
	return user + "@" + host
}

var accountKeysWriter sync.Mutex

func AccountKeysHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return accountKeysHandler(cfg, trusted, systemKeyTools)
}

// AccountKeysHandlerWithFixtureTools runs against a synthetic home with the
// given key programs; the browser host uses it.
func AccountKeysHandlerWithFixtureTools(cfg transport.Config, trusted func(*http.Request) bool, sshKeygen, ageKeygen string) http.Handler {
	return accountKeysHandler(cfg, trusted, keyTools{sshKeygen: sshKeygen, ageKeygen: ageKeygen})
}

func accountKeysHandler(cfg transport.Config, trusted func(*http.Request) bool, tools keyTools) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		post := r.Method == http.MethodPost
		var made accountKey
		if r.URL.Path != AccountKeysPath || r.URL.EscapedPath() != AccountKeysPath || r.URL.RawQuery != "" || len(r.TransferEncoding) != 0 || (!post && r.Method != http.MethodGet) || (!post && r.ContentLength > 0) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if cfg.UID != os.Geteuid() || cfg.Home == "" {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if post {
			if r.ContentLength < 2 || r.ContentLength > 128 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			b, err := io.ReadAll(io.LimitReader(r.Body, 129))
			// Decoded by exact key: encoding/json alone would also take "Kind".
			var in map[string]json.RawMessage
			var kind string
			dec := json.NewDecoder(bytes.NewReader(b))
			if err != nil || int64(len(b)) != r.ContentLength || !catalogNoDuplicates(b) || dec.Decode(&in) != nil || dec.Decode(new(any)) != io.EOF || len(in) != 1 || json.Unmarshal(in["kind"], &kind) != nil || (kind != keyKindSSH && kind != keyKindAge) {
				snapshotError(w, 400, "invalid_request")
				return
			}
			// One creation at a time per person; the link into place is what
			// guarantees nothing is replaced.
			if !accountKeysWriter.TryLock() {
				snapshotError(w, 409, "key_creation_running")
				return
			}
			made, err = createAccountKey(r.Context(), cfg.Home, tools, keyComment(cfg.Username), kind)
			accountKeysWriter.Unlock()
			switch {
			case errors.Is(err, errKeyExists):
				snapshotError(w, 409, "key_exists")
				return
			case errors.Is(err, errKeyToolUnavailable):
				snapshotError(w, 409, "key_tool_unavailable")
				return
			case err != nil:
				snapshotError(w, 503, "key_creation_failed")
				return
			}
		}
		keys, err := readAccountKeys(cfg.Home, tools)
		if err != nil {
			snapshotError(w, 503, "keys_unavailable")
			return
		}
		reply := map[string]any{"schema_version": 1, "web_identity_id": opaque("wid_", cfg.Provider+":"+cfg.Subject), "keys": keys.Keys, "missing": keys.Missing}
		if post {
			// The key this request made, as it made it: the list beside it is
			// read again afterwards and may already hold someone else's key
			// at the same name.
			reply["created"] = made
		}
		historyJSON(w, reply)
	})
}

// bech32 (BIP 173) as age uses it, without the 90-character limit: an age
// identity is longer.
const bech32Charset = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"

func bech32Polymod(values []byte) uint32 {
	gen := [5]uint32{0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3}
	chk := uint32(1)
	for _, v := range values {
		top := chk >> 25
		chk = (chk&0x1ffffff)<<5 ^ uint32(v)
		for i := range 5 {
			if (top>>i)&1 == 1 {
				chk ^= gen[i]
			}
		}
	}
	return chk
}

func bech32HRPExpand(hrp string) []byte {
	out := make([]byte, 0, len(hrp)*2+1)
	for i := range len(hrp) {
		out = append(out, hrp[i]>>5)
	}
	out = append(out, 0)
	for i := range len(hrp) {
		out = append(out, hrp[i]&31)
	}
	return out
}

func convertBits(data []byte, from, to uint, pad bool) ([]byte, bool) {
	acc, bits := uint32(0), uint(0)
	maxv := uint32(1)<<to - 1
	out := []byte{}
	for _, v := range data {
		if uint32(v)>>from != 0 {
			return nil, false
		}
		acc = acc<<from | uint32(v)
		bits += from
		for bits >= to {
			bits -= to
			out = append(out, byte(acc>>bits&maxv))
		}
	}
	if pad {
		if bits > 0 {
			out = append(out, byte(acc<<(to-bits)&maxv))
		}
	} else if bits >= from || acc<<(to-bits)&maxv != 0 {
		return nil, false
	}
	return out, true
}

func bech32Encode(hrp string, data []byte) string {
	values, _ := convertBits(data, 8, 5, true)
	poly := bech32Polymod(append(append(bech32HRPExpand(hrp), values...), 0, 0, 0, 0, 0, 0)) ^ 1
	var b strings.Builder
	b.WriteString(hrp)
	b.WriteByte('1')
	for _, v := range values {
		b.WriteByte(bech32Charset[v])
	}
	for i := range 6 {
		b.WriteByte(bech32Charset[poly>>(5*(5-i))&31])
	}
	return b.String()
}

func bech32Decode(s string) (string, []byte, bool) {
	if len(s) > 1024 || (strings.ToLower(s) != s && strings.ToUpper(s) != s) {
		return "", nil, false
	}
	s = strings.ToLower(s)
	sep := strings.LastIndexByte(s, '1')
	if sep < 1 || sep+7 > len(s) {
		return "", nil, false
	}
	hrp := s[:sep]
	values := make([]byte, 0, len(s)-sep-1)
	for i := sep + 1; i < len(s); i++ {
		v := strings.IndexByte(bech32Charset, s[i])
		if v < 0 {
			return "", nil, false
		}
		values = append(values, byte(v))
	}
	for i := range len(hrp) {
		if hrp[i] < 33 || hrp[i] > 126 {
			return "", nil, false
		}
	}
	if bech32Polymod(append(bech32HRPExpand(hrp), values...)) != 1 {
		return "", nil, false
	}
	data, ok := convertBits(values[:len(values)-6], 5, 8, false)
	return hrp, data, ok
}
