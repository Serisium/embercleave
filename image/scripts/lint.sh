#!/usr/bin/env bash
# Lint both Containerfiles with hadolint. `bootc container lint` runs
# inside the bootc Containerfile itself as the final RUN, so it's not
# repeated here.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HADOLINT="${HADOLINT:-hadolint}"

if ! command -v "${HADOLINT}" >/dev/null 2>&1; then
  echo "!!! hadolint not found on PATH (set HADOLINT=/path/to/hadolint)" >&2
  exit 1
fi

echo ">>> hadolint image/worker/Containerfile"
"${HADOLINT}" "${REPO_ROOT}/image/worker/Containerfile"

echo ">>> hadolint image/Containerfile"
"${HADOLINT}" "${REPO_ROOT}/image/Containerfile"

echo ">>> OK"
