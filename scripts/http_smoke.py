#!/usr/bin/env python3
"""Exercise the actual loopback MCP HTTP process, without an external network."""
from pathlib import Path
import json, os, secrets, socket, subprocess, sys, tempfile, time
import httpx

ROOT = Path(__file__).resolve().parents[1]


def main():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    token = secrets.token_urlsafe(36)
    env = os.environ.copy()
    env['CONVOLVEX_MCP_TOKEN'] = token
    checks = {}
    with tempfile.TemporaryDirectory(prefix='convolvex-http-') as work:
        process = subprocess.Popen([sys.executable, '-u', '-m', 'convolvex.mcp_server',
            '--workspace', work, '--transport', 'streamable-http', '--port', str(port)],
            env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            url = f'http://127.0.0.1:{port}/mcp'
            with httpx.Client(timeout=10, trust_env=False) as client:
                for _ in range(150):
                    if process.poll() is not None:
                        raise RuntimeError(process.stderr.read())
                    try:
                        response = client.post(url, json={})
                        break
                    except httpx.ConnectError:
                        time.sleep(.05)
                else:
                    raise TimeoutError('MCP HTTP startup timed out')
                checks['missing_token_status'] = response.status_code
                assert response.status_code == 401
                metadata = {'io.modelcontextprotocol/protocolVersion':'2026-07-28',
                            'io.modelcontextprotocol/clientCapabilities':{}}
                headers = {'Authorization':'Bearer '+token,
                           'Accept':'application/json, text/event-stream',
                           'MCP-Protocol-Version':'2026-07-28',
                           'Mcp-Method':'server/discover'}
                response = client.post(url, headers=headers, json={'jsonrpc':'2.0','id':1,
                    'method':'server/discover','params':{'_meta':metadata}})
                response.raise_for_status()
                checks['discovery'] = response.json()['result']['supportedVersions']
                headers.update({'Mcp-Method':'tools/call','Mcp-Name':'ms_capabilities'})
                response = client.post(url, headers=headers, json={'jsonrpc':'2.0','id':2,
                    'method':'tools/call','params':{'_meta':metadata,'name':'ms_capabilities','arguments':{}}})
                response.raise_for_status()
                checks['tool_count'] = response.json()['result']['structuredContent']['tool_count']
                assert checks['tool_count'] == 15
                response = client.post(url, headers=headers | {'Origin':'https://invalid.example'}, json={})
                checks['invalid_origin_status'] = response.status_code
                assert response.status_code == 403
                checks['transport'] = 'real loopback HTTP subprocess, not an in-process test client'
        finally:
            process.terminate()
            try:
                stdout, stderr = process.communicate(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                stdout, stderr = process.communicate(timeout=3)
        checks['stdout_empty'] = not stdout
        checks['exit_code'] = process.returncode
        checks['stderr_tail'] = stderr[-2000:]
        assert checks['stdout_empty']
    out = ROOT/'validation/http_socket_smoke.json'
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(checks, indent=2))
    print(json.dumps(checks, ensure_ascii=False))


if __name__ == '__main__':
    main()
