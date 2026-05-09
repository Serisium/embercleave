#!/usr/bin/env bash
# Boot the bootc image in a real VM and assert it comes up healthy.
# Uses tmt with the bootc provision plugin: tmt invokes
# bootc-image-builder under the hood to produce a qcow2, then
# virtual.testcloud (libvirt) to boot it and run image/test/tests/boot.
#
# Prereqs (Linux + KVM): tmt, bootc-image-builder, libvirt-daemon, qemu.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BOOTC_IMAGE="${BOOTC_IMAGE_NAME:-localhost/embercleave-bootc:test}"

if ! command -v tmt >/dev/null 2>&1; then
  echo "!!! tmt not found on PATH" >&2
  exit 1
fi

cd "${REPO_ROOT}/image/test"

echo ">>> tmt run -av plan --name /smoke (image=${BOOTC_IMAGE})"
TMT_BOOTC_IMAGE="${BOOTC_IMAGE}" tmt run --all --verbose plan --name /smoke
