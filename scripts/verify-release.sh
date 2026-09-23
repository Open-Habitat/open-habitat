#!/usr/bin/env bash
set -euo pipefail
archive= json=false
while (($#));do case "$1" in --archive)archive=$2;shift 2;;--json)json=true;shift;;*)echo "error: unknown argument $1" >&2;exit 1;;esac;done
[[ -f $archive ]]||{ echo "error: archive '$archive' not found" >&2;exit 1;}; [[ -f $archive.sha256 ]]||{ echo "error: checksum '$archive.sha256' not found" >&2;exit 1;}
archive_dir=$(cd "$(dirname "$archive")"&&pwd); archive_name=$(basename "$archive"); checksum_file="$archive_dir/$archive_name.sha256"
[[ $(wc -l < "$checksum_file") -eq 1 ]]||{ echo 'error: checksum sidecar must contain exactly one entry' >&2;exit 1;}
read -r expected checksum_name extra < "$checksum_file"
[[ $expected =~ ^[0-9a-f]{64}$ && $checksum_name == "$archive_name" && -z ${extra:-} ]]||{ echo "error: checksum sidecar does not name '$archive_name' exactly" >&2;exit 1;}
printf '%s  %s\n' "$expected" "$archive_name" | (cd "$archive_dir";sha256sum -c - >/dev/null)
tmp=$(mktemp -d);trap 'rm -rf "$tmp"' EXIT;tar -xzf "$archive" -C "$tmp";root=$(find "$tmp" -mindepth 1 -maxdepth 1 -type d);[[ -n $root ]]
for p in bin/native-agent-host web/index.html systemd/native-agent-host-gateway.service systemd/native-agent-host-daemon@.service systemd/native-agent-host-daemon@.socket MANIFEST.sha256 licenses/DEPENDENCIES.md;do [[ -f "$root/$p" ]]||{ echo "error: package missing $p" >&2;exit 1;};done
(cd "$root";sha256sum -c MANIFEST.sha256 >/dev/null)
version=$($root/bin/native-agent-host --json version);python3 -c 'import json,sys;x=json.load(sys.stdin);assert x["data"]["commit"] and len(x["data"]["commit"])==40'<<<"$version"
sha=$(sha256sum "$archive"|cut -d' ' -f1);if $json;then printf '{"schema_version":1,"data":{"status":"verified","archive":"%s","sha256":"%s"},"warnings":[]}\n' "$archive" "$sha";else echo "verified $archive $sha";fi
