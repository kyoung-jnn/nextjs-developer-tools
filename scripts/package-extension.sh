#!/usr/bin/env bash
# Build the extension and zip it for installation / store upload (docs/design/12-versioning.md §2.3).
# Usage: bash scripts/package-extension.sh  →  artifacts/nextjs-developer-tools-vX.Y.Z.zip

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

version="$(node -p "require('./package.json').version")"
name="nextjs-developer-tools-v${version}.zip"

pnpm --filter @nextjs-devtools/extension build >/dev/null

mkdir -p artifacts
rm -f "artifacts/$name"
# Zip the contents of dist (manifest.json at the zip root), without source maps.
(cd apps/extension/dist && zip -q -r -X "$root/artifacts/$name" . -x '*.map')
echo "artifacts/$name"
