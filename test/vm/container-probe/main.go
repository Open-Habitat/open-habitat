// A synthetic, static guest image entrypoint. No shell, network fetch or secrets.
package main

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
)

func main() {
	if err := os.WriteFile("/data/owned", []byte("synthetic\n"), 0600); err != nil {
		panic(err)
	}
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		memory, err := os.ReadFile("/sys/fs/cgroup/memory.max")
		if err != nil {
			memory = []byte("unavailable")
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"uid": os.Getuid(), "memory_max": strings.TrimSpace(string(memory))})
	})
	if err := http.ListenAndServe(":8080", nil); err != nil {
		panic(err)
	}
}
