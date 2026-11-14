"""Optional device-resident CuPy FFT + L1/L2(identity) FISTA.

Only zero-extended or circular convolution. Explicit failure, never silent CPU fallback.
GPU path is independently testable; lack of hardware is reported as unverified.
"""
import numpy as np
from time import perf_counter
from .operators import Convolution,array
from .solvers import Result,_stop,_check


def capability():
    try:
        import cupy as cp
        count=cp.cuda.runtime.getDeviceCount()
        if count<1: return {"available":False,"reason":"No CUDA device"}
        p=cp.cuda.runtime.getDeviceProperties(0); name=p["name"]
        return {"available":True,"devices":count,"name":name.decode() if isinstance(name,bytes) else str(name),"cupy":cp.__version__}
    except Exception as e: return {"available":False,"reason":str(e)}


class GPUConvolution:
    def __init__(self,A):
        import cupy as cp
        if not isinstance(A,Convolution) or A.boundary!="zero": raise ValueError("GPU path requires zero/circular Convolution")
        self.cp=cp; self.A=A; self.shape=A.fft_shape
        self.H=cp.fft.rfftn(cp.asarray(A.h),s=self.shape)
    def forward(self,x):
        cp=self.cp; out=cp.fft.irfftn(cp.fft.rfftn(x,s=self.shape)*self.H,s=self.shape)
        return out if self.A.mode=="circular" else out[self.A.crop]
    def adjoint(self,y):
        cp=self.cp
        if self.A.mode=="circular": z=y
        else:
            z=cp.zeros(self.shape); z[self.A.crop]=y
        out=cp.fft.irfftn(cp.fft.rfftn(z,s=self.shape)*self.H.conj(),s=self.shape)
        return out[tuple(slice(0,n) for n in self.A.input_shape)]


def gpu_fista(A,y,l1=0.,l2=1e-3,nonnegative=True,max_iter=1000,tol=1e-6,cancel=None,callback=None):
    _check(max_iter,tol,l1=l1,l2=l2)
    cap=capability()
    if not cap["available"]: raise RuntimeError("GPU unavailable: "+cap["reason"])
    import cupy as cp
    start=perf_counter(); G=GPUConvolution(A); target=cp.asarray(array(y).reshape(A.output_shape))
    x=cp.zeros(A.input_shape); z=x.copy(); m=1.; L=max(A.norm_bound**2+l2,1e-12)
    history=[]; converged=False
    def prox(v): return cp.maximum(v-l1/L,0) if nonnegative else cp.sign(v)*cp.maximum(cp.abs(v)-l1/L,0)
    reference=max(float(cp.linalg.norm(G.adjoint(target)).get()),np.finfo(float).tiny)
    for it in range(1,max_iter+1):
        _stop(cancel)
        grad=G.adjoint(G.forward(z)-target)+l2*z; xn=prox(z-grad/L)
        next_m=(1+np.sqrt(1+4*m*m))/2; zn=xn+(m-1)/next_m*(xn-x)
        if float(cp.vdot(z-xn,xn-x).get())>0: next_m=1.; zn=xn.copy()
        x,z,m=xn,zn,next_m
        if it==1 or it%10==0 or it==max_iter:
            r=G.forward(x)-target; grad=G.adjoint(r)+l2*x
            kkt=float((L*cp.linalg.norm(x-prox(x-grad/L))).get())/reference
            obj=float((.5*cp.sum(r*r)+.5*l2*cp.sum(x*x)+l1*cp.sum(cp.abs(x))).get())
            row={"iteration":it,"objective":obj,"stationarity":kkt}; history.append(row)
            if callback: callback(row)
            if kkt<tol: converged=True; break
    cp.cuda.get_current_stream().synchronize()
    host=cp.asnumpy(x); pred=A.forward(host)
    return Result(host,pred,array(y).reshape(A.output_shape)-pred,"gpu-fista",converged,it,obj,perf_counter()-start,
                  history,{"device":cap,"regularizer":"identity","stationarity":kkt},[] if converged else ["Iteration limit reached"])
