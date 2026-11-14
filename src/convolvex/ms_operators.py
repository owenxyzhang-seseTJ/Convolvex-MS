"""Mass-spectrometric forward models; arrays are channels/species by time.

No image-axis smoothing, implicit kernel normalization, or mass-channel interpolation.
"""
from __future__ import annotations
import numpy as np
from scipy import fft
from .operators import Operator, Mixing, array
from .solvers import fista


class BatchedSpectroTemporal(Operator):
    """Batched real FFT for Y = S [h_j * x_j]. Causal or full linear support.

    Kernels may have unequal lengths in causal mode. The adjoint first mixes
    with S.T, then zero-inserts the crop and correlates. No circular wraparound.
    ``sample_volume`` is dt for a sampled density, 1 for discrete FIR weights.
    """
    def __init__(self, response, kernels, samples, mode="causal", sample_volume=1.):
        self.s = array(response, "response").copy()
        if self.s.ndim != 2 or min(self.s.shape) < 1:
            raise ValueError("response must be a nonempty channels-by-species matrix")
        if int(samples) != samples or samples < 2:
            raise ValueError("samples must be an integer >= 2")
        self.n = int(samples)
        if len(kernels) != self.s.shape[1]:
            raise ValueError("one response kernel per species is required")
        self.kernels = [array(k, "kernel").ravel().copy() for k in kernels]
        if mode not in {"causal", "full"}:
            raise ValueError("batched MS convolution supports causal/full linear modes")
        if mode == "full" and len({len(k) for k in self.kernels}) != 1:
            raise ValueError("full mode requires a common declared kernel support")
        if not np.isfinite(sample_volume) or sample_volume <= 0:
            raise ValueError("sample_volume must be positive and finite")
        self.sample_volume = float(sample_volume)
        self.mode = mode
        self.full_length = self.n + max(map(len, self.kernels)) - 1
        self.nfft = fft.next_fast_len(self.full_length, real=True)
        self.input_shape = (self.s.shape[1], self.n)
        self.output_shape = (self.s.shape[0], self.n if mode == "causal" else self.full_length)
        # Guard BEFORE allocating potentially large padded FFTs.
        if self.nfft * self.s.shape[1] > 8_000_000 or np.prod(self.output_shape) > 2_000_000:
            raise ValueError("batched FFT exceeds the configured allocation budget")
        h = np.zeros((len(self.kernels), max(map(len, self.kernels))))
        for j, k in enumerate(self.kernels):
            h[j, :len(k)] = k * self.sample_volume
        self.H = fft.rfft(h, n=self.nfft, axis=-1)
        self.regularization_axes = (1,)
        self.norm_bound = float(np.linalg.norm(self.s, 2) * np.max(np.sum(abs(h), axis=1)))
        self.positive = bool(np.all(self.s >= 0) and np.all(h >= 0))

    def forward(self, x):
        z = fft.irfft(fft.rfft(self._x(x), n=self.nfft, axis=-1) * self.H,
                      n=self.nfft, axis=-1)
        return self.s @ z[:, :self.output_shape[1]]

    def adjoint(self, y):
        z = self.s.T @ self._y(y)
        out = fft.irfft(fft.rfft(z, n=self.nfft, axis=-1) * self.H.conj(),
                       n=self.nfft, axis=-1)
        return out[:, :self.n].copy()


class ChannelProjected(Operator):
    """P W A with separate low-dimensional nuisance spaces per channel.

    Stores O(C*T*p), not the block-diagonal O(C*C*T*p) background matrix.
    Gaussian weighted projection only. Bases and weights are fixed during fit.
    """
    def __init__(self, A, weights, basis):
        self.A = A
        self.input_shape, self.output_shape = A.input_shape, A.output_shape
        self.w = np.broadcast_to(array(weights), A.output_shape).copy()
        if np.any(self.w < 0) or not np.any(self.w > 0):
            raise ValueError("nonnegative weights with observed entries required")
        B = array(basis)
        if B.ndim != 2 or B.shape[0] != A.output_shape[1] or B.shape[1] > 8:
            raise ValueError("basis must be time-by-features with at most eight features")
        self.B = B
        self.factors = []
        for w in self.w:
            U, s, V = np.linalg.svd(w[:, None] * B, full_matrices=False)
            cutoff = np.finfo(float).eps * max(B.shape) * s[0]
            r = int(np.count_nonzero(s > cutoff))
            self.factors.append((U[:, :r], s[:r], V[:r]))
        self.norm_bound = A.norm_bound * float(self.w.max())
        self.regularization_axes = (1,)

    def project(self, y):
        out = self._y(y).copy()
        for c, (Q, _, _) in enumerate(self.factors):
            out[c] -= Q @ (Q.T @ out[c])
        return out

    def forward(self, x):
        return self.project(self.w * self.A.forward(x))

    def adjoint(self, y):
        return self.A.adjoint(self.w * self.project(y))

    def coefficients(self, residual):
        rhs = self.w * self._y(residual)
        return np.stack([V.T @ ((Q.T @ rhs[c]) / s) if s.size else np.zeros(self.B.shape[1])
                         for c, (Q, s, V) in enumerate(self.factors)])


def channel_pars(A, y, basis, weights=None, **kwargs):
    """Structured implementation of Gaussian variable projection + FISTA.

    This is an engineering optimization of established variable projection,
    not a claim of a new optimization theorem or universal identifiability.
    """
    from time import perf_counter
    start = perf_counter()
    if kwargs.get("loss", "gaussian") != "gaussian":
        raise ValueError("exact background elimination requires Gaussian loss")
    y = array(y).reshape(A.output_shape)
    w = np.ones_like(y) if weights is None else np.broadcast_to(array(weights), y.shape)
    P = ChannelProjected(A, w, basis)
    fit = fista(P, P.project(w * y), **kwargs)
    beta = P.coefficients(y - A.forward(fit.estimate))
    background = beta @ P.B.T
    fit.method = "ms-channel-pars-fista"
    fit.predicted = A.forward(fit.estimate) + background
    fit.residual = y - fit.predicted
    fit.elapsed_s = perf_counter() - start
    fit.extras = {"background": background, "background_coefficients": beta}
    fit.diagnostics.update({"background_rank_per_channel": [len(s) for _, s, _ in P.factors],
                            "background_storage_elements": int(sum(Q.size + s.size + V.size for Q, s, V in P.factors)),
                            "background_orthogonality": float(max(np.linalg.norm(Q.T @ (w[c]*fit.residual[c]))
                                                                   for c, (Q, _, _) in enumerate(P.factors)))})
    fit.warnings.append("Source components in the background subspace are not identifiable; the penalty selects among equivalent fits.")
    return fit
