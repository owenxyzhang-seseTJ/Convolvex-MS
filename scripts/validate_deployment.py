"""Run the same sequential deployment assessment on Linux and native Windows."""
from pathlib import Path
import argparse
import importlib.metadata
import json
import os
import platform
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--services-only', action='store_true',
                        help='Reuse passed numerical artifacts after a service-only configuration change')
    args = parser.parse_args()
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    for key in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'MKL_NUM_THREADS', 'VECLIB_MAXIMUM_THREADS'):
        env[key] = '1'
    env['PYTHONUTF8'] = '1'
    cpu = platform.processor()
    if os.name == 'nt':
        import winreg
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'HARDWARE\DESCRIPTION\System\CentralProcessor\0') as key:
            cpu = winreg.QueryValueEx(key, 'ProcessorNameString')[0].strip()
    elif Path('/proc/cpuinfo').exists():
        cpu = next((line.split(':', 1)[1].strip() for line in Path('/proc/cpuinfo').read_text().splitlines()
                    if line.startswith('model name')), cpu)
    from convolvex.native import available
    from convolvex.gpu import capability
    results = {'environment': {'platform': platform.platform(), 'python': platform.python_version(),
        'executable': sys.executable, 'cpu': cpu, 'cpu_count': os.cpu_count(),
        'native_available': available(), 'gpu': capability(),
        'versions': {name: importlib.metadata.version(name) for name in
                     ('convolvex', 'numpy', 'scipy', 'fastapi', 'uvicorn', 'pydantic', 'pytest', 'httpx', 'mcp')}},
        'steps': [], 'all_accuracy_data_synthetic': True}

    def save():
        (output / 'deployment_result.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')

    def run(name, arguments):
        if args.services_only and name in {'pytest', 'ms_benchmark', 'accuracy', 'prepare_agent', 'agent_workflow'}:
            print('REUSE verified numerical artifact:', name, flush=True)
            results.setdefault('reused_numerical_artifacts', []).append(name)
            return
        print('RUN', name, flush=True)
        start = time.perf_counter()
        with (output / (name + '.txt')).open('w', encoding='utf-8') as log:
            process = subprocess.run([sys.executable, *map(str, arguments)], cwd=ROOT, env=env,
                                     stdout=log, stderr=subprocess.STDOUT)
        results['steps'].append({'name': name, 'returncode': process.returncode,
                                 'wall_s': time.perf_counter() - start})
        save()
        print('DONE', name, process.returncode, flush=True)
        if process.returncode:
            print((output / (name + '.txt')).read_text(encoding='utf-8', errors='replace')[-7000:], flush=True)
            raise SystemExit(process.returncode)

    if args.services_only:
        existing = ET.parse(output / 'pytest.xml').getroot()
        suites = list(existing) if existing.tag == 'testsuites' else [existing]
        if any(int(s.attrib.get('failures',0)) or int(s.attrib.get('errors',0)) for s in suites):
            parser.error('Numerical regression has not passed; run complete validation first')
    save()
    run('pytest', ['-m', 'pytest', '-q', '-ra', '--tb=short', '--junitxml=' + str(output / 'pytest.xml')])
    suites = ET.parse(output / 'pytest.xml').getroot()
    tests = list(suites) if suites.tag == 'testsuites' else [suites]
    results['tests'] = {key: sum(int(s.attrib.get(key, 0)) for s in tests)
                        for key in ('tests', 'failures', 'errors', 'skipped')}
    results['tests']['passed'] = results['tests']['tests'] - results['tests']['failures'] - results['tests']['errors'] - results['tests']['skipped']
    run('ms_benchmark', ['benchmarks/ms_benchmark.py', '--output', output / 'ms_benchmark.json'])
    run('accuracy', ['benchmarks/local_accuracy.py', '--output', output / 'accuracy.json'])
    run('prepare_agent', ['scripts/prepare_ms_demo.py', '--workspace', output / 'agent-workspace'])
    run('agent_workflow', ['-m', 'convolvex.agent_runner', 'examples/mcp/workflow.json',
                           '--workspace', output / 'agent-workspace', '--output', output / 'agent_trace.json'])
    run('start_services', ['scripts/local_services.py', 'start'])
    run('http_end_to_end', ['scripts/local_end_to_end.py', '--output', output / 'http_end_to_end.json'])
    run('service_status', ['scripts/local_services.py', 'status'])
    run('pip_check', ['-m', 'pip', 'check'])
    run('requirements', ['-m', 'pip', 'freeze'])
    analysis = json.loads((output / 'accuracy.json').read_text(encoding='utf-8'))
    results['summary'] = {'joint_rmse': analysis['joint_cases'][0]['source_rmse'],
                          'all_joint_cases_converged': all(c['converged'] for c in analysis['joint_cases']),
                          'independent_noise': analysis['independent_noise_summary']}
    results['completed'] = True
    save()
    print(json.dumps(results, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    main()
