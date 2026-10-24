#!/usr/bin/env bash
set -euo pipefail

if command -v slither >/dev/null 2>&1; then
  slither . --config-file slither.config.json
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  printf '%s\n' 'Slither is not installed and Docker is unavailable; install Slither or Docker to run static analysis.' >&2
  exit 127
fi

docker run --rm \
  -v "$PWD:/src" \
  ghcr.io/crytic/slither:latest \
  slither /src/contracts \
  --config-file /src/slither.config.json \
  --solc-remaps "@openzeppelin/contracts=/src/node_modules/@openzeppelin/contracts" \
  --solc-args "--via-ir --optimize"
