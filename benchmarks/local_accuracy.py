"""Reproduce packaged synthetic cases and evaluate new noise/missing-data cases.

No experimental data, calibration, or molecular identification is inferred.
All parameters are fixed before running the cases; no accuracy-based tuning.
"""
from pathlib import Path
import argparse
import json
import platform
import time
import numpy as np
import scipy
from convolvex.massspec import (
    MSDataset, AnalysisRequest, ProfileRequest, analyze, analyze_profile,
    background_diagnosis, digest,
)
from convolvex.ms_operators import BatchedSpectroTemporal

ROOT = Path(__file__).resolve().parents[1]


def rmse(estimate, truth):
    return float(np.sqrt(np.mean((np.asarray(estimate) - truth) ** 2)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'local_validation/accuracy.json')
    args = parser.parse_args()
    template = MSDataset.model_validate_json((ROOT / 'examples/mcp/synthetic_ms.json').read_text())
    analysis = json.loads((ROOT / 'examples/mcp/workflow.json').read_text())['analysis']
    request = AnalysisRequest(dataset_id=digest(template.model_dump()), **analysis)
    with np.load(ROOT / 'simulations/joint.npz', allow_pickle=False) as raw:
        truth = raw['truth'].copy()
        baseline = raw['baseline'].copy()
    operator = BatchedSpectroTemporal(request.response, request.kernels, len(template.time_s))
    clean = operator.forward(truth)
    cases = []

    def evaluate(name, dataset, target, *, seed=None, noise_std=None, scale=1., missing=0.):
        req = request.model_copy(update={
            'dataset_id': digest(dataset.model_dump()), 'l1': request.l1 * scale,
        })
        start = time.perf_counter()
        fit = analyze(dataset, req)
        baseline_fit = analyze(dataset, req.model_copy(update={'method': 'fista'}))
        elapsed = time.perf_counter() - start
        error = rmse(fit['estimate'], target)
        naive_error = rmse(baseline_fit['estimate'], target)
        cases.append({
            'name': name, 'synthetic': True, 'seed': seed, 'noise_std': noise_std,
            'signal_scale': scale, 'missing_fraction_requested': missing,
            'valid_fraction': 1. if dataset.valid is None else float(np.mean(dataset.valid)),
            'source_rmse': error, 'source_rmse_divided_by_scale': error / scale,
            'background_ignored_rmse': naive_error, 'rmse_improvement_factor': naive_error / error,
            'per_species_rmse': [rmse(a, b) for a, b in zip(fit['estimate'], target)],
            'converged': fit['converged'], 'iterations': fit['iterations'],
            'baseline_converged': baseline_fit['converged'],
            'relative_residual': fit['relative_residual'],
            'stationarity': fit['diagnostics']['stationarity'],
            'adjoint_relative_error': fit['diagnostics']['adjoint_relative_error'],
            'fit_elapsed_s': fit['elapsed_s'], 'two_fits_wall_s': elapsed,
        })
        print(name, 'RMSE', error, 'converged', fit['converged'], flush=True)

    evaluate('packaged_joint_reproduction', template, truth)
    variants = [(seed, .006, 0., 1.) for seed in range(1701, 1706)]
    variants += [(1706, .006, .10, 1.), (1707, .018, 0., 1.), (1708, .006, 0., 1e-9)]
    for seed, noise, missing, scale in variants:
        rng = np.random.default_rng(seed)
        observed = (clean + baseline + rng.normal(0., noise, clean.shape)) * scale
        mask = rng.uniform(size=clean.shape) >= missing if missing else None
        dataset = template.model_copy(update={
            'signal': observed.tolist(), 'valid': None if mask is None else mask.tolist(),
            'metadata': {'synthetic_test_seed': seed, 'response_source': 'constructed, not NIST'},
        })
        name = f'new_noise_seed_{seed}'
        if missing:
            name += '_missing_10pct'
        if scale != 1.:
            name += '_scale_1e-9'
        evaluate(name, dataset, truth * scale, seed=seed, noise_std=noise * scale,
                 scale=scale, missing=missing)

    profile_req = ProfileRequest.model_validate_json((ROOT / 'examples/mcp/mass_profile.json').read_text())
    profile_fit = analyze_profile(profile_req)
    with np.load(ROOT / 'simulations/mass_profile.npz', allow_pickle=False) as raw:
        profile = {'observed_rmse': rmse(raw['observed'], raw['truth']),
                   'recovered_rmse': rmse(profile_fit['estimate'], raw['truth']),
                   'converged': profile_fit['converged'], 'iterations': profile_fit['iterations']}
    background_data = MSDataset.model_validate_json((ROOT / 'examples/mcp/background_ms.json').read_text())
    windows = [(0., 45.), (205., 240.)]
    assisted, _ = background_diagnosis(background_data, [45, 46], [44], windows, True, True)
    plain, _ = background_diagnosis(background_data, [45, 46], [44], windows, False, True)
    with np.load(ROOT / 'simulations/background.npz', allow_pickle=False) as raw:
        background = {'pressure_assisted_rmse': rmse(assisted['signed_residual'][0], raw['true45']),
                      'reference_only_rmse': rmse(plain['signed_residual'][0], raw['true45']),
                      'negative_residual_count': int(np.count_nonzero(np.asarray(assisted['signed_residual'][0]) < 0))}
    independent = [case for case in cases if case['seed'] in range(1701, 1706)]
    scores = [case['source_rmse'] for case in independent]
    result = {
        'all_data_synthetic': True,
        'scope': 'fixed known response/kernels and constructed truth; not experimental accuracy or FE',
        'parameter_selection': 'packaged workflow unchanged; l1 scales with signal for the 1e-9 case',
        'environment': {'python': platform.python_version(), 'numpy': np.__version__, 'scipy': scipy.__version__},
        'joint_cases': cases, 'mass_profile': profile, 'background': background,
        'independent_noise_summary': {'seeds': list(range(1701, 1706)),
                                      'mean_rmse': float(np.mean(scores)),
                                      'std_rmse': float(np.std(scores, ddof=1)),
                                      'min_rmse': min(scores), 'max_rmse': max(scores)},
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))
    print(args.output)


if __name__ == '__main__':
    main()
