"""Optional C++ kernels. Compile explicitly; never execute a compiler at import."""
from pathlib import Path
import ctypes
import sys
import numpy as np

_lib=None

def load():
    global _lib
    if _lib is not None: return _lib
    name="convolvex_native.dll" if sys.platform=="win32" else "libconvolvex_native.dylib" if sys.platform=="darwin" else "libconvolvex_native.so"
    path=Path(__file__).parent/"_native"/name
    if not path.exists(): raise RuntimeError("C++ engine unavailable; run python scripts/build_native.py")
    _lib=ctypes.CDLL(str(path))
    ptr=np.ctypeslib.ndpointer(dtype=np.float64,ndim=1,flags="C_CONTIGUOUS")
    for name in ("cvx_convolve_full","cvx_correlate_valid"):
        f=getattr(_lib,name); f.argtypes=[ptr,ctypes.c_size_t,ptr,ctypes.c_size_t,ptr]; f.restype=None
    return _lib

def available():
    try: load(); return True
    except (RuntimeError,OSError): return False

def convolve_full(x,h):
    x=np.ascontiguousarray(x,dtype=float); h=np.ascontiguousarray(h,dtype=float)
    if x.ndim!=1 or h.ndim!=1 or min(x.size,h.size)<1: raise ValueError("nonempty 1D arrays required")
    out=np.empty(x.size+h.size-1); load().cvx_convolve_full(x,x.size,h,h.size,out); return out

def correlate_valid(y,h):
    y=np.ascontiguousarray(y,dtype=float); h=np.ascontiguousarray(h,dtype=float)
    if y.ndim!=1 or h.ndim!=1 or not h.size or y.size<h.size: raise ValueError("invalid correlation shape")
    out=np.empty(y.size-h.size+1); load().cvx_correlate_valid(y,y.size,h,h.size,out); return out
