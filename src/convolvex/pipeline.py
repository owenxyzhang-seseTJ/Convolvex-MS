"""Versioned, data-only problem schema shared by CLI, REST, and frontend."""
from __future__ import annotations
import hashlib, json, platform
from time import perf_counter
from typing import Any,Literal
import numpy as np
import scipy
from pydantic import BaseModel,Field,ConfigDict,model_validator
from .operators import (Convolution,Matrix,Mixing,SpectroTemporal,NonuniformConvolution,Sampling,
                        Identity,array,adjoint_error)
from .solvers import solve,Result
from .inference import pars,estimate_kernel,blind_deconvolution,identifiability,gcv,bootstrap
from .gpu import gpu_fista

MAX_ELEMENTS=1_000_000


class Problem(BaseModel):
    model_config=ConfigDict(extra="forbid",allow_inf_nan=False)
    schema_version: Literal["1.0"]="1.0"
    task: Literal["forward","inverse","kernel","blind","gcv","bootstrap"]="inverse"
    operator: dict[str,Any]
    observed: Any=None
    source: Any=None
    method: Literal["tikhonov","fista","tv","richardson_lucy","wiener","pars","gpu_fista"]="fista"
    parameters: dict[str,Any]=Field(default_factory=dict)
    weights: Any=None
    baseline: Any=None
    basis: Any=None
    metadata: dict[str,Any]=Field(default_factory=dict)

    @model_validator(mode="after")
    def finite_and_limited(self):
        count=0
        def walk(v,depth=0):
            nonlocal count
            if depth>12: raise ValueError("nested request exceeds depth limit")
            if isinstance(v,dict):
                for k,a in v.items():
                    if len(str(k))>128: raise ValueError("oversized key")
                    walk(a,depth+1)
            elif isinstance(v,(list,tuple)):
                count+=len(v)
                if count>4_000_000: raise ValueError("request exceeds element limit")
                for a in v: walk(a,depth+1)
            elif isinstance(v,float) and not np.isfinite(v): raise ValueError("nonfinite numeric value")
            elif isinstance(v,str) and len(v)>10000: raise ValueError("oversized text value")
        walk(self.model_dump())
        for field in (self.observed,self.source):
            if field is not None and array(field).size>MAX_ELEMENTS: raise ValueError("array exceeds service size limit")
        if self.task=="forward" and self.source is None: raise ValueError("forward task requires source")
        if self.task!="forward" and self.observed is None: raise ValueError("task requires observed data")
        for key,limit in [("max_iter",5000),("inner_iter",1000),("outer_iter",50),("restarts",5),("repeats",100)]:
            if key in self.parameters and (not isinstance(self.parameters[key],int) or not 1<=self.parameters[key]<=limit):
                raise ValueError(f"{key} must be an integer in 1..{limit}")
        return self


def make_operator(spec):
    cfg=dict(spec); kind=cfg.pop("kind","convolution")
    allowed={
        "convolution":({"kernel","input_shape","mode","boundary","engine","sample_volume"},Convolution),
        "matrix":({"matrix"},Matrix),"mixing":({"response","samples"},Mixing),
        "spectrotemporal":({"response","kernels","samples","mode","sample_volume"},SpectroTemporal),
        "nonuniform":({"source_times","observation_times","kernel_times","kernel_values"},NonuniformConvolution),
        "identity":({"shape"},Identity)}
    if kind not in allowed: raise ValueError("unknown operator kind")
    keys,constructor=allowed[kind]
    if set(cfg)-keys: raise ValueError("unknown operator parameter(s): "+str(sorted(set(cfg)-keys)))
    if "input_shape" in cfg:
        raw=np.asarray(cfg["input_shape"]).ravel()
        if any(float(i)!=int(i) or int(i)<1 for i in raw) or len(raw)>3:
            raise ValueError("invalid input shape")
        from math import prod
        if prod(map(int,raw))>MAX_ELEMENTS: raise ValueError("operator input exceeds size limit")
    if "samples" in cfg and not 1<=cfg["samples"]<=MAX_ELEMENTS: raise ValueError("invalid samples")
    if "matrix" in cfg and array(cfg["matrix"]).size>2_000_000: raise ValueError("matrix exceeds limit")
    if "kernel" in cfg and array(cfg["kernel"]).size>100_000: raise ValueError("kernel exceeds limit")
    # Reflect and padded FFT allocations are checked before constructing the operator.
    if kind=="convolution":
        n=np.atleast_1d(cfg["input_shape"]); k=np.shape(cfg["kernel"])
        if len(n)!=len(k) or np.prod(n+np.array(k)-1)>4_000_000: raise ValueError("padded convolution exceeds service allocation limit")
        if cfg.get("engine") in {"cpp","direct"} and int(np.prod(n))*int(np.prod(k))>500_000_000:
            raise ValueError("direct convolution work exceeds service budget; choose FFT")
    A=constructor(**cfg)
    if max(A.shape)>MAX_ELEMENTS: raise ValueError("operator exceeds service element limit")
    return A


def execute(problem:Problem,cancel=None,callback=None):
    A=make_operator(problem.operator); kw=dict(problem.parameters); start=perf_counter()
    if problem.task=="forward":
        x=array(problem.source).reshape(A.input_shape); y=A.forward(x)
        if problem.baseline is not None: y=y+np.broadcast_to(array(problem.baseline),y.shape)
        result={"estimate":x.tolist(),"predicted":y.tolist(),"residual":np.zeros_like(y).tolist(),
                "method":"forward","converged":True,"iterations":1,"objective":0.,"elapsed_s":perf_counter()-start,
                "history":[],"diagnostics":{},"warnings":[],"extras":{},"relative_residual":0.}
    elif problem.task=="kernel":
        if problem.source is None: raise ValueError("kernel estimation requires known source")
        result=estimate_kernel(problem.source,problem.observed,**kw,cancel=cancel,callback=callback).to_dict()
    elif problem.task=="blind":
        result=blind_deconvolution(problem.observed,**kw,cancel=cancel,callback=callback).to_dict()
    elif problem.task=="gcv":
        result=gcv(A,problem.observed,weights=problem.weights,**kw)
    elif problem.task=="bootstrap":
        result=bootstrap(A,problem.observed,**kw,cancel=cancel)
        result={k:v.tolist() if isinstance(v,np.ndarray) else v for k,v in result.items()}
    else:
        if problem.method=="pars":
            if problem.basis is None: raise ValueError("PARS requires an explicit baseline basis")
            if problem.baseline is not None: raise ValueError("PARS uses basis, not a separate fixed baseline")
            result=pars(A,problem.observed,problem.basis,weights=problem.weights,**kw,cancel=cancel,callback=callback)
        elif problem.method=="gpu_fista":
            if problem.weights is not None or problem.baseline is not None: raise ValueError("GPU release does not support weighted/background objectives")
            result=gpu_fista(A,problem.observed,**kw,cancel=cancel,callback=callback)
        else:
            extra={"baseline":problem.baseline}
            if problem.method not in {"wiener","richardson_lucy"}: extra["weights"]=problem.weights
            elif problem.weights is not None: raise ValueError("this solver does not accept weights")
            if problem.method!="wiener": extra.update(cancel=cancel,callback=callback)
            result=solve(A,problem.observed,method=problem.method,**kw,**extra)
        result=result.to_dict()
    result["audit"]={"schema_version":"1.0","software":"convolvex-1.1.0",
        "input_sha256":hashlib.sha256(json.dumps(problem.model_dump(),sort_keys=True,separators=(",",":"),allow_nan=False).encode()).hexdigest(),
        "input_shape":list(A.input_shape),"output_shape":list(A.output_shape),
        "python":platform.python_version(),"numpy":np.__version__,"scipy":scipy.__version__,
        "adjoint_relative_error":adjoint_error(A),"identifiability":identifiability(A,max_unknowns=100),
        "model_metadata":problem.metadata}
    return result


def demo(kind="signal",seed=7):
    from .physics import gamma_response
    rng=np.random.default_rng(seed)
    if kind in {"signal","baseline","poisson"}:
        n=480;t=np.arange(n,dtype=float);x=np.zeros(n)
        x[70:120]=1.;x[220:290]=.65;x+=1.2*np.exp(-.5*((t-370)/8)**2)
        h=np.exp(-np.arange(50)/9);h/=h.sum()
        A=Convolution(h,n); y=A.forward(x)
        cfg={"kind":"convolution","kernel":h.tolist(),"input_shape":[n],"mode":"causal","engine":"fft"}
        p={"l2":.003,"l1":.0008,"order":1,"nonnegative":True,"max_iter":1500,"tol":1e-6}
        method="fista";basis=None
        if kind=="baseline":
            basis=np.column_stack([np.ones(n),t/(n-1)]).tolist()
            y+=.12+.1*t/(n-1);method="pars"
        if kind=="poisson":
            x*=80;y=rng.poisson(np.maximum(y*80,0)).astype(float);method="richardson_lucy";p={"max_iter":250,"tol":1e-5}
        else: y+=rng.normal(0,.012,n)
        return {"problem":Problem(operator=cfg,observed=y.tolist(),method=method,parameters=p,basis=basis,
                                  metadata={"synthetic":True,"seed":seed,"sample_interval":1,"units":"a.u.","name":kind}).model_dump(),
                "truth":x.tolist(),"axis":t.tolist(),"layout":"series"}
    if kind=="image":
        n=72; yy,xx=np.mgrid[:n,:n];x=np.zeros((n,n));x[12:35,12:29]=.8;x[(xx-49)**2+(yy-43)**2<12**2]=1
        hxy=np.arange(-4,5);h=np.exp(-(hxy[:,None]**2+hxy[None,:]**2)/(2*1.6**2));h/=h.sum()
        A=Convolution(h,(n,n),"same");y=A.forward(x)+rng.normal(0,.025,x.shape)
        return {"problem":Problem(operator={"kind":"convolution","kernel":h.tolist(),"input_shape":[n,n],"mode":"same","engine":"fft"},observed=y.tolist(),method="tv",parameters={"alpha":.04,"max_iter":1500,"tol":1e-5,"nonnegative":True},metadata={"synthetic":True,"seed":seed,"name":"image"}).model_dump(),"truth":x.tolist(),"layout":"image"}
    if kind=="volume":
        n=24;zz,yy,xx=np.mgrid[:n,:n,:n];x=np.zeros((n,n,n))
        x[(xx-12)**2+(yy-12)**2+(zz-12)**2<6**2]=1.;x[3:8,3:10,4:12]=.7
        q=np.arange(-2,3);h=np.exp(-(q[:,None,None]**2+q[None,:,None]**2+q[None,None,:]**2)/2);h/=h.sum()
        A=Convolution(h,x.shape,"same");y=A.forward(x)+rng.normal(0,.02,x.shape)
        return {"problem":Problem(operator={"kind":"convolution","kernel":h.tolist(),"input_shape":list(x.shape),"mode":"same","engine":"fft"},observed=y.tolist(),method="tv",parameters={"alpha":.04,"max_iter":500,"tol":1e-4,"nonnegative":True},metadata={"synthetic":True,"seed":seed,"name":"volume"}).model_dump(),"truth":x.tolist(),"layout":"volume"}
    if kind=="dems":
        n=400;t=np.arange(n)*.5;x=np.zeros((3,n))
        x[0,50:140]=1;x[1,180:260]=.7;x[2]=.7*np.exp(-.5*((t-145)/8)**2)
        S=np.array([[1,.05,.02],[.1,1,.6],[.02,.3,1],[.45,.1,.07]])
        hs=[gamma_response(np.arange(70)*.5,shape=2,scale=s) for s in (1.5,2.5,4)]
        A=SpectroTemporal(S,hs,n,sample_volume=.5);y=A.forward(x)+rng.normal(0,.008,A.output_shape)
        return {"problem":Problem(operator={"kind":"spectrotemporal","response":S.tolist(),"kernels":[h.tolist() for h in hs],"samples":n,"sample_volume":.5},observed=y.tolist(),method="fista",parameters={"l2":.002,"l1":.0005,"max_iter":1800,"tol":1e-6,"nonnegative":True},metadata={"synthetic":True,"seed":seed,"name":"dems","units":"a.u.","calibrated":False}).model_dump(),"truth":x.tolist(),"axis":t.tolist(),"layout":"channels"}
    raise ValueError("unknown demo")
