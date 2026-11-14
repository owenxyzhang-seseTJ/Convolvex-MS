import numpy as np
import pytest
from scipy.optimize import lsq_linear
from convolvex import *
from convolvex.solvers import regularizer,CancelledError
from convolvex.inference import ProjectedWeighted

@pytest.mark.parametrize('order',[0,1,2])
def test_lsmr_dense(order):
    rng=np.random.default_rng(7);A=Convolution([.7,.2,.1],40);y=rng.normal(size=40);w=np.linspace(.5,2,40);alpha=.1
    result=tikhonov(A,y,alpha=alpha,order=order,weights=w,tol=1e-11,max_iter=2000)
    M=A.matrix()*w[:,None];D=regularizer(A.input_shape,order).matrix()
    exact=np.linalg.solve(M.T@M+alpha*(D.T@D),M.T@(w*y))
    np.testing.assert_allclose(result.estimate,exact,atol=2e-7)
    assert result.converged

@pytest.mark.parametrize('nonnegative',[True,False])
def test_fista_reference(nonnegative):
    rng=np.random.default_rng(4);A=Matrix(rng.normal(size=(38,24)));y=rng.normal(size=38);alpha=.03
    r=fista(A,y,l2=alpha,order=0,nonnegative=nonnegative,tol=1e-8,max_iter=5000)
    M=np.vstack([A.a,np.sqrt(alpha)*np.eye(24)]);target=np.r_[y,np.zeros(24)]
    e=lsq_linear(M,target,bounds=(0,np.inf) if nonnegative else (-np.inf,np.inf),tol=1e-12).x
    np.testing.assert_allclose(r.estimate,e,atol=3e-6)
    objs=np.array([z['objective'] for z in r.history]);assert np.max(np.diff(objs))<1e-8
    assert r.converged

def test_soft_threshold():
    y=np.array([-3.,-1,.4,1,3]);r=fista(Identity(5),y,l1=.5,l2=0,nonnegative=False)
    np.testing.assert_allclose(r.estimate,np.sign(y)*np.maximum(abs(y)-.5,0),atol=1e-6)

def test_tv_improves_mse():
    rng=np.random.default_rng(8);x=np.zeros(100);x[25:65]=1;y=x+rng.normal(0,.12,100)
    r=tv_pdhg(Identity(100),y,alpha=.22,max_iter=2000)
    assert np.mean((r.estimate-x)**2)<.4*np.mean((y-x)**2)
    assert r.diagnostics['step_bound']<1

def test_huber_outliers():
    A=Matrix(np.ones((100,1)));y=np.ones(100);y[:5]=40
    r=fista(A,y,l2=0,loss='huber',huber_delta=.1,max_iter=4000,tol=1e-8)
    assert abs(r.estimate[0]-1)<.02

def test_poisson_and_circular():
    A=Convolution([.5,.3,.2],80);x=np.zeros(80);x[20:50]=50;y=A.forward(x)
    r=richardson_lucy(A,np.maximum(y,0),max_iter=100)
    objs=[z['objective'] for z in r.history];assert np.max(np.diff(objs))<1e-7
    assert np.min(r.estimate)>=0
    with pytest.raises(ValueError):richardson_lucy(A,-y)
    with pytest.raises(ValueError):wiener(A,y)
    C=Convolution([.7,.2,.1],80,'circular');r=wiener(C,C.forward(x),alpha=1e-6)
    assert np.linalg.norm(r.estimate-x)/np.linalg.norm(x)<1e-5

def test_projection_matches_joint_ls():
    rng=np.random.default_rng(9);A=Matrix(rng.normal(size=(80,12)));B=np.column_stack([np.ones(80),np.linspace(-1,1,80)])
    x=rng.normal(size=12);y=A.forward(x)+B@np.array([2,.8])+rng.normal(0,.01,80)
    r=pars(A,y,B,l2=.01,order=0,nonnegative=False,tol=1e-9,max_iter=5000)
    joint=np.column_stack([A.a,B]);pen=np.column_stack([np.eye(12)*.1,np.zeros((12,2))])
    ex=np.linalg.lstsq(np.vstack([joint,pen]),np.r_[y,np.zeros(12)],rcond=None)[0]
    np.testing.assert_allclose(r.estimate,ex[:12],atol=1e-6)
    np.testing.assert_allclose(r.extras['baseline_coefficients'],ex[12:],atol=1e-6)
    assert r.diagnostics['nuisance_orthogonality']<1e-10
    Q=np.linalg.qr(B)[0];P=ProjectedWeighted(A,np.ones(80),Q);assert adjoint_error(P)<1e-12

def test_kernel_recovery():
    rng=np.random.default_rng(14);x=rng.uniform(0,1,120);h=np.array([.15,.5,.25,.1])
    y=Convolution(h,120).forward(x);r=estimate_kernel(x,y,(4,),alpha=1e-8,tol=1e-9,max_iter=3000)
    np.testing.assert_allclose(r.estimate,h,atol=2e-5)

def test_blind_and_rank():
    x=np.zeros(70);x[20:30]=1;y=Convolution([.6,.3,.1],70).forward(x)
    r=blind_deconvolution(y,3,restarts=2,outer_iter=5,inner_iter=100)
    assert r.extras['kernel'].sum()==pytest.approx(1)
    assert r.objective<.01
    assert not identifiability(Matrix([[1,1],[2,2]]))['full_column_rank']
    assert not identifiability(Identity(300))['evaluated']

def test_gcv_bootstrap_reproducible():
    A=Convolution([.7,.3],18);y=A.forward(np.arange(18)/18)
    g=gcv(A,y,alphas=[.0001,.01,1]);assert g['alpha'] in [.0001,.01,1]
    b1=bootstrap(A,y,repeats=5,seed=3);b2=bootstrap(A,y,repeats=5,seed=3)
    np.testing.assert_allclose(b1['lower'],b2['lower']);assert np.all(b1['lower']<=b1['upper'])

def test_cancellation_and_limits():
    with pytest.raises(CancelledError):fista(Identity(8),np.ones(8),cancel=lambda:True)
    with pytest.raises(ValueError):fista(Identity(8),np.ones(8),l2=-1)
    with pytest.raises(ValueError):tikhonov(Identity(8),np.ones(8),weights=np.zeros(8))
