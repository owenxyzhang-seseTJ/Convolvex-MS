"""Executable real-valued inverse-problem example. Run from an installed project."""
from __future__ import annotations
import json
from pathlib import Path
import numpy as np
from convolvex.operators import Convolution, adjoint_error
from convolvex.solvers import fista


def main() -> None:
    rng = np.random.default_rng(20261114)
    source = np.zeros(512)
    source[80:140] = 1.0
    kernel = np.exp(-np.arange(48) / 8.0)
    kernel /= kernel.sum()  # This example deliberately uses a discrete unit-mass FIR.
    operator = Convolution(kernel, source.shape, mode="causal", engine="fft")
    observed = operator.forward(source) + rng.normal(0, 0.01, source.shape)
    result = fista(operator, observed, l2=0.003, order=1, nonnegative=True,
                   max_iter=1000, tol=1e-6)
    destination = Path("example_output.npz")
    np.savez_compressed(destination, source=source, kernel=kernel, observed=observed,
                        estimate=result.estimate, predicted=result.predicted,
                        residual=result.residual)
    print(json.dumps({"converged": result.converged, "iterations": result.iterations,
                      "source_rmse": float(np.sqrt(np.mean((source-result.estimate)**2))),
                      "adjoint_error": adjoint_error(operator),
                      "data": str(destination)}, indent=2))


if __name__ == "__main__":
    main()
