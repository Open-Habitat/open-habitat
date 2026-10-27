#!/usr/bin/env python3
"""Estimate the daemon live tail of every Pi run in native session files.

Reads only metadata: entry types, roles, stop reasons, timestamps and the
UTF-8 JSON byte sizes of text, thinking, tool arguments and results. It prints numbers
only, never conversation content. The estimate replays the daemon's
projection (internal/daemon/pi_events_linux.go, events_linux.go) as of
2026-10-27: per model turn turn_start and turn_end, each thinking/text block
merged into frames of at most 16 KiB, per tool call the streamed argument
delta, toolcall.end (args <= 4 KiB), tool.started (args), the newest
tool.updated for bash (args + result) and tool.finished (args + result),
results capped at 4 KiB. A run is everything from a user prompt to the first
assistant message that does not stop for tool use; user messages inside it
are steering. Usage: measure_runs.py FILE...
"""
import json
import sys

ENVELOPE = 400  # measured envelope of a tail frame with its payload keys
CAP = 4096
FRAME = 16 << 10


def size(value):
    """Bytes the value takes inside a frame: UTF-8 JSON with its escaping."""
    if not isinstance(value, str):
        return len(json.dumps(value, ensure_ascii=False).encode())
    return len(json.dumps(value, ensure_ascii=False).encode()) - 2


def text_frames(n):
    if n == 0:
        return 0, 0
    frames = -(-n // (FRAME - ENVELOPE))
    return frames, n + frames * ENVELOPE


def result_len(msg):
    # The daemon caps the joined raw text at 4096 bytes; escaping comes after.
    text = "\n".join(b.get("text", "") for b in msg.get("content", []) if isinstance(b, dict) and b.get("type") == "text")
    raw = text.encode()[:CAP].decode(errors="ignore")
    return size(raw)


def runs(path):
    run = None
    pending = {}
    for line in open(path, errors="replace"):
        try:
            e = json.loads(line)
        except ValueError:
            continue
        m = e.get("message")
        if e.get("type") != "message" or not isinstance(m, dict):
            continue
        role = m.get("role")
        if role == "user":
            if run is None:
                run = {"frames": 1, "bytes": ENVELOPE, "turns": 0, "tools": 0, "steers": 0}  # agent_start
            else:
                run["steers"] += 1
        elif role == "assistant" and run is not None:
            run["turns"] += 1
            f, b = 2, 2 * ENVELOPE  # turn_start, turn_end
            for block in m.get("content", []):
                if not isinstance(block, dict):
                    continue
                kind = block.get("type")
                if kind in ("thinking", "text"):
                    tf, tb = text_frames(size(block.get(kind, "") or ""))
                    f, b = f + tf, b + tb
                elif kind == "toolCall":
                    run["tools"] += 1
                    args = size(block.get("arguments", {}))
                    tf, tb = text_frames(args)
                    capped = size(json.dumps(block.get("arguments", {}), ensure_ascii=False).encode()[:CAP].decode(errors="ignore"))
                    f, b = f + tf + 2, b + tb + 2 * (ENVELOPE + capped)
                    pending[block.get("id")] = (block.get("name"), capped)
            run["frames"] += f
            run["bytes"] += b
            if m.get("stopReason") != "toolUse":
                yield run
                run = None
        elif role == "toolResult" and run is not None:
            name, capped = pending.pop(m.get("toolCallId"), (m.get("toolName"), 0))
            res = result_len(m)
            n = 2 if name == "bash" else 1  # newest tool.updated + tool.finished
            run["frames"] += n
            run["bytes"] += n * (ENVELOPE + capped + res)
    if run is not None and run["turns"]:
        yield run


all_runs = [r for p in sys.argv[1:] for r in runs(p)]
all_runs.sort(key=lambda r: r["frames"])
if not all_runs:
    sys.exit("no runs")


def pct(key, q):
    vals = sorted(r[key] for r in all_runs)
    return vals[min(len(vals) - 1, int(q * len(vals)))]


print("runs", len(all_runs))
for key in ("tools", "frames", "bytes"):
    print(key, " ".join("p%d=%d" % (q * 100, pct(key, q)) for q in (0.5, 0.9, 0.95, 0.99)), "max=%d" % max(r[key] for r in all_runs))
for limit in (128, 256, 512, 1024, 2048):
    print("frames>%d" % limit, sum(r["frames"] > limit for r in all_runs))
for limit in (128 << 10, 512 << 10, 1 << 20, 2 << 20, 4 << 20):
    print("bytes>%dKiB" % (limit >> 10), sum(r["bytes"] > limit for r in all_runs))
print("largest (tools frames KiB steers):", " | ".join("%d %d %d %d" % (r["tools"], r["frames"], r["bytes"] >> 10, r["steers"]) for r in all_runs[-8:]))
