"""Nuisance projection, kernel estimation, regularization selection, uncertainty."""
from time import perf_counter
import numpy as np
from .operators import Operator, array, KernelOperator, Convolution
from .solvers import fista, tikhonov, regularizer, Result, _data, _stop


class ProjectedWeighted(Operator):
    def __init__(self,A,weights,Q):
        self.A,self.w,self.Q=A,weights,Q
        self.input_shape=A.input_shape; self.output_shape=A.output_shape
        self.norm_bound=A.norm_bound*float(np.max(weights))
        self.regularization_axes=getattr(A,"regularization_axes",None)
    def project(self,z):
        v=np.asarray(z).ravel(); return (v-self.Q@(self.Q.T@v)).reshape(self.output_shape)
    def forward(self,x): return self.project(self.w*self.A.forward(x))
    def adjoint(self,y): return self.A.adjoint(self.w*self.project(y))


def pars(A,y,basis,weights=None,**kwargs):
    """Profiled Adaptive Regularized Solver (engineering combination).

    Eliminate an explicitly supplied linear nuisance model B beta by a thin SVD
    of W B; solve the projected source problem with safeguarded FISTA; recover
    beta using the same rank cutoff. No claim of a new optimization theorem.
    """
    if kwargs.get("loss", "gaussian") != "gaussian":
        raise ValueError("Exact nuisance projection requires Gaussian loss; use fixed-baseline Huber FISTA for robust data")
    start=perf_counter(); y,w,_=_data(A,y,weights)
    B=array(basis,"baseline basis")
    if B.ndim!=2 or B.shape[0]!=y.size or B.shape[1]>128:
        raise ValueError("basis must have (number of observations, <=128 columns)")
    WB=w.ravel()[:,None]*B
    U,s,Vt=np.linalg.svd(WB,full_matrices=False)
    cutoff=np.finfo(float).eps*max(WB.shape)*(s[0] if s.size else 0)
    rank=int(np.sum(s>cutoff)); Q=U[:,:rank]
    P=ProjectedWeighted(A,w,Q); target=P.project(w*y)
    res=fista(P,target,**kwargs)
    rhs=(w*(y-A.forward(res.estimate))).ravel()
    beta=Vt[:rank].T@((Q.T@rhs)/s[:rank]) if rank else np.zeros(B.shape[1])
    baseline=(B@beta).reshape(y.shape)
    res.method="pars-profiled-fista"; res.predicted=A.forward(res.estimate)+baseline
    res.residual=y-res.predicted; res.elapsed_s=perf_counter()-start
    res.extras={"baseline":baseline,"baseline_coefficients":beta}
    res.diagnostics.update({"basis_rank":rank,"basis_columns":B.shape[1],
        "nuisance_orthogonality":float(np.linalg.norm(Q.T@(w*res.residual).ravel())),
        "projected_data_fraction":float(np.linalg.norm(target)/max(np.linalg.norm(w*y),1e-30))})
    if rank<B.shape[1]: res.warnings.append("Nuisance basis is rank deficient; minimum-norm coefficients were used.")
    res.warnings.append("Projection removes source components lying in the nuisance subspace; inspect identifiability.")
    return res


def estimate_kernel(known_input,y,kernel_shape,mode="causal",alpha=1e-5,
                    nonnegative=True,max_iter=1500,tol=1e-7,**kwargs):
    A=KernelOperator(known_input,kernel_shape,mode)
    res=tikhonov(A,y,alpha=alpha,order=1,nonnegative=nonnegative,max_iter=max_iter,tol=tol,**kwargs)
    res.method="known-input-kernel-estimation"
    return res


def blind_deconvolution(y,kernel_size,input_size=None,mode="causal",restarts=3,
                        outer_iter=20,inner_iter=300,seed=0,cancel=None,callback=None):
    """1D alternating NNLS with unit-mass kernels and multiple starts.

    Kernel normalization is paired with inverse source scaling, preserving Ax.
    No sparsity or smoothing penalty is implicitly inserted. Non-unique.
    """
    y=array(y).ravel(); k=int(kernel_size)
    if k!=kernel_size or k<1 or k>y.size: raise ValueError("invalid kernel_size")
    if mode not in {"causal","full"}: raise ValueError("blind mode must be causal or full")
    n=int(input_size or (y.size-k+1 if mode=="full" else y.size))
    if n<1 or restarts<1 or outer_iter<1 or inner_iter<1: raise ValueError("invalid iteration/shape parameters")
    rng=np.random.default_rng(seed); best=None; runs=[]; start=perf_counter()
    for run in range(restarts):
        _stop(cancel)
        h=np.exp(-np.arange(k)/max(k/5,1)) if run==0 else rng.uniform(.05,1,k)
        h/=h.sum(); x=np.maximum(y[:n],0); hist=[]
        for it in range(outer_iter):
            _stop(cancel)
            A=Convolution(h,n,mode)
            sx=fista(A,y,l2=0,l1=0,nonnegative=True,max_iter=inner_iter,tol=1e-6,x0=x,cancel=cancel)
            x=sx.estimate
            K=KernelOperator(x,(k,),mode)
            sh=fista(K,y,l2=0,l1=0,nonnegative=True,max_iter=inner_iter,tol=1e-6,x0=h,cancel=cancel)
            scale=float(sh.estimate.sum())
            if scale<=1e-15: break
            h=sh.estimate/scale; x=x*scale
            pred=Convolution(h,n,mode).forward(x); obj=.5*float(np.sum((pred-y)**2))
            row={"restart":run,"iteration":it+1,"objective":obj}; hist.append(row)
            if callback: callback(row)
        pred=Convolution(h,n,mode).forward(x); obj=.5*float(np.sum((pred-y)**2)); runs.append(obj)
        if best is None or obj<best.objective:
            best=Result(x,pred,y-pred,"blind-alternating",False,it+1,obj,0.,hist,
                        {"selected_restart":run},["Blind factorization is non-unique. Unit-sum normalization removes scale ambiguity only."],{"kernel":h})
    best.elapsed_s=perf_counter()-start; best.diagnostics["restart_objectives"]=runs
    return best


def gcv(A,y,alphas=None,order=0,weights=None,max_unknowns=256):
    """Exact dense GCV for UNCONSTRAINED Gaussian Tikhonov, small problems only."""
    if A.shape[1]>max_unknowns: raise ValueError("exact GCV restricted to small problems")
    y,w,_=_data(A,y,weights); a=A.matrix()*w.ravel()[:,None]; target=(w*y).ravel()
    D=regularizer(A.input_shape,order,getattr(A,"regularization_axes",None)).matrix()
    grid=np.logspace(-7,1,25) if alphas is None else array(alphas).ravel()
    if np.any(grid<=0): raise ValueError("GCV alpha grid must be positive")
    ata=a.T@a; dtd=D.T@D; aty=a.T@target; m=int(np.count_nonzero(w)); rows=[]
    for alpha in grid:
        inv=np.linalg.pinv(ata+alpha*dtd,hermitian=True)
        x=inv@aty; residual=a@x-target; trace=float(np.trace(inv@ata))
        value=float(m*np.sum(residual**2)/max((m-trace)**2,1e-30))
        rows.append({"alpha":float(alpha),"gcv":value,"effective_dof":trace,"residual_norm":float(np.linalg.norm(residual))})
    selected=min(rows,key=lambda z:z["gcv"])
    return {"alpha":selected["alpha"],"curve":rows,"assumption":"unconstrained linear Gaussian fit; fixed weights and kernel"}


def bootstrap(A,y,solver=tikhonov,solver_kwargs=None,sigma=.01,repeats=50,seed=0,level=.95,cancel=None):
    """Parametric fixed-model bootstrap. Intervals exclude kernel/model error."""
    if not np.isfinite(sigma) or sigma<=0 or repeats<2 or not 0<level<1:
        raise ValueError("invalid bootstrap parameters")
    kw=dict(solver_kwargs or {}); base=solver(A,y,**kw); rng=np.random.default_rng(seed); estimates=[]
    for _ in range(repeats):
        _stop(cancel)
        est=solver(A,base.predicted+rng.normal(0,sigma,A.output_shape),**kw)
        estimates.append(est.estimate)
    a=np.stack(estimates); q=(1-level)/2
    return {"estimate":base.estimate,"lower":np.quantile(a,q,axis=0),"upper":np.quantile(a,1-q,axis=0),
            "std":np.std(a,axis=0,ddof=1),"level":level,"repeats":repeats,"seed":seed,
            "interpretation":"pointwise percentile, conditional on fitted model and supplied Gaussian sigma; not simultaneous coverage"}


def identifiability(A,max_unknowns=256):
    if A.shape[1]>max_unknowns:
        return {"evaluated":False,"reason":"exact dense SVD exceeds configured small-problem limit","norm_upper_bound":float(A.norm_bound)}
    s=np.linalg.svd(A.matrix(),compute_uv=False)
    threshold=np.finfo(float).eps*max(A.shape)*(s[0] if s.size else 0)
    rank=int(np.sum(s>threshold)); full=rank==A.shape[1]
    return {"evaluated":True,"rank":rank,"unknowns":A.shape[1],"observations":A.shape[0],
            "full_column_rank":full,"condition_number":float(s[0]/s[-1]) if full else None,
            "singular_values":s.tolist(),"threshold":float(threshold)}
