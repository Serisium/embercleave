#!/usr/bin/env bash
# Run container-structure-test against the worker and bootc images.
# Both images must already be built (build-worker.sh, build-bootc.sh).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TEST_DIR="${REPO_ROOT}/image/test/structure"
CST="${CONTAINER_STRUCTURE_TEST:-container-structure-test}"
WORKER_IMAGE="${WORKER_IMAGE_NAME:-localhost/embercleave-worker:latest}"
BOOTC_IMAGE="${BOOTC_IMAGE_NAME:-localhost/embercleave-bootc:test}"

if ! command -v "${CST}" >/dev/null 2>&1; then
  echo "!!! container-structure-test not found on PATH (set CONTAINER_STRUCTURE_TEST=...)" >&2
  exit 1
fi

echo ">>> structure: worker"
"${CST}" test --image "${WORKER_IMAGE}" --config "${TEST_DIR}/worker.yaml" --driver podman

echo ">>> structure: bootc"
"${CST}" test --image "${BOOTC_IMAGE}" --config "${TEST_DIR}/bootc.yaml" --driver podman

echo ">>> OK"
