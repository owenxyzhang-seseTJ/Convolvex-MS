#!/bin/zsh
set -eu
cd -- "$(dirname -- "$0")"
exec .venv/bin/python scripts/local_services.py start
