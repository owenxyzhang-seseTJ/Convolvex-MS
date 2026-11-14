"""Real, finite-dimensional operators. Adjoint means the Euclidean transpose.

Physical quadrature belongs in the forward operator, not in the inner product.
Every public operator returns a shaped float64 array and accepts flattened arrays.
"""
from __future__ import annotations
from math import prod
from typing import Sequence
import numpy as np
from scipy import fft, signal, sparse
from scipy.sparse.linalg import LinearOperator


def array(value, name="array") -> np.ndarray:
    if np.iscomplexobj(value):
        raise ValueError(f"{name}: complex-valued data is not supported in this release")
    a = np.asarray(value, dtype=np.float64)
    if a.size == 0 or not np.isfinite(a).all():
        raise ValueError(f"{name} must be nonempty and finite")
    return a


def shape_tuple(shape) -> tuple[int, ...]:
    shape = (shape,) if isinstance(shape, (int, np.integer)) else tuple(shape)
    if not shape or any(int(s) != s or s < 1 for s in shape):
        raise ValueError("shape dimensions must be positive integers")
    return tuple(map(int, shape))


class Operator:
    """Subclass contract: forward, adjoint, input_shape, output_shape, norm_bound."""
    positive = False
    @property
    def shape(self):
        return prod(self.output_shape), prod(self.input_shape)

    def _x(self, x):
        return array(x, "x").reshape(self.input_shape)

    def _y(self, y):
        return array(y, "y").reshape(self.output_shape)

    def linear_operator(self):
        return LinearOperator(self.shape,
            matvec=lambda x: self.forward(x).ravel(),
            rmatvec=lambda y: self.adjoint(y).ravel(), dtype=np.float64)

    def matrix(self, max_elements=2_000_000):
        m, n = self.shape
        if m * n > max_elements:
            raise ValueError("dense materialization exceeds max_elements")
        out = np.empty((m, n))
        for i in range(n):
            e = np.zeros(n); e[i] = 1
            out[:, i] = self.forward(e).ravel()
        return out

    def __matmul__(self, other):
        return Compose(self, other)


class Matrix(Operator):
    def __init__(self, matrix):
        if sparse.issparse(matrix) and np.iscomplexobj(matrix.data):
            raise ValueError("complex matrices are not supported")
        self.a = sparse.csr_matrix(matrix, dtype=float) if sparse.issparse(matrix) else array(matrix)
        if self.a.ndim != 2 or 0 in self.a.shape:
            raise ValueError("matrix must be nonempty and two-dimensional")
        vals = self.a.data if sparse.issparse(self.a) else self.a
        if not np.isfinite(vals).all():
            raise ValueError("nonfinite matrix")
        self.input_shape = (self.a.shape[1],)
        self.output_shape = (self.a.shape[0],)
        self.positive = bool(np.all(vals >= 0))
        a = abs(self.a)
        self.norm_bound = float(np.sqrt(np.max(a.sum(axis=0)) * np.max(a.sum(axis=1))))

    def forward(self, x): return np.asarray(self.a @ self._x(x)).reshape(self.output_shape)
    def adjoint(self, y): return np.asarray(self.a.T @ self._y(y)).reshape(self.input_shape)


class Identity(Operator):
    def __init__(self, shape):
        self.input_shape = self.output_shape = shape_tuple(shape)
        self.norm_bound = 1.; self.positive = True
    def forward(self, x): return self._x(x).copy()
    def adjoint(self, y): return self._y(y).copy()


class Compose(Operator):
    def __init__(self, left, right):
        if left.shape[1] != right.shape[0]: raise ValueError("composition shape mismatch")
        self.left, self.right = left, right
        self.input_shape, self.output_shape = right.input_shape, left.output_shape
        self.norm_bound = left.norm_bound * right.norm_bound
        self.positive = left.positive and right.positive
    def forward(self, x): return self.left.forward(self.right.forward(x))
    def adjoint(self, y): return self.right.adjoint(self.left.adjoint(y))


class Diagonal(Operator):
    def __init__(self, diagonal):
        self.d = array(diagonal)
        self.input_shape = self.output_shape = self.d.shape
        self.norm_bound = float(np.max(abs(self.d)))
        self.positive = bool(np.all(self.d >= 0))
    def forward(self, x): return self.d * self._x(x)
    def adjoint(self, y): return self.d * self._y(y)


class Sampling(Operator):
    """Selection, including repeated indices; transpose sums repeated samples."""
    def __init__(self, input_shape, indices):
        self.input_shape = shape_tuple(input_shape)
        raw = np.asarray(indices)
        self.indices = raw.astype(np.int64).ravel()
        if not self.indices.size or not np.array_equal(raw.ravel(), self.indices):
            raise ValueError("indices must be integers")
        if self.indices.min() < 0 or self.indices.max() >= prod(self.input_shape):
            raise ValueError("sample index out of bounds")
        self.output_shape = (self.indices.size,)
        self.norm_bound = float(np.sqrt(np.bincount(self.indices).max()))
        self.positive = True
    def forward(self, x): return self._x(x).ravel()[self.indices]
    def adjoint(self, y):
        out = np.zeros(prod(self.input_shape))
        np.add.at(out, self.indices, self._y(y))
        return out.reshape(self.input_shape)


class Convolution(Operator):
    """1D/2D/3D linear or circular convolution, with cached real FFT.

    Zero extension: full, same (SciPy centering), causal, valid.
    Reflect extension: same only; exact transpose of the extension is used.
    Circular: kernel index zero is zero lag; never implicitly fftshifted.
    sample_volume multiplies kernel values (e.g. dt for a sampled density).
    """
    def __init__(self, kernel, input_shape=None, mode="causal", boundary="zero",
                 engine="fft", sample_volume=1., *, input_size=None):
        if input_shape is None: input_shape = input_size
        self.input_shape = shape_tuple(input_shape)
        self.kernel = array(kernel, "kernel").copy()
        if self.kernel.ndim != len(self.input_shape) or self.kernel.ndim > 3:
            raise ValueError("kernel and input must have matching dimensions (1 to 3)")
        if not np.isfinite(sample_volume) or sample_volume <= 0:
            raise ValueError("sample_volume must be finite and positive")
        if mode not in {"full", "same", "causal", "valid", "circular"}:
            raise ValueError("unsupported convolution mode")
        if boundary not in {"zero", "reflect"} or engine not in {"fft", "direct", "cpp", "auto", "overlap_add"}:
            raise ValueError("unsupported boundary or engine")
        self.mode, self.boundary, self.engine = mode, boundary, engine
        self.sample_volume = float(sample_volume)
        self.h = self.kernel * self.sample_volume
        self.positive = bool(np.all(self.h >= 0))
        self.norm_bound = float(np.sum(abs(self.h)))
        self._reflect = None
        if boundary == "reflect":
            if mode != "same": raise ValueError("reflect requires mode='same'")
            # Centered full crop: left padding is ceil((k-1)/2).
            pads = [(k - 1 - (k - 1)//2, (k - 1)//2) for k in self.h.shape]
            ids = np.arange(prod(self.input_shape)).reshape(self.input_shape)
            self._map = np.pad(ids, pads, mode="reflect")
            self._reflect = Convolution(self.kernel, self._map.shape, "valid", "zero", engine, sample_volume)
            self.output_shape = self.input_shape
            counts = np.bincount(self._map.ravel(), minlength=prod(self.input_shape))
            self.norm_bound *= float(np.sqrt(counts.max()))
            return
        n, k = self.input_shape, self.h.shape
        self.full_shape = tuple(a + b - 1 for a, b in zip(n, k))
        if mode == "circular":
            if any(b > a for a, b in zip(n, k)): raise ValueError("circular kernel cannot exceed input shape")
            self.output_shape = self.input_shape
            self.fft_shape = self.input_shape
            self._H = fft.rfftn(self.h, self.fft_shape)
            self.norm_bound = float(np.max(abs(self._H)))
            if engine not in {"fft", "auto"}: raise ValueError("circular requires FFT")
            return
        if mode == "valid" and any(b > a for a, b in zip(n, k)):
            raise ValueError("valid requires input >= kernel on each axis")
        starts = {"full": (0,)*len(n), "causal": (0,)*len(n),
                  "same": tuple((b-1)//2 for b in k), "valid": tuple(b-1 for b in k)}[mode]
        self.output_shape = self.full_shape if mode == "full" else (
            tuple(a-b+1 for a,b in zip(n,k)) if mode == "valid" else n)
        self.crop = tuple(slice(s, s+o) for s,o in zip(starts,self.output_shape))
        self.fft_shape = tuple(fft.next_fast_len(v, real=True) for v in self.full_shape)
        self._H = fft.rfftn(self.h, self.fft_shape)
        if engine == "cpp" and len(n) != 1: raise ValueError("C++ direct engine supports 1D only")
        if engine == "auto":
            self.engine = signal.choose_conv_method(np.zeros(n), self.h, mode="full")

    def forward(self, x):
        x = self._x(x)
        if self._reflect is not None: return self._reflect.forward(x.ravel()[self._map])
        if self.mode == "circular": return fft.irfftn(fft.rfftn(x)*self._H, self.fft_shape)
        if self.engine == "cpp":
            from .native import convolve_full
            out = convolve_full(x, self.h)
        elif self.engine == "direct": out = signal.convolve(x, self.h, mode="full", method="direct")
        elif self.engine == "overlap_add": out = signal.oaconvolve(x, self.h, mode="full")
        else: out = fft.irfftn(fft.rfftn(x,self.fft_shape)*self._H,self.fft_shape)
        return np.array(out[self.crop], copy=True)

    def adjoint(self, y):
        y = self._y(y)
        if self._reflect is not None:
            z = self._reflect.adjoint(y)
            out = np.zeros(prod(self.input_shape)); np.add.at(out,self._map.ravel(),z.ravel())
            return out.reshape(self.input_shape)
        if self.mode == "circular": return fft.irfftn(fft.rfftn(y)*self._H.conj(), self.fft_shape)
        z = np.zeros(self.full_shape); z[self.crop] = y
        if self.engine == "cpp":
            from .native import correlate_valid
            return correlate_valid(z,self.h)
        if self.engine == "direct": return signal.correlate(z,self.h,mode="valid",method="direct")
        if self.engine == "overlap_add":
            return signal.oaconvolve(z,np.flip(self.h),mode="valid")
        out = fft.irfftn(fft.rfftn(z,self.fft_shape)*self._H.conj(),self.fft_shape)
        return np.array(out[tuple(slice(0,n) for n in self.input_shape)],copy=True)


class Gradient(Operator):
    """Forward differences, zero terminal difference, with exact transpose."""
    def __init__(self, shape, axes=None):
        self.input_shape = shape_tuple(shape)
        self.axes = tuple(range(len(self.input_shape))) if axes is None else tuple(axes)
        if not self.axes or len(set(self.axes)) != len(self.axes) or any(a < 0 or a >= len(self.input_shape) for a in self.axes): raise ValueError("invalid gradient axes")
        self.output_shape = (len(self.axes),) + self.input_shape
        self.norm_bound = 2 * np.sqrt(len(self.axes))
    def forward(self, x):
        x = self._x(x); out = np.zeros(self.output_shape)
        for j,axis in enumerate(self.axes):
            s = [slice(None)]*x.ndim; s[axis] = slice(0,-1)
            out[(j,)+tuple(s)] = np.diff(x, axis=axis)
        return out
    def adjoint(self, y):
        y = self._y(y); out = np.zeros(self.input_shape)
        for j,axis in enumerate(self.axes):
            a=[slice(None)]*out.ndim; b=a.copy()
            a[axis]=slice(0,-1); b[axis]=slice(1,None)
            v=y[(j,)+tuple(a)]
            out[tuple(a)] -= v; out[tuple(b)] += v
        return out


class Laplacian(Operator):
    """Positive semidefinite D^T D. Second-order Tikhonov penalizes its norm."""
    def __init__(self, shape, axes=None):
        self.g=Gradient(shape, axes); self.input_shape=self.output_shape=self.g.input_shape
        self.norm_bound=self.g.norm_bound**2
    def forward(self,x): return self.g.adjoint(self.g.forward(x))
    def adjoint(self,y): return self.forward(y)


class Mixing(Operator):
    """S @ X, with X shaped (species, time) and Y (channels, time)."""
    def __init__(self, response, samples):
        self.s=array(response,"response")
        if self.s.ndim!=2: raise ValueError("response must be a matrix")
        n=shape_tuple(samples)[0]
        self.input_shape=(self.s.shape[1],n); self.output_shape=(self.s.shape[0],n)
        self.regularization_axes=(1,)
        self.norm_bound=float(np.linalg.norm(self.s,2)); self.positive=bool(np.all(self.s>=0))
    def forward(self,x): return self.s@self._x(x)
    def adjoint(self,y): return self.s.T@self._y(y)


class SpectroTemporal(Operator):
    """Species-specific convolution followed by spectral mixing: Y = S H X."""
    def __init__(self,response,kernels,samples,mode="causal",sample_volume=1.):
        self.mix=Mixing(response,samples)
        if len(kernels)!=self.mix.input_shape[0]: raise ValueError("one kernel per species required")
        self.ops=[Convolution(h,samples,mode=mode,sample_volume=sample_volume) for h in kernels]
        lengths={a.output_shape for a in self.ops}
        if len(lengths)!=1: raise ValueError("all species must have equal output support")
        self.mix=Mixing(response,self.ops[0].output_shape[0])
        self.input_shape=(len(kernels),int(samples)); self.output_shape=self.mix.output_shape
        self.regularization_axes=(1,)
        self.norm_bound=self.mix.norm_bound*max(a.norm_bound for a in self.ops)
        self.positive=self.mix.positive and all(a.positive for a in self.ops)
    def forward(self,x):
        x=self._x(x); return self.mix.forward(np.stack([a.forward(x[j]) for j,a in enumerate(self.ops)]))
    def adjoint(self,y):
        z=self.mix.adjoint(y); return np.stack([a.adjoint(z[j]) for j,a in enumerate(self.ops)])


class NonuniformConvolution(Matrix):
    """Trapezoidal Nyström discretization on strictly increasing source times.

    h(t) supplied on a lag grid, interpolated linearly with zero outside support.
    This is deliberately dense and guarded: nonuniform samples are not an FFT.
    """
    def __init__(self,source_times,observation_times,kernel_times,kernel_values,max_elements=2_000_000):
        t=array(source_times).ravel(); u=array(observation_times).ravel()
        kt=array(kernel_times).ravel(); kv=array(kernel_values).ravel()
        for v in (t,u,kt):
            if v.size<2 or np.any(np.diff(v)<=0): raise ValueError("time grids must be strictly increasing")
        if kt.shape!=kv.shape: raise ValueError("kernel grid mismatch")
        if t.size*u.size>max_elements: raise ValueError("nonuniform quadrature exceeds dense limit")
        w=np.empty_like(t); w[0]=(t[1]-t[0])/2; w[-1]=(t[-1]-t[-2])/2
        w[1:-1]=(t[2:]-t[:-2])/2
        super().__init__(np.interp(u[:,None]-t[None,:],kt,kv,left=0,right=0)*w[None,:])
        self.quadrature_weights=w


class KernelOperator(Operator):
    """Linear map h -> crop(x * h), for fixed x and fixed kernel shape."""
    def __init__(self,known_input,kernel_shape,mode="causal"):
        self.x=array(known_input)
        self.input_shape=shape_tuple(kernel_shape)
        if len(self.input_shape)!=self.x.ndim: raise ValueError("kernel dimension mismatch")
        if mode=="circular": raise ValueError("use linear support for kernel estimation")
        self.template=Convolution(np.ones(self.input_shape),self.x.shape,mode)
        self.output_shape=self.template.output_shape; self.mode=mode
        self.norm_bound=float(np.sum(abs(self.x))); self.positive=bool(np.all(self.x>=0))
    def forward(self,h): return Convolution(self._x(h),self.x.shape,self.mode).forward(self.x)
    def adjoint(self,y):
        z=np.zeros(self.template.full_shape); z[self.template.crop]=self._y(y)
        return signal.correlate(z,self.x,mode="valid",method="fft")


def adjoint_error(operator,seed=0):
    rng=np.random.default_rng(seed)
    x=rng.normal(size=operator.input_shape); y=rng.normal(size=operator.output_shape)
    l=float(np.vdot(operator.forward(x),y)); r=float(np.vdot(x,operator.adjoint(y)))
    return abs(l-r)/max(1.,abs(l),abs(r))
