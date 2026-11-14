"""Submit real numerical jobs to the deployed loopback REST and MCP servers."""
from pathlib import Path
import argparse
import json
import os
import time
import httpx
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'local_validation/http_end_to_end.json'
MODERN = '2026-07-28'
META = 'io.modelcontextprotocol/'


def main():
    port_file = ROOT / 'runtime/ports.json'
    ports = json.loads(port_file.read_text(encoding='utf-8')) if port_file.exists() else {}
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--web-port', type=int, default=ports.get('web', 8875 if os.name == 'nt' else 8765))
    parser.add_argument('--mcp-port', type=int, default=ports.get('mcp', 8876 if os.name == 'nt' else 8766))
    parser.add_argument('--output', type=Path, default=OUT)
    args = parser.parse_args()
    started = time.perf_counter()
    results = {'transport': 'real loopback sockets', 'all_data_synthetic': True}
    with httpx.Client(base_url=f'http://127.0.0.1:{args.web_port}', timeout=30, trust_env=False) as web:
        health = web.get('/api/v1/health').raise_for_status().json()
        demo = web.get('/api/v1/demo/dems').raise_for_status().json()
        submitted = web.post('/api/v1/jobs', json=demo['problem']).raise_for_status().json()
        job = submitted['id']
        deadline = time.monotonic() + 30
        while True:
            state = web.get('/api/v1/jobs/' + job).raise_for_status().json()
            if state['status'] not in {'queued', 'running'}:
                break
            if time.monotonic() > deadline:
                raise TimeoutError('REST numerical job timed out')
            time.sleep(.03)
        if state['status'] != 'completed':
            raise RuntimeError(state)
        fit = web.get('/api/v1/jobs/' + job + '/result').raise_for_status().json()
        results['web_dems'] = {'health': health, 'job_id': job, 'status': state['status'],
            'converged': fit['converged'], 'iterations': fit['iterations'],
            'source_rmse': float(np.sqrt(np.mean((np.asarray(fit['estimate']) - demo['truth']) ** 2))),
            'relative_residual': fit['relative_residual'], 'solver_elapsed_s': fit['elapsed_s']}

    token = (ROOT / 'runtime/mcp-token.txt').read_text().strip()
    headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/json, text/event-stream',
               'MCP-Protocol-Version': MODERN}
    sequence = 0
    trace = []
    with httpx.Client(base_url=f'http://127.0.0.1:{args.mcp_port}', timeout=30, trust_env=False) as client:
        def rpc(method, params=None):
            nonlocal sequence
            sequence += 1
            params = {} if params is None else dict(params)
            params['_meta'] = {META + 'protocolVersion': MODERN, META + 'clientCapabilities': {}}
            local_headers = {**headers, 'Mcp-Method': method}
            if method == 'tools/call':
                local_headers['Mcp-Name'] = params['name']
            response = client.post('/mcp', headers=local_headers,
                json={'jsonrpc': '2.0', 'id': sequence, 'method': method, 'params': params})
            response.raise_for_status()
            data = response.json()
            if 'error' in data:
                raise RuntimeError(data['error'])
            return data['result']

        def tool(name, arguments):
            response = rpc('tools/call', {'name': name, 'arguments': arguments})
            if response.get('isError'):
                raise RuntimeError(response['content'])
            trace.append({'tool': name, 'success': True})
            return response['structuredContent']

        def complete(job):
            deadline = time.monotonic() + 30
            while True:
                state = tool('ms_get_job', {'job_id': job})
                if state['status'] not in {'queued', 'running'}:
                    break
                if time.monotonic() > deadline:
                    raise TimeoutError('HTTP MCP numerical job timed out')
                time.sleep(.03)
            if state['status'] != 'completed':
                raise RuntimeError(state)
            return tool('ms_get_result', {'job_id': job})

        capabilities = tool('ms_capabilities', {})
        dataset = json.loads((ROOT / 'examples/mcp/synthetic_ms.json').read_text())
        key = tool('ms_import_dataset', {'data': dataset})['dataset_id']
        request = json.loads((ROOT / 'examples/mcp/workflow.json').read_text())['analysis']
        job = tool('ms_submit_analysis', {'request': {'dataset_id': key, **request}, 'reuse': False})['job_id']
        summary = complete(job)
        estimate = [tool('ms_read_array', {'job_id': job, 'row': row, 'count': len(dataset['time_s'])})['values']
                    for row in range(3)]
        with np.load(ROOT / 'simulations/joint.npz', allow_pickle=False) as data:
            error = float(np.sqrt(np.mean((np.asarray(estimate) - data['truth']) ** 2)))
        results['http_mcp_joint'] = {'job_id': job, 'converged': summary['converged'],
            'iterations': summary['iterations'], 'source_rmse': error,
            'solver_elapsed_s': summary['elapsed_s'], 'protocol': MODERN,
            'server_version': capabilities['version'], 'tool_count': capabilities['tool_count']}

        profile = json.loads((ROOT / 'examples/mcp/mass_profile.json').read_text())
        pjob = tool('ms_submit_mass_profile', {'request': profile, 'reuse': False})['job_id']
        psummary = complete(pjob)
        values = tool('ms_read_array', {'job_id': pjob, 'count': len(profile['observed'])})['values']
        with np.load(ROOT / 'simulations/mass_profile.npz', allow_pickle=False) as data:
            error = float(np.sqrt(np.mean((np.asarray(values) - data['truth']) ** 2)))
        results['http_mcp_mass_profile'] = {'job_id': pjob, 'converged': psummary['converged'],
            'iterations': psummary['iterations'], 'source_rmse': error}
        bad = client.post('/mcp', json={}, headers={'Accept': 'application/json, text/event-stream'})
        invalid = client.post('/mcp', content=b'{}', headers=[(b'authorization', b'Bearer \xff')])
        results['http_auth'] = {'missing_token_status': bad.status_code,
                                'non_ascii_token_status': invalid.status_code}
        assert bad.status_code == invalid.status_code == 401
        results['mcp_calls'] = trace
    results['total_wall_s'] = time.perf_counter() - started
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2, allow_nan=False))
    print(json.dumps({key: value for key, value in results.items() if key != 'mcp_calls'}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
