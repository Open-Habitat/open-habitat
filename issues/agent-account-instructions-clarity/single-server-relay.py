#!/usr/bin/env python3
"""Disposable experiment only: stdio to an already-running Unix MCP socket."""
import socket
import sys
import threading

s = socket.socket(socket.AF_UNIX)
s.connect(sys.argv[1])

def upload():
    for line in sys.stdin.buffer:
        s.sendall(line)
    s.shutdown(socket.SHUT_WR)

threading.Thread(target=upload, daemon=True).start()
while data := s.recv(65536):
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()
