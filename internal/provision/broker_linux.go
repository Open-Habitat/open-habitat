//go:build linux

package provision

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"os"
	"strconv"
	"time"

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
		if stage != "availability_error" && stage != "no_available_binding" && stage != "invalid_executor" && stage != "nss_probe" && stage != "group_probe" && stage != "parent_policy" && stage != "acl_policy" && stage != "path_probe" && stage != "unit_probe" && stage != "quota_not_enforced" && stage != "binding_quota_missing" && stage != "activation_uncertain" {
			return
		}
		log.Warn("broker_guard", "outcome", "rejected", "reason", stage)
	}
	bindings, err := writer.startupBindings(ctx)
	if err != nil {
		return ErrBrokerStartup
	}
	// Activation is outside the ledger lock: the Fleetrepo JIT gate takes a
	// shared lock before systemd starts each socket. A failure for one binding
	// must not prevent the broker serving the others.
	go writer.restoreSockets(ctx, bindings, func(user string, err error) {
		if err == nil {
			log.Info("broker_socket_restore", "outcome", "ready", "user", user)
		} else {
			reason := "activation_unavailable"
			if errors.Is(err, errActivationUncertain) {
				reason = "activation_uncertain"
			}
			log.Warn("broker_socket_restore", "outcome", "rejected", "reason", reason, "user", user)
		}
	}, func(user string, started bool, err error) {
		switch {
		case started:
			log.Info("broker_sync_start", "outcome", "started", "user", user)
		case errors.Is(err, errDaemonStart):
			log.Warn("broker_sync_start", "outcome", "rejected", "reason", "start_failed", "user", user)
		case errors.Is(err, errBootSignalUnsafe):
			log.Warn("broker_sync_start", "outcome", "rejected", "reason", "signal_unsafe", "user", user)
		case err != nil:
			log.Warn("broker_sync_start", "outcome", "rejected", "reason", "signal_unavailable", "user", user)
		}
	})
	if ctx.Err() != nil {
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
	_, err := w.startupBindings(ctx)
	return err
}

// startupBindings returns only identities from a fully verified ledger. It
// never starts units while holding the state lock (the gate needs that lock).
func (w Writer) startupBindings(ctx context.Context) ([]ExecutorIdentity, error) {
	if ctx == nil || !w.valid() {
		return nil, ErrBrokerStartup
	}
	fd, err := lockedDir(ctx, w.Dir, w.owner)
	if err != nil {
		return nil, ErrBrokerStartup
	}
	defer unix.Close(fd)
	defer unix.Flock(fd, unix.LOCK_UN)
	for _, n := range []string{"pending.json", "pending.json.next", "bindings.json.next", "head.json.next"} {
		if !absent(fd, n) {
			return nil, ErrBrokerStartup
		}
	}
	a, l, _, _, err := stateAt(ctx, fd, w.owner)
	if err != nil {
		return nil, ErrBrokerStartup
	}
	hb, err := readAt(fd, "head.json", w.owner)
	var h head
	if err != nil || decode(hb, &h, "version", "epoch", "generation") != nil || h.Version != 1 || h.Epoch == 0 || h.Generation != l.Generation || a.Epoch < h.Epoch {
		return nil, ErrBrokerStartup
	}
	// Empty installations must reject a filesystem with no active user
	// accounting before any first-login operation can create host state.
	if ctx.Err() != nil {
		return nil, ErrBrokerStartup
	}
	if w.QuotaEnabled() != nil {
		if w.GuardEvent != nil {
			w.GuardEvent("quota_not_enforced")
		}
		return nil, ErrBrokerStartup
	}
	if fs, e := w.Capacity(); e != nil || fs.Capacity == 0 || fs.Free > fs.Capacity {
		return nil, ErrBrokerStartup
	}
	bindings := make([]ExecutorIdentity, 0, len(l.Bindings))
	admitted := make(map[string]bool, len(a.IDs))
	for _, entry := range a.IDs {
		admitted[entry.ID] = true
	}
	for _, b := range l.Bindings {
		if ctx.Err() != nil || b.UID < w.UIDMin || b.UID > w.UIDMax || w.Executor.Verify(ctx, ExecutorIdentity{provider: "github", id: b.ID, username: b.Username, uid: b.UID}) != nil {
			return nil, ErrBrokerStartup
		}
		// A binding on a filesystem that lost quota accounting must not be
		// authorized just because its NSS identity and socket still exist.
		q, err := w.Quota.Read(b.UID)
		if err != nil || !validLimit(q.Limit) {
			if w.GuardEvent != nil {
				w.GuardEvent("binding_quota_missing")
			}
			return nil, ErrBrokerStartup
		}
		// Preserve and verify revoked bindings, but never ask the gate to
		// activate one the broker would deny under current admission.
		if w.AdmitAny || admitted[b.ID] {
			bindings = append(bindings, ExecutorIdentity{provider: "github", id: b.ID, username: b.Username, uid: b.UID})
		}
	}
	if ctx.Err() != nil {
		return nil, ErrBrokerStartup
	}
	return bindings, nil
}

// restoreSockets runs off the serving path, but starts units serially: the
// Fleetrepo gate requires every sibling listener to be fully active before it
// will admit another. A definite gate failure does not stop later attempts;
// an uncertain submitted systemd job must stop all further starts. Once a
// person's socket is active, their daemon is started too if they have a
// syncing integration, so sync resumes without waiting for a sign-in; synced
// reports each such check.
func (w Writer) restoreSockets(ctx context.Context, bindings []ExecutorIdentity, report func(string, error), synced func(string, bool, error)) {
	for _, b := range bindings {
		if ctx.Err() != nil {
			return
		}
		activation, cancel := context.WithTimeout(ctx, 90*time.Second)
		err := w.activate(activation, b)
		cancel()
		report(b.username, err)
		if errors.Is(err, errActivationUncertain) {
			return
		}
		if err == nil {
			started, err := w.startSyncing(ctx, b)
			synced(b.username, started, err)
		}
	}
}
