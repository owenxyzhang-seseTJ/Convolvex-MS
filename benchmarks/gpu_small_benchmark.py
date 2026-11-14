"""Small 1D CUDA convolution assessment under recorded concurrent GPU load.

This evaluates GPUConvolution, not the CPU-only batched MS inversion pipeline.
Resident timings exclude H2D/D2H; transfer timings include both. All timings
synchronize the stream. Existing GPU jobs are observed, never controlled here.
"""
from pathlib import Path
import argparse
import json
import os
import platform
import shutil
import statistics
import subprocess
import time
import numpy as np
from convolvex.gpu import capability, GPUConvolution
from convolvex.operators import Convolution


def load_snapshot():
    command = shutil.which('nvidia-smi')
    if command is None and Path('/usr/lib/wsl/lib/nvidia-smi').exists():
        command = '/usr/lib/wsl/lib/nvidia-smi'
    if command is None:
        return {'available': False}
    result = subprocess.run([command, '--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu',
                             '--format=csv,noheader,nounits'], capture_output=True, text=True, timeout=10)
    return {'returncode': result.returncode, 'csv': result.stdout.strip()}


def timed(fn, synchronize=None):
    for _ in range(2):
        fn()
    if synchronize:
        synchronize()
    samples = []
    for _ in range(9):
        if synchronize:
            synchronize()
        start = time.perf_counter()
        fn()
        if synchronize:
            synchronize()
        samples.append((time.perf_counter() - start) * 1000)
    return {'median_ms': statistics.median(samples), 'samples_ms': samples,
            'warmups': 2, 'repeats': 9}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = {'scope': 'small 1D GPU convolution only; not complete MS inversion',
              'concurrent_load_expected': True, 'load_before': load_snapshot(),
              'device': capability(), 'python': platform.python_version(),
              'threads': {name: os.environ.get(name) for name in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS')},
              'rows': []}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if not result['device']['available']:
        args.output.write_text(json.dumps(result, indent=2), encoding='utf-8')
        raise SystemExit('CUDA unavailable; no timings fabricated')
    import cupy as cp
    synchronize = cp.cuda.get_current_stream().synchronize
    free, total = cp.cuda.runtime.memGetInfo()
    result['free_bytes_before'] = free
    result['total_bytes'] = total
    if free < 512 * 1024**2:
        raise SystemExit('Insufficient free GPU memory for this bounded assessment')
    rng = np.random.default_rng(1973)
    # Largest signal is 0.5 MiB; no large or multi-dimensional GPU jobs.
    for samples, kernel_length in [(4096, 31), (65536, 257)]:
        x = rng.normal(size=samples)
        kernel = np.exp(-np.arange(kernel_length) / (kernel_length / 8))
        kernel /= kernel.sum()
        operator = Convolution(kernel, samples, mode='causal', engine='fft')
        gpu = GPUConvolution(operator)
        device_x = cp.asarray(x)
        device_y = cp.asarray(rng.normal(size=samples))
        cpu_output = operator.forward(x)
        gpu_output = cp.asnumpy(gpu.forward(device_x))
        adjoint_error = float(np.max(np.abs(cp.asnumpy(gpu.adjoint(device_y)) - operator.adjoint(cp.asnumpy(device_y)))))
        forward_error = float(np.max(np.abs(gpu_output - cpu_output)))
        np.testing.assert_allclose(gpu_output, cpu_output, rtol=1e-11, atol=1e-12)
        cpu_timing = timed(lambda: operator.forward(x))
        resident_timing = timed(lambda: gpu.forward(device_x), synchronize)
        transfer_timing = timed(lambda: cp.asnumpy(gpu.forward(cp.asarray(x))), synchronize)
        result['rows'].append({'samples': samples, 'kernel_length': kernel_length,
            'max_forward_absolute_error': forward_error, 'max_adjoint_absolute_error': adjoint_error,
            'cpu_fft': cpu_timing, 'gpu_resident': resident_timing, 'gpu_with_transfers': transfer_timing,
            'speedup_resident': cpu_timing['median_ms'] / resident_timing['median_ms'],
            'speedup_with_transfers': cpu_timing['median_ms'] / transfer_timing['median_ms'],
            'load_after_case': load_snapshot()})
    result['cupy_memory_pool_bytes'] = cp.get_default_memory_pool().total_bytes()
    result['load_after'] = load_snapshot()
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
