#!/usr/bin/env bash
# Submodules, dependencies of CueFrame, texmorph and the examples, Python tools, large fonts.
set -euo pipefail
cd "$(dirname "$0")/.."
git submodule update --init
pnpm -C cueframe install
pnpm -C texmorph install
pnpm install
uv sync --project cueframe/python
bash scripts/fetch-fonts.sh
