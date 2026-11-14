"""Regularized real inverse problems with explicit objectives and diagnostics."""
from __future__ import annotations
from dataclasses import dataclass, field
from time import perf_counter
import numpy as np
from scipy.sparse.linalg import LinearOperator, lsmr
from .operators import Operator, Identity, Gradient, Laplacian, array


class CancelledError(RuntimeError): pass


@dataclass
class Result:
    estimate: np.ndarray
    predicted: np.ndarray
    residual: np.ndarray
    method: str
    converged: bool
    iterations: int
    objective: float
    elapsed_s: float
    history: list[dict] = field(default_factory=list)
    diagnostics: dict = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    extras: dict = field(default_factory=dict)

    @property
    def relative_residual(self):
        return float(np.linalg.norm(self.residual)/max(np.linalg.norm(self.predicted+self.residual),1e-30))

    def to_dict(self):
        def plain(v):
            if isinstance(v,np.ndarray): return v.tolist()
            if isinstance(v,np.generic): return v.item()
            if isinstance(v,dict): return {k:plain(x) for k,x in v.items()}
            if isinstance(v,(tuple,list)): return [plain(x) for x in v]
            return v
        return plain({**self.__dict__,"relative_residual":self.relative_residual})


def _check(max_iter,tol,**penalties):
    if int(max_iter)!=max_iter or max_iter<1: raise ValueError("max_iter must be positive")
    if not np.isfinite(tol) or tol<=0: raise ValueError("tol must be positive and finite")
    for k,v in penalties.items():
        if not np.isfinite(v) or v<0: raise ValueError(f"{k} must be nonnegative and finite")


def _data(A,y,weights=None,baseline=None):
    y=array(y,"observed").reshape(A.output_shape)
    w=np.ones_like(y) if weights is None else np.broadcast_to(array(weights,"weights"),y.shape).copy()
    b=np.zeros_like(y) if baseline is None else np.broadcast_to(array(baseline,"baseline"),y.shape).copy()
    if np.any(w<0) or not np.any(w>0): raise ValueError("weights must be nonnegative with at least one observation")
    return y,w,b


def regularizer(shape,order,axes=None):
    if order==0: return Identity(shape)
    if order==1: return Gradient(shape,axes)
    if order==2: return Laplacian(shape,axes)
    raise ValueError("order must be 0, 1, or 2")


def _stop(cancel):
    if cancel is not None and cancel(): raise CancelledError("cancelled by user")


def _result(A,x,y,b,method,converged,it,obj,start,history=None,**diag):
    pred=A.forward(x)+b; residual=y-pred
    return Result(x,pred,residual,method,bool(converged),int(it),float(obj),perf_counter()-start,
                  history or [],diag,[] if converged else ["Iteration limit or numerical stopping criterion reached; convergence not certified."])


def tikhonov(A,y,alpha=1e-3,order=1,weights=None,baseline=None,nonnegative=False,
             max_iter=1000,tol=1e-7,cancel=None,callback=None):
    """Minimize .5||W(Ax+b-y)||² + alpha/2 ||D x||².

    Unconstrained: matrix-free augmented LSMR. Nonnegative: safeguarded FISTA.
    alpha is the coefficient, NOT its square.
    """
    _check(max_iter,tol,alpha=alpha)
    if nonnegative:
        return fista(A,y,l2=alpha,order=order,weights=weights,baseline=baseline,
                     nonnegative=True,max_iter=max_iter,tol=tol,cancel=cancel,callback=callback)
    start=perf_counter(); y,w,b=_data(A,y,weights,baseline); D=regularizer(A.input_shape,order,getattr(A,"regularization_axes",None))
    m,n=A.shape; p=D.shape[0]; root=np.sqrt(alpha)
    def mv(x):
        _stop(cancel)
        return np.concatenate([(w*A.forward(x)).ravel(), root*D.forward(x).ravel()])
    def rmv(z):
        _stop(cancel)
        return (A.adjoint(w*z[:m].reshape(A.output_shape))+root*D.adjoint(z[m:])).ravel()
    op=LinearOperator((m+p,n),matvec=mv,rmatvec=rmv,dtype=float)
    rhs=np.concatenate([(w*(y-b)).ravel(),np.zeros(p)])
    out=lsmr(op,rhs,atol=tol,btol=tol,maxiter=max_iter)
    x=out[0].reshape(A.input_shape)
    obj=.5*np.sum((w*(A.forward(x)+b-y))**2)+.5*alpha*np.sum(D.forward(x)**2)
    res=_result(A,x,y,b,"tikhonov-lsmr",out[1] in (0,1,2,4,5),out[2],obj,start,
                solver_stop_code=int(out[1]),normal_residual=float(out[4]),estimated_condition=float(out[6]))
    if callback: callback({"iteration":res.iterations,"objective":res.objective})
    return res


def fista(A,y,l1=0.,l2=1e-3,order=1,nonnegative=True,weights=None,baseline=None,
          loss="gaussian",huber_delta=1.,max_iter=1500,tol=1e-6,x0=None,
          cancel=None,callback=None):
    """Monotone-restart proximal gradient with backtracking and KKT residual.

    Gaussian or Huber loss on standardized residual W(Ax+b-y), plus
    l2/2 ||D x||² + l1||x||_1 + indicator(x>=0), if requested.
    The safeguards are an engineering composition of established methods.
    """
    _check(max_iter,tol,l1=l1,l2=l2)
    if loss not in {"gaussian","huber"}: raise ValueError("unknown loss")
    if not np.isfinite(huber_delta) or huber_delta<=0: raise ValueError("huber_delta must be positive")
    start=perf_counter(); y,w,b=_data(A,y,weights,baseline); D=regularizer(A.input_shape,order,getattr(A,"regularization_axes",None))
    x=np.zeros(A.input_shape) if x0 is None else array(x0).reshape(A.input_shape).copy()
    if nonnegative: x=np.maximum(x,0)
    z=x.copy(); momentum=1.; L=max((A.norm_bound*w.max())**2+l2*D.norm_bound**2,1e-12)
    # A modest starting step; backtracking certifies the local quadratic bound.
    L=max(L*.25,1e-12)
    def smooth(v,grad=False):
        r=w*(A.forward(v)+b-y); dv=D.forward(v)
        if loss=="gaussian": value=.5*np.sum(r*r); psi=r
        else:
            ar=abs(r); value=np.sum(np.where(ar<=huber_delta,.5*r*r,huber_delta*(ar-.5*huber_delta)))
            psi=np.clip(r,-huber_delta,huber_delta)
        value+=.5*l2*np.sum(dv*dv)
        return (float(value), A.adjoint(w*psi)+l2*D.adjoint(dv)) if grad else float(value)
    def prox(v,step):
        return np.maximum(v-step*l1,0) if nonnegative else np.sign(v)*np.maximum(abs(v)-step*l1,0)
    obj=smooth(x)+l1*np.sum(abs(x)); hist=[]; converged=False; restarts=0
    reference=max(float(np.linalg.norm(A.adjoint(w*w*(y-b)))), np.finfo(float).tiny)
    kkt=float("inf")
    for it in range(1,max_iter+1):
        _stop(cancel)
        for restart_pass in range(2):
            fz,g=smooth(z,True)
            for backtrack in range(80):
                v=prox(z-g/L,1/L); delta=v-z; fv=smooth(v)
                upper=fz+float(np.vdot(g,delta))+.5*L*np.sum(delta*delta)
                roundoff=64*np.finfo(float).eps*max(abs(fz)+abs(float(np.vdot(g,delta)))+.5*L*np.sum(delta*delta),abs(fv),np.finfo(float).tiny)
                if fv<=upper+roundoff: break
                L*=2
            else: raise RuntimeError("backtracking failed")
            new_obj=fv+l1*np.sum(abs(v))
            if new_obj<=obj+64*np.finfo(float).eps*max(abs(obj),abs(new_obj),np.finfo(float).tiny): break
            z=x.copy(); momentum=1.; restarts+=1
        stepnorm=float(np.linalg.norm(v-x))/max(float(np.linalg.norm(x)),float(np.linalg.norm(v)),np.finfo(float).tiny)
        next_m=(1+np.sqrt(1+4*momentum*momentum))/2
        candidate=v+(momentum-1)/next_m*(v-x)
        # Adaptive restart prevents an extrapolation pointing uphill.
        if float(np.vdot(z-v,v-x))>0:
            next_m=1.; candidate=v.copy(); restarts+=1
        x=v; z=candidate; momentum=next_m; obj=float(new_obj)
        if it==1 or it%10==0 or it==max_iter:
            _,gx=smooth(x,True)
            kkt=float(L*np.linalg.norm(x-prox(x-gx/L,1/L))/reference)
            row={"iteration":it,"objective":obj,"stationarity":kkt,"step_relative":stepnorm,"lipschitz":float(L)}
            hist.append(row)
            if callback: callback(row)
            if kkt<=tol: converged=True; break
    return _result(A,x,y,b,"fista-"+loss,converged,it,obj,start,hist,
                   stationarity=kkt,restarts=restarts,lipschitz=float(L),objective_definition="loss(W(Ax+b-y))+l2/2*||Dx||^2+l1*||x||_1")


def tv_pdhg(A,y,alpha=.03,l2=0.,nonnegative=True,weights=None,baseline=None,
            max_iter=2000,tol=1e-5,cancel=None,callback=None):
    """Isotropic TV: .5||W(Ax+b-y)||²+alpha*sum||grad x||₂+l2/2||x||².

    Chambolle-Pock with a guaranteed upper bound, tau*sigma*||K||² < 1.
    Convergence flag uses a normalized primal/dual fixed-point residual.
    """
    _check(max_iter,tol,alpha=alpha,l2=l2)
    start=perf_counter(); y,w,b=_data(A,y,weights,baseline); D=Gradient(A.input_shape,getattr(A,"regularization_axes",None))
    norm=np.sqrt((A.norm_bound*w.max())**2+D.norm_bound**2)
    tau=sigma=.99/max(norm,1e-12)
    x=np.zeros(A.input_shape); xb=x.copy(); q=np.zeros(A.output_shape); p=np.zeros(D.output_shape)
    target=w*(y-b); hist=[]; converged=False; fixed=1.
    for it in range(1,max_iter+1):
        _stop(cancel)
        qn=(q+sigma*(w*A.forward(xb)-target))/(1+sigma)
        pn=p+sigma*D.forward(xb)
        if alpha>0: pn/=np.maximum(1.,np.linalg.norm(pn,axis=0)/alpha)[None,...]
        else: pn.fill(0)
        xn=(x-tau*(A.adjoint(w*qn)+D.adjoint(pn)))/(1+tau*l2)
        if nonnegative: xn=np.maximum(xn,0)
        if it==1 or it%10==0 or it==max_iter:
            fixed=float(max(np.linalg.norm(xn-x)/tau,np.linalg.norm(qn-q)/sigma,np.linalg.norm(pn-p)/sigma)/max(np.linalg.norm(target),np.linalg.norm(xn),np.linalg.norm(qn),np.linalg.norm(pn),np.finfo(float).tiny))
            obj=.5*np.sum((w*(A.forward(xn)+b-y))**2)+alpha*np.sum(np.linalg.norm(D.forward(xn),axis=0))+.5*l2*np.sum(xn*xn)
            row={"iteration":it,"objective":float(obj),"fixed_point_residual":fixed}
            hist.append(row)
            if callback: callback(row)
            if fixed<tol: converged=True
        xb=2*xn-x; x=xn; q=qn; p=pn
        if converged: break
    return _result(A,x,y,b,"tv-pdhg",converged,it,obj,start,hist,
                   fixed_point_residual=fixed,tau=tau,sigma=sigma,step_bound=float(tau*sigma*norm**2))


def richardson_lucy(A,y,baseline=None,max_iter=300,tol=1e-6,cancel=None,callback=None):
    """Poisson likelihood multiplicative iterations, with A^T 1 normalization.

    Use counts only, not arbitrary signed analog MS currents. No implicit TV.
    """
    _check(max_iter,tol)
    if not A.positive: raise ValueError("Poisson solver requires a nonnegative operator")
    start=perf_counter(); y,_,b=_data(A,y,baseline=baseline)
    if np.any(y<0) or np.any(b<0): raise ValueError("Poisson data and baseline must be nonnegative")
    norm=A.adjoint(np.ones(A.output_shape)); eps=1e-15
    x=np.full(A.input_shape,max(y.mean(),eps)/max(A.norm_bound,eps)); hist=[]; converged=False
    previous=None
    for it in range(1,max_iter+1):
        _stop(cancel)
        pred=np.maximum(A.forward(x)+b,eps)
        xn=x*A.adjoint(y/pred)/np.maximum(norm,eps); xn=np.maximum(xn,0)
        change=float(np.linalg.norm(xn-x)/max(np.linalg.norm(x),eps)); x=xn
        if it==1 or it%10==0 or it==max_iter:
            pred=np.maximum(A.forward(x)+b,eps)
            obj=float(np.sum(pred-y*np.log(pred)))
            row={"iteration":it,"objective":obj,"step_relative":change}; hist.append(row)
            if callback: callback(row)
        if change<tol: converged=True; break
    pred=np.maximum(A.forward(x)+b,eps); obj=float(np.sum(pred-y*np.log(pred)))
    res=_result(A,x,y,b,"richardson-lucy",converged,it,obj,start,hist,relative_change=change)
    res.warnings.append("Poisson count model only; iteration count acts as early-stopping regularization.")
    return res


def wiener(A,y,alpha=1e-3,baseline=None):
    """Circular zero-order Tikhonov/Wiener-like inverse; no silent boundary switch."""
    from scipy import fft
    from .operators import Convolution
    if not isinstance(A,Convolution) or A.mode!="circular": raise ValueError("Wiener requires an explicitly circular Convolution")
    if alpha<=0 or not np.isfinite(alpha): raise ValueError("alpha must be strictly positive")
    start=perf_counter(); y,_,b=_data(A,y,baseline=baseline)
    H=A._H; x=fft.irfftn(H.conj()*fft.rfftn(y-b)/(abs(H)**2+alpha),A.input_shape)
    obj=.5*np.sum((A.forward(x)+b-y)**2)+.5*alpha*np.sum(x*x)
    return _result(A,x,y,b,"circular-wiener",True,1,obj,start,noise_to_signal_ratio=alpha)


def solve(A,y,method="tikhonov",**kwargs):
    funcs={"tikhonov":tikhonov,"fista":fista,"tv":tv_pdhg,"richardson_lucy":richardson_lucy,"wiener":wiener}
    if method not in funcs: raise ValueError(f"unsupported solver: {method}")
    return funcs[method](A,y,**kwargs)
