#!/usr/bin/env bash
# Build linux/amd64 images for AMD servers (safe to run on Apple Silicon via QEMU).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAG="${TAG:-tableai-kind01}"
PLATFORM="${PLATFORM:-linux/amd64}"

cd "$ROOT"

echo "Building API image (${PLATFORM})..."
docker build \
  --platform "$PLATFORM" \
  -f server/Dockerfile \
  -t "${TAG}-api:latest" \
  .

echo "Building web image (${PLATFORM})..."
docker build \
  --platform "$PLATFORM" \
  -f docker/Dockerfile.web \
  -t "${TAG}-web:latest" \
  .

echo "Done."
echo "  ${TAG}-api:latest"
echo "  ${TAG}-web:latest"
echo "Run stack: docker compose up -d"
