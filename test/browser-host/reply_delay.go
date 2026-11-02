package main

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Schedule each route independently: unrelated concurrent polls must not consume
// its random sequence. A seed reproduces delays, not the OS/browser scheduler.
func replyDelayFromEnv() func(http.ResponseWriter, *http.Request) bool {
	ms, err := strconv.Atoi(envDefault("OH_REPLY_DELAY_MS", "0"))
	if err != nil || ms < 0 || ms > 60000 {
		panic("OH_REPLY_DELAY_MS must be an integer in 0..60000")
	}
	seed := envDefault("OH_REPLY_SEED", strconv.FormatInt(time.Now().UnixNano(), 10))
	if ms > 0 {
		fmt.Fprintf(os.Stderr, "OH_REPLY_DELAY_MS=%d OH_REPLY_SEED=%s\n", ms, seed)
	}
	var mu sync.Mutex
	counts := map[string]uint64{}
	return func(_ http.ResponseWriter, r *http.Request) bool {
		if ms == 0 || !strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/api/v1/events" {
			return true
		}
		key := r.Method + " " + r.URL.Path
		mu.Lock()
		n := counts[key]
		counts[key]++
		mu.Unlock()
		timer := time.NewTimer(replyDelay(seed, key, n, ms))
		defer timer.Stop()
		select {
		case <-timer.C:
			return true
		case <-r.Context().Done():
			return false
		}
	}
}

func replyDelay(seed, key string, n uint64, ms int) time.Duration {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s\x00%s\x00%d", seed, key, n)))
	return time.Duration(binary.BigEndian.Uint64(sum[:8])%(uint64(ms)+1)) * time.Millisecond
}

func envDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
