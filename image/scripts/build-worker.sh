#!/usr/bin/env bash
# Build the runtime container and save it as a tarball for embedding in the
# bootc image. Idempotent; re-running rebuilds and overwrites.
#
# Output: image/worker/dist/embercleave-worker.tar (consumed by the
# bootc Containerfile's COPY + podman load).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IMAGE_NAME="${WORKER_IMAGE_NAME:-localhost/embercleave-worker:latest}"
OUT_DIR="${REPO_ROOT}/image/worker/dist"
OUT_FILE="${OUT_DIR}/embercleave-worker.tar"

mkdir -p "${OUT_DIR}"

echo ">>> Building ${IMAGE_NAME}"
podman build \
  --tag "${IMAGE_NAME}" \
  --file "${REPO_ROOT}/image/worker/Containerfile" \
  "${REPO_ROOT}/image/worker"

echo ">>> Saving to ${OUT_FILE}"
podman save --format oci-archive --output "${OUT_FILE}" "${IMAGE_NAME}"

echo ">>> Done: $(du -h "${OUT_FILE}" | awk '{print $1}')"
