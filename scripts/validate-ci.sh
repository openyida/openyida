#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== Step 1: Install dependencies ==="
npm ci --ignore-scripts

echo ""
echo "=== Step 2: Validate project structure ==="
npm run check:structure

echo ""
echo "=== Step 3: Check JavaScript syntax ==="
npm run check:syntax

echo ""
echo "=== Step 4: Run lint ==="
npm run lint

echo ""
echo "=== Step 5: Run tests ==="
npm run test:unit -- --runInBand

echo ""
echo "=== Step 6: Validate npm package contents ==="
npm run check:package

echo ""
echo "=== All checks passed! ==="
