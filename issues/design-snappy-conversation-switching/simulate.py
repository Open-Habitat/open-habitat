#!/usr/bin/env python3
"""Deterministic sizing model; no network, personal data or third-party modules.

Inputs are documented in measurements.md. Run: python3 issues/design-snappy-conversation-switching/simulate.py
This predicts transport and storage, not measured browser frame times.
"""
import json

# Synthetic wire shape from internal/daemon/events_linux.go; fixed representative IDs.
def frame(kind, payload):
    obj = dict(schema_version=1, event_id='evt_'+'a'*32,
               cursor='ev1:'+'a'*36+':123456', server_instance_id='a'*36,
               sequence=123456, emitted_at='2026-10-02T00:00:00.000000000Z',
               kind=kind, resource={'agent_id':'pi:'+'a'*36}, payload=payload)
    raw = json.dumps(obj, separators=(',', ':')).encode()
    return len(raw)+len(f'id: {obj["cursor"]}\nevent: {kind}\ndata: \n\n'.encode())

DELTA = frame('assistant.delta', {'text':'a'*120,'content_index':0})
ENTRY = frame('history.entry', {'entry_key':'a'*32,'entry_kind':'assistant',
                                'content':{'media_type':'text/plain','text':'a'*2609,'complete':True}})
HEARTBEAT = len(': heartbeat\n\n')
# Pi native JSONL sampled median line size 2,609 B; journal wrapper is additional.
# 50ms coalescing gives <=20 deltas/s/active writer. 120 chars/frame is an
# explicit scenario input, not a measured distribution of streaming output.
WINDOW_ENTRIES = 50
WINDOWS = 5
JS_FACTOR = 3  # scenario multiplier for strings/objects/indexes, not a heap measurement
print('wire frame sizes: delta=%d B entry=%d B heartbeat=%d B' % (DELTA,ENTRY,HEARTBEAT))
print('one-tab SSE connections=1 (A/B/C); D=1 current stream, reopens on each switch')
print('scenario  writers deltas/s settled_entries/s network_KiB/s_per_tab network_MiB/h_per_tab JSON_parses/s fanout_KiB/s_10tabs browser_CPU_ms/s_at_0.1ms_per_event')
for name,writers,dps,eps in [('idle',0,0,0),('typical',1,4,0.1),('heavy',8,20,1.0)]:
    n=writers*(dps+eps)
    rate=(writers*dps*DELTA+writers*eps*ENTRY+HEARTBEAT/20)
    print('%-8s %7d %8.1f %17.1f %24.2f %24.1f %13.1f %21.1f %12.1f' %
          (name,writers,writers*dps,writers*eps,rate/1024,rate*3600/1048576,n,rate*10/1024,n*.1))
print('\noption browser memory MiB browser disk MiB extra_on_open')
for name,windows,disk,extra in [('A: warm LRU',WINDOWS,0,'cold only'),
                                ('B: IndexedDB',WINDOWS,WINDOWS*WINDOW_ENTRIES*2609/1048576,'reload validation'),
                                ('C: all 100 tails',100,0,'all native tails pushed'),
                                ('D: mounted view',1,0,'every switch')]:
    memory=windows*WINDOW_ENTRIES*2609*JS_FACTOR/1048576
    print('%-18s %18.2f %16.2f %s' % (name,memory,disk,extra))
print('C hypothetical extra 100 x 50 settled native entries: %.1f MiB wire' % (100*50*ENTRY/1048576))
print('\noption       idle/typical/heavy SSE connections per tab   per-switch HTTP requests (warm)')
for name, count in [('A',0),('B',0),('C',0),('D',2)]:
    print('%-12s %s                                         %d' % (name,'1 / 1 / 1',count))
print('D controlled warm switch: 2 reads + stream reopen; D read-only switch: 1 read, stream ownership changes.')
print('B and C use the same continuous SSE rate as A, plus one-time persisted writes / pushed tails respectively.')
print('CPU scenario: 0.1 ms parse+dispatch/event; render is ONLY selected virtualized entries, not all background events.')
print('Heap/storage omit deep pages, live tails (bounded 128 KiB/agent), DOM, and object overhead beyond factor; caps needed in implementation.')
