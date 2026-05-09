#!/usr/bin/env bash
# Build the bootc OS image. Depends on a fresh worker tarball at
# image/worker/dist/embercleave-worker.tar; rebuilds it if stale.
#
# Output: localhost/embercleave-bootc:test (or $BOOTC_IMAGE_NAME).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT_DIR="${REPO_ROOT}/image/scripts"
IMAGE_NAME="${BOOTC_IMAGE_NAME:-localhost/embercleave-bootc:test}"
WORKER_TAR="${REPO_ROOT}/image/worker/dist/embercleave-worker.tar"
WORKER_CF="${REPO_ROOT}/image/worker/Containerfile"

# Rebuild worker tarball if missing or older than its Containerfile.
if [[ ! -f "${WORKER_TAR}" || "${WORKER_CF}" -nt "${WORKER_TAR}" ]]; then
  echo ">>> Worker tarball missing or stale; rebuilding"
  "${SCRIPT_DIR}/build-worker.sh"
fi

# Resolve the fedora-bootc digest if not pinned. Override by exporting
# FEDORA_BOOTC_DIGEST=sha256:... before invoking.
if [[ -z "${FEDORA_BOOTC_DIGEST:-}" ]]; then
  echo ">>> Resolving quay.io/fedora/fedora-bootc:latest digest"
  FEDORA_BOOTC_DIGEST="$(podman manifest inspect quay.io/fedora/fedora-bootc:latest \
    | awk -F\" '/"digest":/ {print $4; exit}')"
  if [[ -z "${FEDORA_BOOTC_DIGEST}" ]]; then
    echo "!!! Could not resolve fedora-bootc digest; aborting" >&2
    exit 1
  fi
fi
echo ">>> Using FEDORA_BOOTC_DIGEST=${FEDORA_BOOTC_DIGEST}"

echo ">>> Building ${IMAGE_NAME}"
podman build \
  --tag "${IMAGE_NAME}" \
  --file "${REPO_ROOT}/image/Containerfile" \
  --build-arg "FEDORA_BOOTC_DIGEST=${FEDORA_BOOTC_DIGEST}" \
  "${REPO_ROOT}"

echo ">>> Done"
podman image inspect --format '{{.Id}} {{.Size}}' "${IMAGE_NAME}"
