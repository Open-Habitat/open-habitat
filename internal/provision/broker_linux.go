//go:build linux

package provision

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"os"
	"strconv"

	"golang.org/x/sys/unix"

	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
)

// BrokerSocket is the only production listener. Fleetrepo owns its directory,
// socket ACL, root state, UID reservation and boot ordering; this code never
// creates or repairs them.
const BrokerSocket = "/run/open-habitat/broker.sock"
const brokerState = "/var/lib/open-habitat/broker"

var ErrBrokerStartup = errors.New("broker startup refused")

type brokerConfig struct {
	Version    int    `json:"version"`
	GatewayUID uint32 `json:"gateway_uid"`
	GatewayGID uint32 `json:"gateway_gid"`
	UIDMin     uint32 `json:"uid_min"`
	UIDMax     uint32 `json:"uid_max"`
	StateDir   string `json:"state_dir"`
	Admission  string `json:"admission,omitempty"`
}

// loadBrokerConfig accepts an exact root-owned private configuration file in
// the root-only state directory (not the daemon-readable /etc config directory).
// Its UID range is an operator declaration, not a built-in guess at the pool.
func loadBrokerConfig() (brokerConfig, error) {
	b, err := secureFile(brokerState, "broker.json", 0)
	if err != nil {
		return brokerConfig{}, ErrBrokerStartup
	}
	return parseBrokerConfig(b)
}

func parseBrokerConfig(b []byte) (brokerConfig, error) {
	var cfg brokerConfig
	if _, err := object(b, "version", "gateway_uid", "gateway_gid", "uid_min", "uid_max", "state_dir", "admission"); err != nil {
		return cfg, ErrBrokerStartup
	}
	if json.Unmarshal(b, &cfg) != nil || cfg.Version != 1 ||
		cfg.GatewayUID < 1000 || cfg.GatewayGID < 1000 || cfg.UIDMin < 1000 ||
		cfg.UIDMax > 60000 || cfg.UIDMax < cfg.UIDMin || cfg.UIDMax-cfg.UIDMin > 4095 ||
		cfg.GatewayUID >= cfg.UIDMin && cfg.GatewayUID <= cfg.UIDMax ||
		cfg.GatewayGID >= cfg.UIDMin && cfg.GatewayGID <= cfg.UIDMax ||
		cfg.StateDir != brokerState || (cfg.Admission != "" && cfg.Admission != "allowlist" && cfg.Admission != "any") {
		return cfg, ErrBrokerStartup
	}
	return cfg, nil
}

// Require a single systemd-named inherited descriptor. Explicitly reject
// manually passed FDs, extra descriptors and unrelated socket-activation roles.
func brokerFD() (*os.File, error) {
	pid, e1 := strconv.Atoi(os.Getenv("LISTEN_PID"))
	count, e2 := strconv.Atoi(os.Getenv("LISTEN_FDS"))
	if e1 != nil || e2 != nil || pid != os.Getpid() || count != 1 || os.Getenv("LISTEN_FDNAMES") != "broker" {
		return nil, ErrBrokerStartup
	}
	return os.NewFile(3, "broker-listener"), nil
}

// The socket inode and its ancestors are checked before Serve; systemd's
// DirectoryMode fallback is not an authorization or boot-time ACL recipe.
func brokerSocketSafe(gid uint32) bool {
	for _, p := range []string{"/run", "/run/open-habitat"} {
		var st unix.Stat_t
		if unix.Lstat(p, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFDIR || st.Uid != 0 || st.Mode&0022 != 0 {
			return false
		}
		if p == "/run/open-habitat" && (st.Gid != gid || st.Mode&07777 != 0750) {
			return false
		}
	}
	var st unix.Stat_t
	return unix.Lstat(BrokerSocket, &st) == nil && st.Mode&unix.S_IFMT == unix.S_IFSOCK && st.Uid == 0 && st.Gid == gid && st.Mode&07777 == 0660
}

// ServeBroker refuses non-root invocation and all missing/drifted state before
// accepting requests. The transport passes its bounded per-exchange context
// directly into Writer.Handle; neither Store.Evaluate nor a fixture listener is
// reachable here. There is no HTTP, token or network path in this role.
func ServeBroker(ctx context.Context) error {
	if os.Geteuid() != 0 || ctx == nil {
		return ErrBrokerStartup
	}
	cfg, err := loadBrokerConfig()
	if err != nil || !brokerSocketSafe(cfg.GatewayGID) {
		return ErrBrokerStartup
	}
	fd, err := brokerFD()
	if err != nil {
		return err
	}
	defer fd.Close()
	// Refuse unsafe state, including pending writes, rollback, NSS/ACL/unit
	// drift, even when there are no incoming clients. Restart is not repair.
	writer := NewWriter(cfg.StateDir, cfg.UIDMin, cfg.UIDMax, NewLinuxHostExecutor(cfg.GatewayUID, cfg.GatewayGID))
	writer.AdmitAny = cfg.Admission == "any"
	log := diagnostic.New(os.Stderr, "broker")
	writer.Published = func(user string) {
		log.Info("binding_published", "outcome", "published", "operation", "ensure", "user", user)
	}
	writer.GuardEvent = func(stage string) {
		// Writer supplies fixed literals only. Never log request, candidate,
		// UID, route, path, command output or raw host errors.
		if stage != "availability_error" && stage != "no_available_binding" && stage != "invalid_executor" && stage != "nss_probe" && stage != "group_probe" && stage != "parent_policy" && stage != "acl_policy" && stage != "path_probe" && stage != "unit_probe" {
			return
		}
		log.Warn("broker_guard", "outcome", "rejected", "reason", stage)
	}
	if writer.Startup(ctx) != nil {
		return ErrBrokerStartup
	}
	log.Info("service_ready", "outcome", "ready")
	return (Server{GatewayUID: cfg.GatewayUID, SocketPath: BrokerSocket, Handler: loggedBrokerHandler(writer.Handle, log)}).Serve(ctx, []*os.File{fd})
}

func loggedBrokerHandler(handle Handler, log *slog.Logger) Handler {
	return func(ctx context.Context, r Request) Reply {
		reply := handle(ctx, r)
		// Only the broker-verified route supplies a user. A denied request
		// does not establish the caller's claimed identity.
		switch {
		case reply.Failure != "":
			log.Warn("broker_exchange", "outcome", "rejected", "operation", r.Operation, "reason", string(reply.Failure))
		case reply.Route != nil:
			log.Info("broker_exchange", "outcome", "accepted", "operation", r.Operation, "user", reply.Route.Username)
		case reply.Quota != nil:
			log.Info("broker_exchange", "outcome", "accepted", "operation", r.Operation)
		case reply.Users != nil:
			// list and lookup return Users, not a route; even an empty list
			// is successful. Do not attribute a request ID as a verified user.
			log.Info("broker_exchange", "outcome", "accepted", "operation", r.Operation)
		default:
			log.Warn("broker_exchange", "outcome", "rejected", "operation", r.Operation, "reason", "invalid_reply")
		}
		return reply
	}
}

// Startup inspects every committed binding, not only the identity requested by
// the first caller. A corrupt ledger or one drifted account blocks the service.
func (w Writer) Startup(ctx context.Context) error {
	if ctx == nil || !w.valid() {
		return ErrBrokerStartup
	}
	fd, err := lockedDir(ctx, w.Dir, w.owner)
	if err != nil {
		return ErrBrokerStartup
	}
	defer unix.Close(fd)
	defer unix.Flock(fd, unix.LOCK_UN)
	for _, n := range []string{"pending.json", "pending.json.next", "bindings.json.next", "head.json.next"} {
		if !absent(fd, n) {
			return ErrBrokerStartup
		}
	}
	a, l, _, _, err := stateAt(ctx, fd, w.owner)
	if err != nil {
		return ErrBrokerStartup
	}
	hb, err := readAt(fd, "head.json", w.owner)
	var h head
	if err != nil || decode(hb, &h, "version", "epoch", "generation") != nil || h.Version != 1 || h.Epoch == 0 || h.Generation != l.Generation || a.Epoch < h.Epoch {
		return ErrBrokerStartup
	}
	for _, b := range l.Bindings {
		if ctx.Err() != nil || b.UID < w.UIDMin || b.UID > w.UIDMax || w.Executor.Verify(ctx, ExecutorIdentity{provider: "github", id: b.ID, username: b.Username, uid: b.UID}) != nil {
			return ErrBrokerStartup
		}
		// A binding on a filesystem that lost quota accounting must not be
		// authorized just because its NSS identity and socket still exist.
		q, err := w.Quota.Read(b.UID)
		if err != nil || !validLimit(q.Limit) {
			return ErrBrokerStartup
		}
	}
	if ctx.Err() != nil {
		return ErrBrokerStartup
	}
	return nil
}
