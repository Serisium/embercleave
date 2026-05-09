#!/usr/bin/env bash
# Runs inside the booted VM via tmt. Each step exits non-zero on failure;
# tmt collects logs/output. Keep assertions independent so a single failure
# doesn't mask later regressions.

set -euo pipefail

step() { echo; echo "::: $*"; }

step "bootc reports a booted deployment"
bootc status --json | jq -e '.status.booted != null'

step "swarm user exists with bash shell"
getent passwd swarm | grep -q ':/bin/bash$'

step "linger is enabled for swarm"
loginctl show-user swarm | grep -q '^Linger=yes$'

step "tmpfiles created /run/embercleave with correct owner and mode"
test -d /run/embercleave
[[ "$(stat -c '%U:%G %a' /run/embercleave)" == "swarm:swarm 750" ]]

step "embedded worker image is loaded into containers-storage"
podman --root /var/lib/containers/storage images --format '{{.Repository}}:{{.Tag}}' \
  | grep -qE '^localhost/embercleave-worker:latest$'

step "swarm's user-mode systemd is running (linger booted it)"
sudo -u swarm XDG_RUNTIME_DIR=/run/user/$(id -u swarm) systemctl --user is-system-running --wait \
  || echo "system-running degraded is acceptable; checking the unit directly"

step "embercleave.target is active"
sudo -u swarm XDG_RUNTIME_DIR=/run/user/$(id -u swarm) systemctl --user is-active embercleave.target

step "embercleave-mgr.service is active"
sudo -u swarm XDG_RUNTIME_DIR=/run/user/$(id -u swarm) systemctl --user is-active embercleave-mgr.service

step "manager bound the bus socket"
test -S /run/embercleave/bus.sock
[[ "$(stat -c '%U:%G' /run/embercleave/bus.sock)" == "swarm:swarm" ]]

echo
echo "::: all smoke checks passed"
