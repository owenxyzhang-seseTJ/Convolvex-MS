#!/usr/bin/env python3
"""Copy only explicitly synthetic MS fixtures into a private inbox.

Existing files are never overwritten with different bytes. This helper neither
starts a server nor creates or approves calibration records.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--workspace', required=True, type=Path)
    args = parser.parse_args()
    root = args.workspace.expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    inbox = root / 'inbox'
    if inbox.is_symlink():
        parser.error('inbox must not be a symbolic link')
    inbox.mkdir(parents=True, exist_ok=True, mode=0o700)
    copied = []
    for name in ('synthetic_ms.json', 'background_ms.json'):
        source = ROOT / 'examples' / 'mcp' / name
        data = source.read_bytes()
        if json.loads(data).get('synthetic') is not True:
            raise ValueError(f'Fixture is not explicitly synthetic: {name}')
        dest = inbox / name
        if dest.is_symlink():
            raise ValueError('Refusing symlink destination')
        if dest.exists():
            if dest.read_bytes() != data:
                raise FileExistsError(f'Refusing to replace different data: {dest}')
        else:
            with dest.open('xb') as handle:
                handle.write(data)
            dest.chmod(0o600)
        copied.append(name)
    print(json.dumps({'workspace': str(root), 'synthetic_files': copied,
                      'calibration_created': False}, ensure_ascii=False))


if __name__ == '__main__':
    main()
