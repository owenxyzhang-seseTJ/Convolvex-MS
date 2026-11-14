#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
python3 -m venv .venv
.venv/bin/python scripts/build_native.py
if [[ "${1:-}" == '--cuda' ]]; then
    .venv/bin/python -m pip install -c requirements-tested.txt '.[test,gpu]' 'mcp==1.26.0' \
        nvidia-cuda-runtime-cu12 nvidia-cuda-nvrtc-cu12 nvidia-cufft-cu12 nvidia-nvjitlink-cu12 nvidia-cublas-cu12
else
    .venv/bin/python -m pip install -c requirements-tested.txt '.[test]' 'mcp==1.26.0'
fi
.venv/bin/python scripts/validate_deployment.py --output-dir validation_wsl
