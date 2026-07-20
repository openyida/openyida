#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -z "${npm_config_cache:-}" ]; then
  npm_config_cache="$(mktemp -d "${TMPDIR:-/tmp}/openyida-npm-cache-XXXXXX")"
  export npm_config_cache
  trap 'rm -rf "$npm_config_cache"' EXIT
fi

echo "=== Step 1: Install dependencies ==="
npm ci --ignore-scripts

echo ""
echo "=== Step 2: Validate project structure ==="
npm run check:structure

echo ""
echo "=== Step 3: Build Wukong skills package ==="
npm run build:skills

echo ""
echo "=== Step 4: Validate skills ==="
npm run check:skills

echo ""
echo "=== Step 5: Validate command manifest ==="
npm run check:commands

echo ""
echo "=== Step 6: Validate generated command docs ==="
npm run check:docs

echo ""
echo "=== Step 7: Validate i18n locale parity (ratchet) ==="
npm run check:i18n

echo ""
echo "=== Step 8: Check JavaScript syntax ==="
npm run check:syntax

echo ""
echo "=== Step 9: Run lint ==="
npm run lint

echo ""
echo "=== Step 10: Scan cross-platform release risks ==="
npm run check:release-risks

echo ""
echo "=== Step 11: Run tests ==="
npm run test:unit -- --runInBand

echo ""
echo "=== Step 12: Validate npm package size budget ==="
npm run check:package-size

echo ""
echo "=== Step 13: Validate npm package contents ==="
npm run check:package

echo ""
echo "=== All checks passed! ==="
