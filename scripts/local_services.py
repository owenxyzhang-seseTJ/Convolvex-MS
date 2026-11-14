"""Start, inspect, or stop this project's two loopback HTTP services.

All state, logs, data and the MCP token stay in the project's runtime directory.
Only recorded processes whose command contains their exact data directory are
eligible for stopping. Nothing is installed as a system or login service.
"""
from pathlib import Path
import argparse
import json
import os
import secrets
import signal
import socket
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / 'runtime'
STATE = RUNTIME / 'services.json'
PYTHON = ROOT / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
PORT_FILE = RUNTIME / 'ports.json'
PORTS = json.loads(PORT_FILE.read_text(encoding='utf-8')) if PORT_FILE.exists() else {}
WEB_PORT = int(PORTS.get('web', 8875 if os.name == 'nt' else 8765))
MCP_PORT = int(PORTS.get('mcp', 8876 if os.name == 'nt' else 8766))
SERVICES = {
    'web': {'port': WEB_PORT, 'data': RUNTIME / 'web-data',
            'args': ['-m', 'convolvex', 'serve', '--host', '127.0.0.1', '--port', str(WEB_PORT), '--data-dir']},
    'mcp': {'port': MCP_PORT, 'data': RUNTIME / 'ms-http',
            'args': ['-m', 'convolvex.mcp_server', '--transport', 'streamable-http',
                     '--host', '127.0.0.1', '--port', str(MCP_PORT), '--workspace']},
}


def listening(port):
    try:
        with socket.create_connection(('127.0.0.1', port), timeout=.3):
            return True
    except OSError:
        return False


def read_state():
    return json.loads(STATE.read_text()) if STATE.exists() else {}


def owns_process(record):
    if os.name == 'nt':
        command = ("[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); "
                   f"(Get-CimInstance Win32_Process -Filter 'ProcessId = {int(record['pid'])}').CommandLine")
        result = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', command],
                                capture_output=True, text=True, encoding='utf-8',
                                creationflags=subprocess.CREATE_NO_WINDOW)
    else:
        result = subprocess.run(['ps', '-p', str(record['pid']), '-o', 'command='],
                                capture_output=True, text=True)
    return result.returncode == 0 and record['data'] in result.stdout and '-m convolvex' in result.stdout


def status():
    state = read_state()
    return {name: {'url': f"http://127.0.0.1:{spec['port']}" + ('/mcp' if name == 'mcp' else ''),
                   'listening': listening(spec['port']),
                   'recorded_pid': state.get(name, {}).get('pid')}
            for name, spec in SERVICES.items()}


def start():
    os.umask(0o077)
    RUNTIME.mkdir(exist_ok=True)
    state = read_state()
    for name, spec in SERVICES.items():
        if listening(spec['port']):
            if name not in state or not owns_process(state[name]):
                raise RuntimeError(f"Port {spec['port']} is occupied by another process; no process was stopped")
    token_path = RUNTIME / 'mcp-token.txt'
    if not token_path.exists():
        with token_path.open('x') as handle:
            handle.write(secrets.token_urlsafe(36))
    token_path.chmod(0o600)
    env = os.environ.copy()
    for key in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'MKL_NUM_THREADS', 'VECLIB_MAXIMUM_THREADS'):
        env[key] = '1'
    env['CONVOLVEX_MCP_TOKEN'] = token_path.read_text().strip()
    # This workbench is bound to loopback; a parent terminal's unrelated token
    # must not silently prevent its bundled web UI from accessing the API.
    env.pop('CONVOLVEX_TOKEN', None)
    started = []
    try:
        for name, spec in SERVICES.items():
            if listening(spec['port']):
                continue
            with (RUNTIME / f'{name}.log').open('ab') as log:
                process = subprocess.Popen([str(PYTHON), *spec['args'], str(spec['data'])],
                    cwd=ROOT, env=env, stdin=subprocess.DEVNULL, stdout=log,
                    stderr=subprocess.STDOUT, start_new_session=os.name != 'nt',
                    creationflags=(subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP)
                                  if os.name == 'nt' else 0)
            started.append(process)
            state[name] = {'pid': process.pid, 'data': str(spec['data'])}
            deadline = time.monotonic() + 15
            while not listening(spec['port']):
                if process.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError(f"{name} failed to start; see {RUNTIME / (name + '.log')}")
                time.sleep(.1)
        STATE.write_text(json.dumps(state, indent=2))
    except BaseException:
        for process in started:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=10)
        raise
    return status()


def stop():
    state = read_state()
    for name, record in state.items():
        if owns_process(record):
            os.kill(record['pid'], signal.SIGTERM)
    deadline = time.monotonic() + 10
    while any(listening(spec['port']) for spec in SERVICES.values()) and time.monotonic() < deadline:
        time.sleep(.1)
    result = status()
    if not any(item['listening'] for item in result.values()):
        STATE.unlink(missing_ok=True)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['start', 'status', 'stop'])
    args = parser.parse_args()
    try:
        print(json.dumps({'start': start, 'status': status, 'stop': stop}[args.action](),
                         ensure_ascii=False, indent=2))
    except (OSError, RuntimeError, ValueError) as exc:
        parser.exit(1, str(exc) + '\n')


if __name__ == '__main__':
    main()
